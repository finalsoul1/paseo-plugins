import type { HistoryAgent } from "./filters";
import type { AgentPreview } from "./queries";

export interface ActiveAgent extends HistoryAgent {
  permission: string | null;
  lastError: string | null;
}

export type AwaitingGroup = "permission" | "error" | "new" | "seen";

export const GROUPS: readonly { key: AwaitingGroup; title: string }[] = [
  { key: "permission", title: "권한 요청" },
  { key: "error", title: "오류" },
  { key: "new", title: "새 결과" },
  { key: "seen", title: "확인함" },
];

export type TimelineState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; preview: AgentPreview };

export interface AwaitingRow {
  agent: ActiveAgent;
  group: AwaitingGroup;
  summary: string | null;
  loadError: string | null;
  waitingSince: number;
}

// antigravity 는 refetch 가 프로세스를 띄우다 실패해 4초 넘게 걸려서 자동으로 받지 않는다.
const SKIPPED_PROVIDERS = new Set(["antigravity"]);

function isExcluded(agent: ActiveAgent): boolean {
  return agent.archived || SKIPPED_PROVIDERS.has(agent.provider);
}

// 권한 요청과 error 는 실행 상태·마지막 메시지와 상관없이 넣으므로 대화를 받을 필요가 없다.
export function needsTimeline(agent: ActiveAgent): boolean {
  return !isExcluded(agent) && !agent.permission && agent.status !== "error" && agent.status !== "running";
}

export function awaitingRows(
  agents: readonly ActiveAgent[],
  timelineOf: (agentId: string) => TimelineState | undefined,
): { rows: AwaitingRow[]; pending: number } {
  const rows: AwaitingRow[] = [];
  let pending = 0;
  for (const agent of agents) {
    if (isExcluded(agent)) continue;
    const base = { agent, loadError: null, waitingSince: agent.updatedAt };
    if (agent.permission) {
      rows.push({ ...base, group: "permission", summary: agent.permission });
      continue;
    }
    if (agent.status === "error") {
      rows.push({ ...base, group: "error", summary: agent.lastError });
      continue;
    }
    if (agent.status === "running") continue;
    const group: AwaitingGroup = agent.lastError ? "error" : agent.requiresAttention ? "new" : "seen";
    const timeline = timelineOf(agent.id);
    if (!timeline || timeline.status === "loading") {
      pending += 1;
    } else if (timeline.status === "error") {
      rows.push({ ...base, group, summary: agent.lastError, loadError: timeline.message });
    } else {
      const last = timeline.preview.messages.at(-1);
      if (last?.role !== "assistant") continue;
      rows.push({ ...base, group, summary: agent.lastError ?? lastParagraph(last.text), waitingSince: last.at });
    }
  }
  rows.sort((a, b) => a.waitingSince - b.waitingSince);
  return { rows, pending };
}

// 에이전트가 요청하는 내용은 대개 마지막 문단에 있다. 근거는 docs/specs/판단-대기-2026-11-09.md.
export function lastParagraph(markdown: string): string {
  const paragraphs = markdown
    .replace(/^\s*```.*$/gm, "")
    .split(/\n\s*\n/)
    .map((paragraph) => plainText(paragraph))
    .filter(Boolean);
  return paragraphs.at(-1) ?? "";
}

function plainText(markdown: string): string {
  return markdown
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s*(#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/gm, "")
    .replace(/\*\*|__|`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
