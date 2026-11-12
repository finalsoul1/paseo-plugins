import type { PluginTheme } from "@getpaseo/plugin";
import { openExternalUrl, useRpc, useWorkspace, type PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, Text, View, type TextInput } from "react-native";
import { Button, isOnTop, LoadingText, PRESSED_OPACITY, SearchInput, SPACE, tint, useHover } from "paseo-ui-kit";
import { getWorkspaceRefs, LINK_KIND, matchesSearch, type ChecklistItem, type Ref } from "../shared";

// 앱은 숨긴 워크스페이스 화면도 마운트해 둘 수 있다. 숨은 패널이 조회하지 않도록 보이는지 주기적으로 확인한다.
const VISIBILITY_POLL_MS = 2_000;

export interface RefsPanelOptions {
  // 상태 표시. 조회 실패는 패널이 먼저 「불러오지 못함」으로 보여 주므로 여기로 오지 않는다.
  renderState?: (item: Ref, theme: PluginTheme) => ReactNode;
  // 행을 펼쳤을 때 보일 본문. 없으면 받아 둔 preview 를 그대로 보여 준다.
  renderPreview?: (item: Ref, theme: PluginTheme) => ReactNode;
  emptyPinnedText?: string;
  emptyMentionedText?: string;
  checklistLabel?: string;
}

function useOnScreen(ref: { current: unknown }): boolean {
  const [shown, setShown] = useState(Platform.OS !== "web");
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const check = () => setShown(isOnTop(ref.current));
    check();
    const timer = setInterval(check, VISIBILITY_POLL_MS);
    return () => clearInterval(timer);
  }, [ref]);
  return shown;
}

export function createRefsPanel(options: RefsPanelOptions = {}): ComponentType<PluginWorkspacePanelProps> {
  const {
    renderState,
    renderPreview = (item, theme) => <PreviewBody text={item.preview} theme={theme} />,
    emptyPinnedText = "이 워크스페이스에 고정된 참조가 없습니다",
    emptyMentionedText = "대화에 나온 티켓이 없습니다",
    checklistLabel = "체크리스트",
  } = options;

  function RefState({ item, theme }: { item: Ref; theme: PluginTheme }) {
    if (item.failed) return <Text style={{ color: theme.colors.statusDanger, fontSize: 12 }}>불러오지 못함</Text>;
    return renderState ? <>{renderState(item, theme)}</> : null;
  }

  function RefRow({ item, theme, showMentions, turnStartedAt }: { item: Ref; theme: PluginTheme; showMentions: boolean; turnStartedAt: number | null }) {
    const [hovered, hoverProps] = useHover();
    const [expanded, setExpanded] = useState(false);
    const muted = { color: theme.colors.foregroundMuted, fontSize: 12 };
    const url = item.url;
    // 링크는 미리 볼 본문이 없어서 누르면 바로 연다. 티켓은 누르면 본문 앞부분을 펼치고, 원본은 오른쪽 아이콘으로 연다.
    const isLink = item.kind === LINK_KIND;
    const fresh = turnStartedAt !== null && item.lastMentionedAt !== null && item.lastMentionedAt >= turnStartedAt;
    return (
      <Pressable
        accessibilityRole={isLink ? "link" : "button"}
        accessibilityLabel={`${item.label} ${item.title ?? ""}${isLink ? ", 열기" : expanded ? ", 접기" : ", 본문 펼치기"}`}
        accessibilityState={isLink ? undefined : { expanded }}
        disabled={isLink && !url}
        onPress={isLink ? () => url && void openExternalUrl(url) : () => setExpanded((value) => !value)}
        {...hoverProps}
        style={({ pressed }) => ({
          gap: 2,
          paddingVertical: SPACE.xs + 2,
          paddingHorizontal: SPACE.sm,
          marginHorizontal: -SPACE.sm,
          borderRadius: 6,
          backgroundColor: hovered || expanded ? tint(theme.colors.foreground, 0.06, theme.colors.surface1) : "transparent",
          opacity: pressed ? PRESSED_OPACITY : 1,
        })}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
          <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: SPACE.sm }}>
            <Text style={{ ...muted, fontWeight: "600" }}>{item.label}</Text>
            <RefState item={item} theme={theme} />
            {fresh ? <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: "600" }}>방금</Text> : null}
            {item.guessed ? <Text style={{ color: theme.colors.statusWarning, fontSize: 12 }}>추정</Text> : null}
            {showMentions && item.mentions > 1 ? <Text style={muted}>{item.mentions}회</Text> : null}
          </View>
          {!isLink && url ? (
            <Button theme={theme} variant="tertiary" icon="ExternalLink" accessibilityLabel={`${item.label} 원본 열기`} onPress={() => void openExternalUrl(url)} />
          ) : null}
        </View>
        {item.title ? (
          <Text numberOfLines={expanded ? undefined : 2} style={{ color: theme.colors.foreground, fontSize: 13 }}>
            {item.title}
          </Text>
        ) : null}
        {expanded ? renderPreview(item, theme) : null}
      </Pressable>
    );
  }

  return function RefsPanel({ theme, layout, workspaceId }: PluginWorkspacePanelProps) {
    const workspace = useWorkspace(workspaceId, (current) => ({
      title: `${current.title ?? ""} ${current.name}`,
      directory: current.directory || null,
      statusEnteredAt: current.statusEnteredAt,
    }));
    const fetchRefs = useRpc(getWorkspaceRefs);
    const queryClient = useQueryClient();
    const root = useRef<ScrollView>(null);
    const shown = useOnScreen(root);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState("");
    const searchInput = useRef<TextInput>(null);
    // 턴이 시작하거나 끝나면 statusEnteredAt 이 바뀐다. 그때만 새로 받고, 턴 도중에는 묻지 않는다.
    const queryKey = ["refs", workspaceId, workspace?.statusEnteredAt];
    const query = useQuery({
      queryKey,
      queryFn: () => fetchRefs({ workspaceId, title: workspace!.title, directory: workspace!.directory, refresh: false }),
      enabled: !!workspace && shown,
      placeholderData: keepPreviousData,
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    });
    const refresh = async () => {
      if (!workspace) return;
      setRefreshing(true);
      try {
        queryClient.setQueryData(queryKey, await fetchRefs({ workspaceId, title: workspace.title, directory: workspace.directory, refresh: true }));
      } finally {
        setRefreshing(false);
      }
    };
    const styles = useMemo(() => panelStyles(theme), [theme]);
    const data = query.data;
    const searching = search.trim() !== "";
    const matches = (ref: Ref) => matchesSearch(search, ref.label, ref.title);
    const pinned = data?.pinned.filter(matches) ?? [];
    const tickets = data?.mentioned.filter((ref) => ref.kind !== LINK_KIND && matches(ref)) ?? [];
    const links = data?.mentioned.filter((ref) => ref.kind === LINK_KIND && matches(ref)) ?? [];
    const checklistItems = data?.checklist?.items.filter((item) => matchesSearch(search, item.id, item.title)) ?? [];
    const nothingFound = searching && pinned.length + tickets.length + links.length + checklistItems.length === 0;

    return (
      <ScrollView ref={root} style={styles.screen} contentContainerStyle={{ padding: layout.compact ? SPACE.md : SPACE.lg, gap: SPACE.xl }}>
        {query.isLoading ? <LoadingText theme={theme} label="참조 모으는 중" /> : null}
        {query.error ? <Text style={styles.error}>{query.error.message}</Text> : null}
        {data ? (
          <>
            <SearchInput
              theme={theme}
              inputRef={searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="번호나 제목으로 찾기"
              accessibilityLabel="참조 검색"
              shortcutHint={false}
            />
            {nothingFound ? <Text style={styles.muted}>검색 결과가 없습니다</Text> : null}
            {!searching || pinned.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.heading}>이 워크스페이스</Text>
                {pinned.length === 0 ? <Text style={styles.muted}>{emptyPinnedText}</Text> : null}
                {pinned.map((ref) => (
                  <RefRow key={ref.key} item={ref} theme={theme} showMentions={false} turnStartedAt={data.turnStartedAt} />
                ))}
              </View>
            ) : null}
            {data.checklist && checklistItems.length > 0 ? (
              <Checklist label={checklistLabel} items={checklistItems} allItems={data.checklist.items} path={data.checklist.path} theme={theme} />
            ) : null}
            {!searching || tickets.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.headingRow}>
                  <Text style={styles.heading}>대화에 나온 티켓 {tickets.length}</Text>
                  <Button
                    theme={theme}
                    variant="tertiary"
                    icon="RefreshCw"
                    loading={refreshing}
                    accessibilityLabel="참조 새로 모으기"
                    onPress={() => void refresh()}
                  />
                </View>
                {tickets.length === 0 ? <Text style={styles.muted}>{emptyMentionedText}</Text> : null}
                {tickets.map((ref) => (
                  <RefRow key={ref.key} item={ref} theme={theme} showMentions turnStartedAt={data.turnStartedAt} />
                ))}
              </View>
            ) : null}
            {links.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.heading}>대화에 나온 링크 {links.length}</Text>
                {links.map((ref) => (
                  <RefRow key={ref.key} item={ref} theme={theme} showMentions turnStartedAt={data.turnStartedAt} />
                ))}
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    );
  };
}

function panelStyles(theme: PluginTheme) {
  return {
    screen: { flex: 1, backgroundColor: theme.colors.surface0 },
    section: { gap: SPACE.xs },
    headingRow: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const },
    heading: { color: theme.colors.foregroundMuted, fontSize: 12, fontWeight: "600" as const, marginBottom: SPACE.xs },
    muted: { color: theme.colors.foregroundMuted, fontSize: 12 },
    error: { color: theme.colors.statusDanger, fontSize: 12 },
  };
}

// 펼친 본문의 틀이다. render 가 없으면 받은 글을 평문으로 보여 준다.
export function PreviewBody({ text, theme, render }: { text: string | null; theme: PluginTheme; render?: (text: string) => ReactNode }) {
  if (!text) return <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12, marginTop: SPACE.xs }}>본문이 없습니다</Text>;
  return (
    <View style={{ marginTop: SPACE.xs, paddingLeft: SPACE.sm, borderLeftWidth: 2, borderLeftColor: theme.colors.border }}>
      {render ? render(text) : <Text style={{ color: theme.colors.foreground, fontSize: 13 }}>{text}</Text>}
    </View>
  );
}

// items 는 검색으로 거른 항목이고, 완료 개수와 「최근 언급」은 전체(allItems) 기준이다.
function Checklist({ label, items, allItems, path, theme }: { label: string; items: ChecklistItem[]; allItems: ChecklistItem[]; path: string; theme: PluginTheme }) {
  const done = allItems.filter((item) => item.done).length;
  const latest = allItems.reduce<ChecklistItem | null>(
    (best, item) => (item.lastMentionedAt !== null && (best?.lastMentionedAt ?? -1) < item.lastMentionedAt ? item : best),
    null,
  );
  const muted = { color: theme.colors.foregroundMuted, fontSize: 12 };
  return (
    <View style={{ gap: SPACE.xs }}>
      <Text style={{ ...muted, fontWeight: "600", marginBottom: SPACE.xs }}>
        {label} {done}/{allItems.length} 완료
      </Text>
      {items.map((item) => (
        <View key={item.id} style={{ flexDirection: "row", alignItems: "flex-start", gap: SPACE.sm }}>
          <Text style={{ color: item.done ? theme.colors.statusSuccess : theme.colors.foregroundMuted, fontSize: 13 }}>{item.done ? "☑" : "☐"}</Text>
          <Text style={{ ...muted, fontWeight: "600", lineHeight: 18 }}>{item.id}</Text>
          <Text
            numberOfLines={2}
            style={{
              flex: 1,
              fontSize: 13,
              lineHeight: 18,
              color: item.done ? theme.colors.foregroundMuted : theme.colors.foreground,
            }}
          >
            {item.title}
          </Text>
          {latest?.id === item.id ? <Text style={{ color: theme.colors.accent, fontSize: 12, lineHeight: 18 }}>최근 언급</Text> : null}
        </View>
      ))}
      <Text numberOfLines={1} style={{ ...muted, marginTop: SPACE.xs }}>
        {path.split("/").slice(-3).join("/")}
      </Text>
    </View>
  );
}
