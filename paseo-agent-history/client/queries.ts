import { usePaseo } from "@getpaseo/plugin/client";
import { useQuery } from "@tanstack/react-query";
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
  for (const { item } of page.entries) {
    if (item.type === "user_message") messages.push({ role: "user", text: item.text });
    else if (item.type === "assistant_message") messages.push({ role: "assistant", text: item.text });
  }
  return { messages, skipped: page.entries.length - messages.length, hasOlder: page.hasOlder };
}

export function useAgentPreview(agentId: string) {
  const paseo = usePaseo();
  return useQuery({
    queryKey: ["agents", "timeline", agentId],
    queryFn: () => fetchPreview(paseo, agentId),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    // 프로바이더에 따라 요청마다 프로세스를 띄우려 해서(실측 4초), 실패를 자동으로 다시 시도하지 않는다.
    retry: false,
  });
}
