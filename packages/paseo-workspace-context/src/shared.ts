import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

// 링크는 원본을 조회하지 않고, 패널에서 티켓과 다른 구역에 따로 모은다.
export const LINK_KIND = "link";

export const refSchema = z.object({
  key: z.string(),
  kind: z.string(),
  label: z.string(),
  title: z.string().nullable(),
  state: z.string().nullable(),
  url: z.string().nullable(),
  preview: z.string().nullable(),
  // 번호만 보고 출처를 짐작한 참조다.
  guessed: z.boolean(),
  failed: z.boolean(),
  mentions: z.number(),
  lastMentionedAt: z.number().nullable(),
});

export type Ref = z.infer<typeof refSchema>;

export const checklistItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  done: z.boolean(),
  lastMentionedAt: z.number().nullable(),
});

export type ChecklistItem = z.infer<typeof checklistItemSchema>;

export const workspaceRefsSchema = z.object({
  pinned: z.array(refSchema),
  checklist: z.object({ path: z.string(), items: z.array(checklistItemSchema) }).nullable(),
  mentioned: z.array(refSchema),
  // 마지막 사용자 메시지 시각이다. 이보다 나중에 언급된 참조에 「방금」을 붙인다.
  turnStartedAt: z.number().nullable(),
  fetchedAt: z.number(),
});

export type WorkspaceRefs = z.infer<typeof workspaceRefsSchema>;

export const getAutoOpened = defineRpc({
  name: "refs.auto-opened",
  input: z.object({}),
  output: z.object({ opened: z.array(z.string()) }),
});

export const claimAutoOpen = defineRpc({
  name: "refs.claim-auto-open",
  input: z.object({ workspaceId: z.string() }),
  output: z.object({ open: z.boolean() }),
});

export const getWorkspaceRefs = defineRpc({
  name: "refs.workspace",
  input: z.object({
    workspaceId: z.string(),
    title: z.string(),
    directory: z.string().nullable(),
    refresh: z.boolean(),
  }),
  output: workspaceRefsSchema,
});

// 패널 검색이다. 이미 받은 항목의 번호와 제목에서만 찾아서, 검색 때문에 원본 조회가 늘지 않는다.
export function matchesSearch(search: string, ...fields: (string | null)[]): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((field) => field?.toLowerCase().includes(needle));
}
