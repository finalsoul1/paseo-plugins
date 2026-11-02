import type { PluginTheme } from "@getpaseo/plugin";
import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import {
  Button,
  Chip,
  goBack,
  isShown,
  LoadingText,
  PRESSED_OPACITY,
  Segmented,
  shortcutLabel,
  SPACE,
  useHover,
  useWebEscape,
  useWebShortcut,
  webKeyDown,
} from "paseo-ui-kit";
import { AppliedLabel, ClearAll, OptionRow } from "./controls";
import {
  appliedFilters,
  applyFilters,
  DEFAULT_FILTERS,
  EMPTY_FILTERS,
  filterSections,
  selectOption,
  SORTS,
  sortAgents,
  STATUS_LABELS,
  type AgentStatus,
  type Filters,
  type FilterSection,
  type HistoryAgent,
  type SortKey,
} from "./filters";
import { AgentPreviewPane } from "./preview";
import { useAgentHistory } from "./queries";

const CONTENT_MAX_WIDTH = 960;
const SIDE_WIDTH = 220;
// 아카이브까지 받으면 수백 개라, 필터를 누를 때마다 전부 다시 그리지 않도록 "더 보기"로 늘린다.
const PAGE_SIZE = 100;

function statusColor(theme: PluginTheme, status: AgentStatus): string {
  switch (status) {
    case "running":
      return theme.colors.accent;
    case "initializing":
      return theme.colors.statusWarning;
    case "idle":
      return theme.colors.statusSuccess;
    case "error":
      return theme.colors.statusDanger;
    case "closed":
      return theme.colors.foregroundMuted;
  }
}

function relativeTime(time: number, now: number): string {
  const minutes = Math.floor((now - time) / 60_000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}시간 전`;
  const date = new Date(time);
  const day = `${date.getMonth() + 1}/${date.getDate()}`;
  return date.getFullYear() === new Date(now).getFullYear() ? day : `${date.getFullYear()}/${day}`;
}

export function HistoryScreen({ theme, layout, navigation }: PluginScreenProps) {
  const history = useAgentHistory();
  // 앱 사이드바가 열려 있으면 화면이 창보다 좁아서, 창 크기가 아니라 이 화면의 실제 폭으로 판단한다.
  const [width, setWidth] = useState(0);
  const sideFilters = !layout.compact && width >= CONTENT_MAX_WIDTH + SIDE_WIDTH + 120;
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortKey>("updated");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [activeIndex, setActiveIndex] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  useEffect(() => {
    setVisible(PAGE_SIZE);
    setActiveIndex(0);
  }, [filters, sort]);
  const screenRef = useRef<View>(null);
  const searchRef = useRef<TextInput>(null);
  const rowRefs = useRef(new Map<string, View>());
  // Cmd+L 은 Paseo 의 "메시지 입력창 포커스" 단축키라서, 이 화면이 실제로 보일 때만 가로챈다.
  useWebShortcut("l", () => {
    if (!isShown(searchRef.current)) return false;
    searchRef.current?.focus();
    return true;
  });
  // 폭을 재기 전에는 좁은 배치로 그렸다가 넓은 배치로 바뀌며 검색창이 다시 마운트되므로, 폭이 정해진 뒤 한 번만 옮긴다.
  // 네이티브는 키보드가 목록을 가려서 웹에서만 한다.
  const openFocused = useRef(false);
  useEffect(() => {
    if (width === 0 || openFocused.current || Platform.OS !== "web") return;
    openFocused.current = true;
    searchRef.current?.focus();
  }, [width]);
  useWebEscape(screenRef, () => {
    if (!isShown(screenRef.current)) return false;
    goBack();
    return true;
  });

  const styles = useMemo(
    () => ({
      screen: { flex: 1, backgroundColor: theme.colors.surface0 },
      content: {
        width: "100%" as const,
        maxWidth: CONTENT_MAX_WIDTH,
        alignSelf: "center" as const,
        padding: layout.compact ? SPACE.lg : SPACE.xl,
        gap: SPACE.sm,
      },
      header: { flexDirection: "row" as const, alignItems: "center" as const, gap: SPACE.sm },
      title: { color: theme.colors.foreground, fontSize: layout.compact ? 18 : 20, fontWeight: "600" as const },
      muted: { color: theme.colors.foregroundMuted, fontSize: 12, flex: 1 },
      error: { color: theme.colors.statusDanger, fontSize: 13 },
      search: {
        paddingVertical: SPACE.sm,
        paddingHorizontal: SPACE.md,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface2,
        color: theme.colors.foreground,
        fontSize: 13,
        // 브라우저 기본 포커스 outline 은 왼쪽 칸 ScrollView 가장자리에서 잘려 깨져 보인다. 테두리 색으로 대신 표시한다.
        outlineWidth: 0,
      },
      searchFocused: { borderColor: theme.colors.accent },
      searchBox: { justifyContent: "center" as const },
      searchHint: { position: "absolute" as const, right: SPACE.md, color: theme.colors.foregroundMuted, fontSize: 12 },
      // 줄바꿈된 칩끼리는 필터 줄 사이(SPACE.sm)보다 가까워야 같은 그룹으로 읽힌다.
      chips: {
        flexDirection: "row" as const,
        flexWrap: "wrap" as const,
        alignItems: "center" as const,
        rowGap: SPACE.xs,
        columnGap: SPACE.sm,
      },
      chipLabel: { color: theme.colors.foregroundMuted, fontSize: 11, fontWeight: "600" as const, width: 64 },
      split: {
        flex: 1,
        flexDirection: "row" as const,
        width: "100%" as const,
        maxWidth: CONTENT_MAX_WIDTH + SIDE_WIDTH + 24,
        alignSelf: "center" as const,
        gap: SPACE.xl,
        paddingHorizontal: SPACE.xl,
      },
      side: { width: SIDE_WIDTH, flexGrow: 0, flexShrink: 0 },
      sideContent: { paddingVertical: SPACE.xl, gap: SPACE.lg },
      sideGroup: { gap: SPACE.xs },
      sideTitle: {
        color: theme.colors.foregroundMuted,
        fontSize: 11,
        fontWeight: "600" as const,
        letterSpacing: 0.4,
        marginBottom: SPACE.xs,
      },
      listBox: {
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 8,
        overflow: "hidden" as const,
        backgroundColor: theme.colors.surface0,
      },
      empty: { color: theme.colors.foregroundMuted, fontSize: 13, padding: SPACE.lg },
      preview: {
        paddingVertical: SPACE.md,
        paddingHorizontal: SPACE.lg,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface1,
      },
      main: { flex: 1 },
      mainContent: { paddingVertical: SPACE.xl, gap: SPACE.sm },
      // 필터 블록과 결과 사이를 필터 줄 사이보다 넓게 벌려 두 묶음을 가른다.
      results: { marginTop: SPACE.lg, gap: SPACE.sm },
    }),
    [theme, layout.compact],
  );

  const items = history.data ?? [];
  // 기간 필터와 상대 시각의 기준이다. 목록을 다시 받을 때만 바꿔서 같은 데이터로는 건수가 흔들리지 않게 한다.
  const now = useMemo(() => Date.now(), [history.dataUpdatedAt]);
  const filtered = useMemo(() => sortAgents(applyFilters(items, filters, now), sort), [items, filters, now, sort]);
  const sections = useMemo(() => filterSections(items, filters, now), [items, filters, now]);
  const applied = appliedFilters(filters, items);
  const select = (key: FilterSection["key"], value: string) => setFilters((current) => selectOption(current, key, value));

  const shownRows = filtered.slice(0, visible);
  const tabbable = Math.min(activeIndex, shownRows.length - 1);
  const focusRow = (index: number) => {
    const agent = shownRows[index];
    if (!agent) return;
    setActiveIndex(index);
    rowRefs.current.get(agent.id)?.focus();
  };
  // 목록 행 사이는 Tab 대신 화살표로 옮겨 다니고, Tab 은 목록 전체를 한 번에 건너뛴다(roving tabindex).
  const onRowKey = (index: number, key: string): boolean => {
    switch (key) {
      case "ArrowDown":
        focusRow(Math.min(index + 1, shownRows.length - 1));
        return true;
      case "ArrowUp":
        if (index === 0) searchRef.current?.focus();
        else focusRow(index - 1);
        return true;
      case "Home":
        focusRow(0);
        return true;
      case "End":
        focusRow(shownRows.length - 1);
        return true;
      case "Escape":
        searchRef.current?.focus();
        return true;
      default:
        return false;
    }
  };

  const header = (
    <View style={styles.header}>
      <Text style={styles.title} accessibilityRole="header">
        에이전트 기록
      </Text>
      <Text style={styles.muted}>{history.data ? `${filtered.length} / ${items.length}개` : ""}</Text>
      <Button
        theme={theme}
        variant="tertiary"
        icon="RefreshCw"
        label={history.isFetching ? "불러오는 중" : undefined}
        loading={history.isFetching}
        accessibilityLabel="에이전트 기록 새로고침"
        disabled={history.isFetching}
        onPress={() => void history.refetch()}
      />
    </View>
  );

  const focusHint = shortcutLabel("l");
  const search = (
    <View style={styles.searchBox}>
      <TextInput
        ref={searchRef}
        style={[styles.search, searchFocused ? styles.searchFocused : null]}
        onFocus={() => setSearchFocused(true)}
        onBlur={() => setSearchFocused(false)}
        value={filters.query}
        onChangeText={(text) => setFilters((current) => ({ ...current, query: text }))}
        onKeyPress={({ nativeEvent }) => {
          if (nativeEvent.key === "ArrowDown") focusRow(0);
          // React Native Web 의 TextInput 은 keydown 전파를 막아서 화면의 Esc 처리(useWebEscape)가 받지 못한다.
          if (nativeEvent.key === "Escape") {
            if (filters.query) setFilters((current) => ({ ...current, query: "" }));
            else searchRef.current?.blur();
          }
        }}
        onSubmitEditing={() => focusRow(0)}
        placeholder={sideFilters ? "제목, 프로젝트, 브랜치 검색" : "제목, 프로젝트, 브랜치, 경로로 거르기 (아래 화살표로 목록 이동)"}
        placeholderTextColor={theme.colors.foregroundMuted}
        accessibilityLabel="제목, 프로젝트, 브랜치, 경로로 거르기"
        autoCorrect={false}
      />
      {focusHint && !searchFocused && !filters.query ? (
        <Text style={styles.searchHint} pointerEvents="none">
          {focusHint}
        </Text>
      ) : null}
    </View>
  );

  const sortControl = (
    <Segmented theme={theme} groupLabel="정렬" options={SORTS} value={sort} onChange={setSort} />
  );

  // 값이 하나뿐인 그룹(프로바이더를 하나만 쓴 경우 등)은 고를 게 없어서 숨긴다. 보관·기간·확인 필요는 늘 보인다.
  const shown = sections.filter((section) => section.kind === "radio" || section.key === "attention" || section.options.length > 1);

  const appliedRow =
    applied.length > 0 ? (
      <View style={styles.chips}>
        {sideFilters ? null : <Text style={styles.chipLabel}>적용됨</Text>}
        {applied.map((filter) => (
          <AppliedLabel key={filter.id} theme={theme} label={filter.label} onPress={() => setFilters(filter.clear)} />
        ))}
        <ClearAll theme={theme} onPress={() => setFilters(EMPTY_FILTERS)} />
      </View>
    ) : null;

  const rest = filtered.length - visible;
  const list = history.isLoading ? (
    <LoadingText theme={theme} label="에이전트 기록을 불러오는 중" />
  ) : history.error ? (
    <Text style={styles.error}>불러오지 못했습니다: {history.error.message}</Text>
  ) : (
    <>
      <View style={styles.listBox}>
        {filtered.length === 0 ? (
          <Text style={styles.empty}>조건에 맞는 에이전트가 없습니다.</Text>
        ) : (
          shownRows.map((agent, index) => {
            const last = index === shownRows.length - 1;
            const previewing = agent.id === previewId;
            return (
              <Fragment key={agent.id}>
                <AgentRow
                  agent={agent}
                  theme={theme}
                  now={now}
                  last={last && !previewing}
                  tabbable={index === tabbable}
                  previewing={previewing}
                  rowRef={(node) => {
                    if (node) rowRefs.current.set(agent.id, node);
                    else rowRefs.current.delete(agent.id);
                  }}
                  onFocus={() => setActiveIndex(index)}
                  onKey={(key) => onRowKey(index, key)}
                  onPress={() => setPreviewId(previewing ? null : agent.id)}
                />
                {previewing ? (
                  <View style={[styles.preview, { borderBottomWidth: last ? 0 : 1 }]}>
                    <AgentPreviewPane
                      theme={theme}
                      agentId={agent.id}
                      openLabel={agent.archived ? "복원" : "열기"}
                      onOpen={navigation ? () => navigation.openAgent({ agentId: agent.id }) : undefined}
                    />
                  </View>
                ) : null}
              </Fragment>
            );
          })
        )}
      </View>
      {rest > 0 ? (
        <View style={{ alignItems: "center" }}>
          <Button
            theme={theme}
            label={`더 보기 (${rest}개 남음)`}
            accessibilityLabel={`${Math.min(rest, PAGE_SIZE)}개 더 보기`}
            onPress={() => setVisible((current) => current + PAGE_SIZE)}
          />
        </View>
      ) : null}
    </>
  );

  const measure = (event: { nativeEvent: { layout: { width: number } } }) => setWidth(event.nativeEvent.layout.width);

  if (sideFilters) {
    return (
      <View ref={screenRef} style={styles.screen} onLayout={measure}>
        <View style={styles.split}>
          {/* 창이 낮을 때만 넘치는 정도라 스크롤은 남기고, 넘칠 때마다 스크롤바가 생겼다 사라지지 않게 숨긴다. */}
          <ScrollView style={styles.side} contentContainerStyle={styles.sideContent} showsVerticalScrollIndicator={false}>
            {search}
            <View style={styles.sideGroup}>
              <Text style={styles.sideTitle}>정렬</Text>
              {sortControl}
            </View>
            {shown.map((section) => (
              <View key={section.key} style={styles.sideGroup}>
                <Text style={styles.sideTitle}>{section.title}</Text>
                {section.options.map((option) => (
                  <OptionRow
                    key={option.value}
                    theme={theme}
                    kind={section.kind}
                    label={option.label}
                    count={option.count}
                    checked={option.checked}
                    onPress={() => select(section.key, option.value)}
                  />
                ))}
              </View>
            ))}
          </ScrollView>
          <ScrollView style={styles.main} contentContainerStyle={styles.mainContent}>
            {header}
            {appliedRow}
            {list}
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <View ref={screenRef} style={styles.screen} onLayout={measure}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {header}
        {search}
        <View style={styles.chips}>
          <Text style={styles.chipLabel}>정렬</Text>
          {sortControl}
        </View>
        {shown.map((section) => (
          <View key={section.key} style={styles.chips}>
            <Text style={styles.chipLabel}>{section.title}</Text>
            {section.options.map((option) => (
              <Chip
                key={option.value}
                theme={theme}
                kind={section.kind}
                label={`${option.label} ${option.count}`}
                checked={option.checked}
                muted={option.count === 0}
                accessibilityLabel={`${section.title} ${option.label} ${option.count}건`}
                onPress={() => select(section.key, option.value)}
              />
            ))}
          </View>
        ))}
        <View style={styles.results}>
          {appliedRow}
          {list}
        </View>
      </ScrollView>
    </View>
  );
}

function AgentRow({
  agent,
  theme,
  now,
  last,
  tabbable,
  previewing,
  rowRef,
  onFocus,
  onKey,
  onPress,
}: {
  agent: HistoryAgent;
  theme: PluginTheme;
  now: number;
  last: boolean;
  tabbable: boolean;
  previewing: boolean;
  rowRef: (node: View | null) => void;
  onFocus: () => void;
  onKey: (key: string) => boolean;
  onPress: () => void;
}) {
  const [hovered, hoverProps] = useHover();
  const [focused, setFocused] = useState(false);
  const title = agent.title ?? "제목 없음";
  const meta = [agent.projectName, agent.place, agent.provider, agent.archived ? "아카이브" : null].filter(Boolean).join(" · ");
  return (
    <Pressable
      ref={rowRef}
      focusable={tabbable}
      onFocus={() => {
        setFocused(true);
        onFocus();
      }}
      onBlur={() => setFocused(false)}
      {...webKeyDown(onKey)}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${STATUS_LABELS[agent.status]}${agent.requiresAttention ? ", 확인 필요" : ""}, ${meta}`}
      accessibilityState={{ expanded: previewing }}
      onPress={onPress}
      {...hoverProps}
      style={({ pressed }) => ({
        gap: SPACE.xs,
        paddingVertical: SPACE.md,
        paddingHorizontal: SPACE.lg,
        borderBottomWidth: last ? 0 : 1,
        borderColor: theme.colors.border,
        backgroundColor: hovered || focused || previewing ? theme.colors.surface1 : "transparent",
        // 브라우저 기본 outline 은 목록 상자의 둥근 모서리에서 잘려서, 포커스는 배경과 왼쪽 띠로 보여준다.
        outlineWidth: 0,
        borderLeftWidth: 2,
        borderLeftColor: focused ? theme.colors.accent : "transparent",
        opacity: pressed ? PRESSED_OPACITY : 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor(theme, agent.status) }} />
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            color: agent.archived || agent.title === null ? theme.colors.foregroundMuted : theme.colors.foreground,
            fontSize: 14,
            fontWeight: "600",
          }}
        >
          {title}
        </Text>
        {agent.requiresAttention ? (
          <Text style={{ color: theme.colors.statusWarning, fontSize: 11, fontWeight: "600" }}>확인 필요</Text>
        ) : null}
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>{relativeTime(agent.updatedAt, now)}</Text>
      </View>
      <Text numberOfLines={1} style={{ color: theme.colors.foregroundMuted, fontSize: 12, paddingLeft: SPACE.lg }}>
        {STATUS_LABELS[agent.status]} · {meta}
      </Text>
    </Pressable>
  );
}
