import { usePaseo } from "@getpaseo/plugin/client";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { awaitingRows, needsTimeline, type ActiveAgent, type TimelineState } from "./awaiting";
import type { HistoryAgent, Origin } from "./filters";

type PaseoApi = ReturnType<typeof usePaseo>;
type AgentEntry = Awaited<ReturnType<PaseoApi["agents"]["list"]>>["entries"][number];

// 데몬이 받는 page.limit 최댓값이다. 넘기면 요청 검증에서 거절된다.
const PAGE_LIMIT = 200;

// fetch_agents_request 에는 검색이 없고 PaseoApi 에는 history 요청이 없어서, 전부 받아 클라이언트에서 거른다.
export async function fetchAll(paseo: PaseoApi): Promise<HistoryAgent[]> {
  const agents: HistoryAgent[] = [];
  let cursor: string | undefined;
  do {
    const page = await paseo.agents.list({
      filter: { includeArchived: true },
      sort: [{ key: "updated_at", direction: "desc" }],
      page: { limit: PAGE_LIMIT, cursor },
    });
    agents.push(...page.entries.map(toHistoryAgent));
    cursor = page.pageInfo.nextCursor ?? undefined;
  } while (cursor);
  return agents;
}

function originOf(labels: Record<string, string>): Origin {
  if ("paseo.schedule-id" in labels) return "schedule";
  if ("paseo.parent-agent-id" in labels) return "child";
  return "direct";
}

function toHistoryAgent({ agent, project }: AgentEntry): HistoryAgent {
  const branch = project.checkout.currentBranch;
  const place = branch ?? project.workspaceName ?? null;
  return {
    id: agent.id,
    title: agent.title?.trim() || null,
    status: agent.status,
    archived: !!agent.archivedAt,
    requiresAttention: !!agent.requiresAttention,
    projectKey: project.projectKey,
    projectName: project.projectName,
    place,
    provider: agent.provider,
    origin: originOf(agent.labels),
    createdAt: Date.parse(agent.createdAt),
    updatedAt: Date.parse(agent.updatedAt),
    searchText: [agent.title, project.projectName, project.workspaceName, branch, agent.cwd]
      .filter(Boolean)
      .join("\n")
      .toLowerCase(),
  };
}

export function useAgentHistory() {
  const paseo = usePaseo();
  return useQuery({
    queryKey: ["agents", "history"],
    queryFn: () => fetchAll(paseo),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

// 실측상 마지막 200개 항목이면 대부분 대화 전체가 들어온다. 근거는 docs/specs/에이전트-대화-미리보기-2026-11-02.md.
const PREVIEW_LIMIT = 200;

export interface PreviewMessage {
  role: "user" | "assistant";
  text: string;
  at: number;
}

export interface AgentPreview {
  messages: PreviewMessage[];
  skipped: number;
  hasOlder: boolean;
}

export async function fetchPreview(paseo: PaseoApi, agentId: string): Promise<AgentPreview> {
  const page = await paseo.agents
    .ref(agentId)
    .timeline.refetch({ direction: "tail", limit: PREVIEW_LIMIT, projection: "projected" });
  // 실패는 예외로도 오고(프로바이더 실행 파일이 없을 때), 응답의 error 필드로도 올 수 있어서 둘 다 화면의 오류로 보낸다.
  if (page.error) throw new Error(page.error);
  const messages: PreviewMessage[] = [];
  for (const { item, timestamp } of page.entries) {
    const at = Date.parse(timestamp);
    if (item.type === "user_message") messages.push({ role: "user", text: item.text, at });
    else if (item.type === "assistant_message") messages.push({ role: "assistant", text: item.text, at });
  }
  return { messages, skipped: page.entries.length - messages.length, hasOlder: page.hasOlder };
}

function previewKey(agentId: string) {
  return ["agents", "timeline", agentId];
}

export function useAgentPreview(agentId: string, staleTime = 30_000) {
  const paseo = usePaseo();
  return useQuery({
    queryKey: previewKey(agentId),
    queryFn: () => fetchPreview(paseo, agentId),
    staleTime,
    refetchOnWindowFocus: false,
    // 프로바이더에 따라 요청마다 프로세스를 띄우려 해서(실측 4초), 실패를 자동으로 다시 시도하지 않는다.
    retry: false,
  });
}

export function toActiveAgent(entry: AgentEntry): ActiveAgent {
  const permission = entry.agent.pendingPermissions[0];
  return {
    ...toHistoryAgent(entry),
    permission: permission ? permission.title ?? permission.name : null,
    lastError: entry.agent.lastError ?? null,
  };
}

// 상태가 바뀌면 사이드바 숫자가 바로 바뀌어야 해서, 기록 화면처럼 캐시에 기대지 않고 목록을 구독한다.
function useActiveAgents() {
  const paseo = usePaseo();
  const [agents, setAgents] = useState<ActiveAgent[]>();
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    const entries = new Map<string, AgentEntry>();
    const publish = () => setAgents([...entries.values()].map(toActiveAgent));
    let closed = false;
    let stop = () => {};
    paseo.agents
      .list({ filter: { includeArchived: false }, page: { limit: PAGE_LIMIT }, subscribe: {} })
      .then(({ subscription }) => {
        const unsubscribe = subscription.subscribe({
          snapshot: (snapshot) => {
            entries.clear();
            for (const entry of snapshot.entries) entries.set(entry.agent.id, entry);
            publish();
          },
          update: (message) => {
            if (message.type !== "agent_update") return;
            const update = message.payload;
            if (update.kind === "remove") {
              entries.delete(update.agentId);
            } else {
              // 업데이트에 project 가 빠져 올 수 있어서 앞서 받은 값을 쓴다.
              const project = update.project ?? entries.get(update.agent.id)?.project;
              if (update.agent.archivedAt) entries.delete(update.agent.id);
              else if (project) entries.set(update.agent.id, { agent: update.agent, project });
            }
            publish();
          },
          error: (cause) => setError(cause instanceof Error ? cause : new Error(String(cause))),
        });
        stop = () => {
          unsubscribe();
          void subscription.release();
        };
        if (closed) stop();
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause : new Error(String(cause))));
    return () => {
      closed = true;
      stop();
    };
  }, [paseo]);
  return { agents, error };
}

export function useAwaitingAgents() {
  const paseo = usePaseo();
  const queryClient = useQueryClient();
  const { agents, error } = useActiveAgents();
  const candidates = useMemo(() => (agents ?? []).filter(needsTimeline), [agents]);
  const timelines = useQueries({
    queries: candidates.map((agent) => ({
      queryKey: previewKey(agent.id),
      queryFn: () => fetchPreview(paseo, agent.id),
      // 다시 받는 시점은 아래에서 updatedAt 으로 정한다.
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      retry: false,
    })),
  });

  const seenUpdatedAt = useRef(new Map<string, number>());
  useEffect(() => {
    for (const agent of candidates) {
      const previous = seenUpdatedAt.current.get(agent.id);
      seenUpdatedAt.current.set(agent.id, agent.updatedAt);
      // 처음 보는 에이전트는 기록 화면 미리보기가 남긴 캐시가 그 뒤의 변경을 담고 있는지 받은 시각으로 판단한다.
      const fetchedAt = queryClient.getQueryState(previewKey(agent.id))?.dataUpdatedAt ?? 0;
      const outdated = previous === undefined ? fetchedAt > 0 && fetchedAt < agent.updatedAt : previous !== agent.updatedAt;
      if (outdated) void queryClient.invalidateQueries({ queryKey: previewKey(agent.id), exact: true });
    }
  }, [candidates, queryClient]);

  const states = new Map<string, TimelineState>();
  candidates.forEach((agent, index) => {
    const query = timelines[index];
    if (query.data) states.set(agent.id, { status: "success", preview: query.data });
    else if (query.error) states.set(agent.id, { status: "error", message: query.error.message });
    else states.set(agent.id, { status: "loading" });
  });
  const result = agents ? awaitingRows(agents, (id) => states.get(id)) : null;
  return { rows: result?.rows, pending: result?.pending ?? 0, error };
}
