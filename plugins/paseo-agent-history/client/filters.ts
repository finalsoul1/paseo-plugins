export type AgentStatus = "running" | "idle" | "error" | "closed" | "initializing";
export type Origin = "direct" | "schedule" | "child";

export interface HistoryAgent {
  id: string;
  title: string | null;
  status: AgentStatus;
  archived: boolean;
  requiresAttention: boolean;
  projectKey: string;
  projectName: string;
  place: string | null;
  provider: string;
  origin: Origin;
  createdAt: number;
  updatedAt: number;
  searchText: string;
}

export type Archive = "all" | "active" | "archived";
export type Period = "all" | "today" | "7d" | "30d";
export type GroupKey = "status" | "project" | "origin" | "provider";
export type Dimension = "archive" | "attention" | GroupKey | "period";

export interface Filters {
  query: string;
  archive: Archive;
  period: Period;
  attention: boolean;
  groups: Record<GroupKey, ReadonlySet<string>>;
}

export const EMPTY_FILTERS: Filters = {
  query: "",
  archive: "all",
  period: "all",
  attention: false,
  groups: { status: new Set(), project: new Set(), origin: new Set(), provider: new Set() },
};

// 적용된 조건 라벨과 "모두 지우기"는 EMPTY_FILTERS 를 기준으로 해서, 화면을 열 때 걸린 기본 조건도 라벨로 보이고 풀 수 있다.
export const DEFAULT_FILTERS: Filters = { ...EMPTY_FILTERS, archive: "archived", period: "today" };

const ARCHIVE_LABELS: Record<Archive, string> = { all: "전체", active: "활성만", archived: "아카이브만" };
const PERIOD_LABELS: Record<Period, string> = { all: "전체", today: "오늘", "7d": "최근 7일", "30d": "최근 30일" };
export const STATUS_LABELS: Record<AgentStatus, string> = {
  running: "실행 중",
  idle: "대기",
  error: "오류",
  closed: "종료",
  initializing: "시작 중",
};
const ORIGIN_LABELS: Record<Origin, string> = { direct: "직접 만듦", schedule: "스케줄 실행", child: "하위 에이전트" };

const TITLES: Record<Dimension, string> = {
  archive: "보관",
  attention: "확인",
  status: "상태",
  project: "프로젝트",
  origin: "출처",
  provider: "프로바이더",
  period: "기간",
};

const DAY_MS = 86_400_000;

function periodStart(period: Exclude<Period, "all">, now: number): number {
  if (period === "today") {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    return today.getTime();
  }
  return now - (period === "7d" ? 7 : 30) * DAY_MS;
}

function groupValue(agent: HistoryAgent, key: GroupKey): string {
  switch (key) {
    case "status":
      return agent.status;
    case "project":
      return agent.projectKey;
    case "origin":
      return agent.origin;
    case "provider":
      return agent.provider;
  }
}

function optionMatches(agent: HistoryAgent, key: Dimension, value: string, now: number): boolean {
  switch (key) {
    case "archive":
      return value === "all" || agent.archived === (value === "archived");
    case "period":
      return value === "all" || agent.updatedAt >= periodStart(value as Exclude<Period, "all">, now);
    case "attention":
      return agent.requiresAttention;
    default:
      return groupValue(agent, key) === value;
  }
}

function matches(agent: HistoryAgent, filters: Filters, now: number, except?: Dimension): boolean {
  const query = filters.query.trim().toLowerCase();
  if (query && !agent.searchText.includes(query)) return false;
  if (except !== "archive" && !optionMatches(agent, "archive", filters.archive, now)) return false;
  if (except !== "period" && !optionMatches(agent, "period", filters.period, now)) return false;
  if (except !== "attention" && filters.attention && !agent.requiresAttention) return false;
  return (Object.keys(filters.groups) as GroupKey[]).every((key) => {
    const selected = filters.groups[key];
    return key === except || selected.size === 0 || selected.has(groupValue(agent, key));
  });
}

export function applyFilters(items: readonly HistoryAgent[], filters: Filters, now: number): HistoryAgent[] {
  return items.filter((agent) => matches(agent, filters, now));
}

export interface FilterOption {
  value: string;
  label: string;
  count: number;
  checked: boolean;
}

export interface FilterSection {
  key: Dimension;
  title: string;
  kind: "radio" | "checkbox";
  options: FilterOption[];
}

// 건수는 "지금 조건에 이 항목을 더하면 몇 건인지"다. 같은 그룹 안은 OR 라서 그 그룹 자신의 선택은 계산에서 뺀다.
export function filterSections(items: readonly HistoryAgent[], filters: Filters, now: number): FilterSection[] {
  const projectNames = projectNamesOf(items);
  const section = (key: Dimension, kind: FilterSection["kind"], values: readonly string[]): FilterSection => {
    const base = items.filter((agent) => matches(agent, filters, now, key));
    return {
      key,
      title: TITLES[key],
      kind,
      options: values.map((value) => ({
        value,
        label: optionLabel(key, value, projectNames),
        count: base.filter((agent) => optionMatches(agent, key, value, now)).length,
        checked: isChecked(filters, key, value),
      })),
    };
  };
  return [
    section("archive", "radio", Object.keys(ARCHIVE_LABELS)),
    section("attention", "checkbox", ["on"]),
    section("status", "checkbox", Object.keys(STATUS_LABELS)),
    section("project", "checkbox", byFrequency(items, "project")),
    section("origin", "checkbox", Object.keys(ORIGIN_LABELS)),
    section("provider", "checkbox", byFrequency(items, "provider")),
    section("period", "radio", Object.keys(PERIOD_LABELS)),
  ];
}

function byFrequency(items: readonly HistoryAgent[], key: GroupKey): string[] {
  const counts = new Map<string, number>();
  for (const agent of items) counts.set(groupValue(agent, key), (counts.get(groupValue(agent, key)) ?? 0) + 1);
  return [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)!);
}

function projectNamesOf(items: readonly HistoryAgent[]): ReadonlyMap<string, string> {
  return new Map(items.map((agent) => [agent.projectKey, agent.projectName]));
}

function optionLabel(key: Dimension, value: string, projectNames: ReadonlyMap<string, string>): string {
  switch (key) {
    case "archive":
      return ARCHIVE_LABELS[value as Archive];
    case "period":
      return PERIOD_LABELS[value as Period];
    case "attention":
      return "확인 필요";
    case "status":
      return STATUS_LABELS[value as AgentStatus];
    case "origin":
      return ORIGIN_LABELS[value as Origin];
    case "project":
      return projectNames.get(value) ?? value;
    case "provider":
      return value;
  }
}

function isChecked(filters: Filters, key: Dimension, value: string): boolean {
  switch (key) {
    case "archive":
      return filters.archive === value;
    case "period":
      return filters.period === value;
    case "attention":
      return filters.attention;
    default:
      return filters.groups[key].has(value);
  }
}

export function selectOption(filters: Filters, key: Dimension, value: string): Filters {
  switch (key) {
    case "archive":
      return { ...filters, archive: value as Archive };
    case "period":
      return { ...filters, period: value as Period };
    case "attention":
      return { ...filters, attention: !filters.attention };
    default: {
      const selected = filters.groups[key];
      return { ...filters, groups: { ...filters.groups, [key]: toggled(selected, value) } };
    }
  }
}

function toggled(set: ReadonlySet<string>, value: string): ReadonlySet<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export interface AppliedFilter {
  id: string;
  label: string;
  clear: (filters: Filters) => Filters;
}

export function appliedFilters(filters: Filters, items: readonly HistoryAgent[]): AppliedFilter[] {
  const projectNames = projectNamesOf(items);
  const applied: AppliedFilter[] = [];
  const query = filters.query.trim();
  if (query) applied.push({ id: "query", label: `검색: ${query}`, clear: (current) => ({ ...current, query: "" }) });
  if (filters.archive !== EMPTY_FILTERS.archive) {
    applied.push({
      id: "archive",
      label: `${TITLES.archive}: ${ARCHIVE_LABELS[filters.archive]}`,
      clear: (current) => ({ ...current, archive: EMPTY_FILTERS.archive }),
    });
  }
  if (filters.attention) {
    applied.push({ id: "attention", label: "확인 필요", clear: (current) => ({ ...current, attention: false }) });
  }
  for (const key of Object.keys(filters.groups) as GroupKey[]) {
    for (const value of filters.groups[key]) {
      applied.push({
        id: `${key}:${value}`,
        label: `${TITLES[key]}: ${optionLabel(key, value, projectNames)}`,
        clear: (current) => selectOption(current, key, value),
      });
    }
  }
  if (filters.period !== EMPTY_FILTERS.period) {
    applied.push({
      id: "period",
      label: `${TITLES.period}: ${PERIOD_LABELS[filters.period]}`,
      clear: (current) => ({ ...current, period: EMPTY_FILTERS.period }),
    });
  }
  return applied;
}

export type SortKey = "updated" | "created" | "title";

export const SORTS: readonly { key: SortKey; label: string }[] = [
  { key: "updated", label: "갱신순" },
  { key: "created", label: "생성순" },
  { key: "title", label: "제목순" },
];

export function sortAgents(items: readonly HistoryAgent[], sort: SortKey): HistoryAgent[] {
  const sorted = [...items];
  if (sort === "updated") sorted.sort((a, b) => b.updatedAt - a.updatedAt);
  else if (sort === "created") sorted.sort((a, b) => b.createdAt - a.createdAt);
  else sorted.sort((a, b) => (a.title === null ? 1 : b.title === null ? -1 : a.title.localeCompare(b.title, "ko")));
  return sorted;
}
