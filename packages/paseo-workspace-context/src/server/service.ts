import type { RpcInput } from "@getpaseo/plugin";
import type { PluginServerContext } from "@getpaseo/plugin/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { LINK_KIND, type getWorkspaceRefs, type Ref, type WorkspaceRefs } from "../shared";

export type Paseo = Parameters<Parameters<PluginServerContext["handle"]>[1]>[1]["paseo"];

export interface Meta {
  title: string | null;
  state: string | null;
  url: string | null;
  preview: string | null;
  // 조회는 됐지만 없는 번호다. 추정한 참조면 목록에서 뺀다.
  missing: boolean;
  failed: boolean;
  // 머지·닫힘·해결된 항목이다. 다시 바뀔 일이 드물어서 오래 캐시한다.
  final: boolean;
}

export const EMPTY_META: Meta = { title: null, state: null, url: null, preview: null, missing: false, failed: false, final: false };

export interface RepoContext {
  remote: string | null;
}

export interface WorkspaceContext extends RepoContext {
  workspaceId: string;
  title: string;
  directory: string | null;
  branch: string | null;
}

export interface Checklist {
  path: string;
  items: { id: string; title: string; done: boolean }[];
}

export interface RefsAdapter<T extends { kind: string }> {
  key(target: T): string;
  label(target: T): string;
  guessed(target: T): boolean;
  // 체크리스트 항목을 가리키는 참조면 그 항목 id 다. 이런 참조는 목록에 넣지 않고 「최근 언급」에만 쓴다.
  checklistItem(target: T): string | null;
  extract(text: string, repo: RepoContext): T[];
  pinned(workspace: WorkspaceContext): Promise<{ targets: T[]; checklist: Checklist | null }>;
  // 캐시에 없는 대상만 받는다. 결과는 key(target) 로 찾는다.
  resolve(targets: T[]): Promise<Map<string, Meta>>;
}

const RESULT_TTL_MS = 15_000;
const OPEN_TTL_MS = 5 * 60_000;
const FINAL_TTL_MS = 60 * 60_000;
// 권한 없는 프로젝트처럼 계속 실패하는 참조를 매번 다시 묻지 않도록 실패도 잠깐 캐시한다.
const FAILED_TTL_MS = 60_000;

export function ttlFor(meta: Meta): number {
  if (meta.failed) return FAILED_TTL_MS;
  return meta.final || meta.missing ? FINAL_TTL_MS : OPEN_TTL_MS;
}

const run = promisify(execFile);

async function git(directory: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await run("git", ["-C", directory, ...args], { timeout: 5_000 });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

interface Tally<T> {
  target: T;
  mentions: number;
  lastMentionedAt: number;
}

export interface RefsServiceOptions {
  // 오래된 참조까지 다 조회하면 원본 요청이 너무 많아진다. 최근 언급 순으로 이만큼만 보여 준다.
  maxTickets?: number;
  maxLinks?: number;
}

export function createRefsService<T extends { kind: string }>(adapter: RefsAdapter<T>, options: RefsServiceOptions = {}) {
  const maxTickets = options.maxTickets ?? 40;
  const maxLinks = options.maxLinks ?? 15;
  const results = new Map<string, { value: WorkspaceRefs; at: number }>();
  const inFlight = new Map<string, Promise<WorkspaceRefs>>();
  const metaCache = new Map<string, { meta: Meta; expiresAt: number }>();

  async function resolveCached(targets: T[]): Promise<Map<string, Meta>> {
    const result = new Map<string, Meta>();
    const now = Date.now();
    const pending: T[] = [];
    for (const target of targets) {
      const key = adapter.key(target);
      const cached = metaCache.get(key);
      if (cached && now < cached.expiresAt) result.set(key, cached.meta);
      else pending.push(target);
    }
    if (pending.length === 0) return result;
    const resolved = await adapter.resolve(pending);
    for (const [key, meta] of resolved) {
      result.set(key, meta);
      metaCache.set(key, { meta, expiresAt: Date.now() + ttlFor(meta) });
    }
    return result;
  }

  function dedupe(targets: T[]): T[] {
    const seen = new Set<string>();
    return targets.filter((target) => {
      const key = adapter.key(target);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function toRef(target: T, metas: Map<string, Meta>, tally: Tally<T> | undefined): Ref[] {
    const key = adapter.key(target);
    const guessed = adapter.guessed(target);
    const meta = metas.get(key);
    if (meta?.missing && guessed) return [];
    return [
      {
        key,
        kind: target.kind,
        label: adapter.label(target),
        title: meta?.title ?? null,
        state: meta?.state ?? null,
        url: meta?.url ?? null,
        preview: meta?.preview ?? null,
        guessed,
        failed: !meta || meta.failed || meta.missing,
        mentions: tally?.mentions ?? 0,
        lastMentionedAt: tally?.lastMentionedAt ?? null,
      },
    ];
  }

  // 사용자·에이전트 메시지만 본다. 도구 결과에는 파일 내용과 명령 출력의 번호가 섞여 있다.
  async function tallyConversation(workspaceId: string, repo: RepoContext, paseo: Paseo) {
    const tallies = new Map<string, Tally<T>>();
    let turnStartedAt: number | null = null;
    for (const agent of await workspaceAgents(workspaceId, paseo)) {
      const page = await paseo.agents
        .ref(agent.id)
        .timeline.refetch({ direction: "tail", limit: 0 })
        .catch((error: unknown) => {
          console.error(`refs: timeline ${agent.id} failed: ${error instanceof Error ? error.message : String(error)}`);
          return null;
        });
      for (const entry of page?.entries ?? []) {
        const { item } = entry;
        if (item.type !== "user_message" && item.type !== "assistant_message") continue;
        const at = Date.parse(entry.timestamp) || 0;
        if (item.type === "user_message") turnStartedAt = Math.max(turnStartedAt ?? 0, at);
        for (const target of adapter.extract(item.text, repo)) {
          const key = adapter.key(target);
          const tally = tallies.get(key);
          if (tally) {
            tally.mentions += 1;
            tally.lastMentionedAt = Math.max(tally.lastMentionedAt, at);
          } else tallies.set(key, { target, mentions: 1, lastMentionedAt: at });
        }
      }
    }
    return { tallies, turnStartedAt };
  }

  async function build(input: RpcInput<typeof getWorkspaceRefs>, paseo: Paseo): Promise<WorkspaceRefs> {
    const { directory } = input;
    const [remote, branch] = directory
      ? await Promise.all([git(directory, ["remote", "get-url", "origin"]), git(directory, ["branch", "--show-current"])])
      : [null, null];
    const repo = { remote };
    const [pinned, { tallies, turnStartedAt }] = await Promise.all([
      adapter.pinned({ workspaceId: input.workspaceId, title: input.title, directory, remote, branch }),
      tallyConversation(input.workspaceId, repo, paseo),
    ]);

    const pinnedTargets = dedupe(pinned.targets);
    const pinnedKeys = new Set(pinnedTargets.map((target) => adapter.key(target)));
    const recent = [...tallies.values()]
      .filter(({ target }) => adapter.checklistItem(target) === null && !pinnedKeys.has(adapter.key(target)))
      .sort((a, b) => b.lastMentionedAt - a.lastMentionedAt);
    const mentioned = [
      ...recent.filter(({ target }) => target.kind !== LINK_KIND).slice(0, maxTickets),
      ...recent.filter(({ target }) => target.kind === LINK_KIND).slice(0, maxLinks),
    ];

    const checklistMentions = new Map<string, number>();
    for (const { target, lastMentionedAt } of tallies.values()) {
      const id = adapter.checklistItem(target);
      if (id !== null) checklistMentions.set(id, Math.max(checklistMentions.get(id) ?? 0, lastMentionedAt));
    }

    const metas = await resolveCached([...pinnedTargets, ...mentioned.map(({ target }) => target)]);
    return {
      pinned: pinnedTargets.flatMap((target) => toRef(target, metas, tallies.get(adapter.key(target)))),
      checklist: pinned.checklist
        ? {
            path: pinned.checklist.path,
            items: pinned.checklist.items.map((item) => ({ ...item, lastMentionedAt: checklistMentions.get(item.id) ?? null })),
          }
        : null,
      mentioned: mentioned.flatMap((tally) => toRef(tally.target, metas, tally)),
      turnStartedAt,
      fetchedAt: Date.now(),
    };
  }

  return {
    workspaceRefs(input: RpcInput<typeof getWorkspaceRefs>, paseo: Paseo): Promise<WorkspaceRefs> {
      const cached = results.get(input.workspaceId);
      if (!input.refresh && cached && Date.now() - cached.at < RESULT_TTL_MS) return Promise.resolve(cached.value);
      const running = inFlight.get(input.workspaceId);
      if (running) return running;
      const promise = build(input, paseo)
        .then((value) => {
          results.set(input.workspaceId, { value, at: Date.now() });
          return value;
        })
        .finally(() => inFlight.delete(input.workspaceId));
      inFlight.set(input.workspaceId, promise);
      return promise;
    },
  };
}

// 에이전트 목록은 워크스페이스로 거를 수 없고 한 번에 200개까지라서, 끝까지 넘기며 고른다.
async function workspaceAgents(workspaceId: string, paseo: Paseo): Promise<{ id: string }[]> {
  const agents: { id: string }[] = [];
  let cursor: string | undefined;
  do {
    const { entries, pageInfo } = await paseo.agents.list({ page: { limit: 200, cursor } });
    for (const { agent } of entries) if (agent.workspaceId === workspaceId) agents.push(agent);
    cursor = pageInfo.hasMore ? (pageInfo.nextCursor ?? undefined) : undefined;
  } while (cursor);
  return agents;
}
