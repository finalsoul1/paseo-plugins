import type { PluginTheme } from "@getpaseo/plugin";
import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import {
  Button,
  Chip,
  contentStyle,
  inputListKey,
  listNavKey,
  LoadingText,
  SearchInput,
  Segmented,
  SideSplit,
  SideTitle,
  SPACE,
  useScreenKeys,
  useSideLayout,
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
  type Filters,
  type FilterSection,
  type HistoryAgent,
  type SortKey,
} from "./filters";
import { AgentPreviewPane } from "./preview";
import { useAgentHistory } from "./queries";
import { AgentRow } from "./row";

// 아카이브까지 받으면 수백 개라, 필터를 누를 때마다 전부 다시 그리지 않도록 "더 보기"로 늘린다.
const PAGE_SIZE = 100;

export function HistoryScreen({ theme, layout, navigation }: PluginScreenProps) {
  const history = useAgentHistory();
  const { side: sideFilters, ready, onLayout } = useSideLayout(layout.compact);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortKey>("updated");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [activeIndex, setActiveIndex] = useState(0);
  const [previewId, setPreviewId] = useState<string | null>(null);
  useEffect(() => {
    setVisible(PAGE_SIZE);
    setActiveIndex(0);
  }, [filters, sort]);
  const screenRef = useRef<View>(null);
  const searchRef = useRef<TextInput>(null);
  const rowRefs = useRef(new Map<string, View>());
  useScreenKeys({ screenRef, inputRef: searchRef, ready });

  const styles = useMemo(
    () => ({
      screen: { flex: 1, backgroundColor: theme.colors.surface0 },
      content: { ...contentStyle(layout.compact), gap: SPACE.sm },
      header: { flexDirection: "row" as const, alignItems: "center" as const, gap: SPACE.sm },
      title: { color: theme.colors.foreground, fontSize: layout.compact ? 18 : 20, fontWeight: "600" as const },
      muted: { color: theme.colors.foregroundMuted, fontSize: 12, flex: 1 },
      error: { color: theme.colors.statusDanger, fontSize: 13 },
      // 줄바꿈된 칩끼리는 필터 줄 사이(SPACE.sm)보다 가까워야 같은 그룹으로 읽힌다.
      chips: {
        flexDirection: "row" as const,
        flexWrap: "wrap" as const,
        alignItems: "center" as const,
        rowGap: SPACE.xs,
        columnGap: SPACE.sm,
      },
      chipLabel: { color: theme.colors.foregroundMuted, fontSize: 11, fontWeight: "600" as const, width: 64 },
      sideGroup: { gap: SPACE.xs },
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
  const onRowKey = (index: number, key: string): boolean => {
    if (key === "Escape") {
      searchRef.current?.focus();
      return true;
    }
    return listNavKey(key, index, shownRows.length, focusRow, () => searchRef.current?.focus());
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

  const search = (
    <SearchInput
      theme={theme}
      inputRef={searchRef}
      value={filters.query}
      onChangeText={(text) => setFilters((current) => ({ ...current, query: text }))}
      onKeyPress={({ nativeEvent }) =>
        inputListKey(nativeEvent.key, {
          hasValue: !!filters.query,
          clear: () => setFilters((current) => ({ ...current, query: "" })),
          blur: () => searchRef.current?.blur(),
          focusFirstRow: () => focusRow(0),
        })
      }
      onSubmitEditing={() => focusRow(0)}
      placeholder={sideFilters ? "제목, 프로젝트, 브랜치 검색" : "제목, 프로젝트, 브랜치, 경로로 거르기 (아래 화살표로 목록 이동)"}
      accessibilityLabel="제목, 프로젝트, 브랜치, 경로로 거르기"
      autoCorrect={false}
    />
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
                  time={agent.updatedAt}
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
                  accessibilityLabel={`${agent.title ?? "제목 없음"}, ${STATUS_LABELS[agent.status]}${agent.requiresAttention ? ", 확인 필요" : ""}, ${rowMeta(agent)}`}
                >
                  <Text numberOfLines={1} style={{ color: theme.colors.foregroundMuted, fontSize: 12, paddingLeft: SPACE.lg }}>
                    {STATUS_LABELS[agent.status]} · {rowMeta(agent)}
                  </Text>
                </AgentRow>
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

  if (sideFilters) {
    return (
      <View ref={screenRef} style={styles.screen} onLayout={onLayout}>
        {/* 창이 낮을 때만 넘치는 정도라 스크롤은 남기고, 넘칠 때마다 스크롤바가 생겼다 사라지지 않게 숨긴다. */}
        <SideSplit
          sideGap={SPACE.lg}
          hideSideScrollbar
          side={
            <>
              {search}
              <View style={styles.sideGroup}>
                <SideTitle theme={theme}>정렬</SideTitle>
                {sortControl}
              </View>
              {shown.map((section) => (
                <View key={section.key} style={styles.sideGroup}>
                  <SideTitle theme={theme}>{section.title}</SideTitle>
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
            </>
          }
        >
          <ScrollView style={styles.main} contentContainerStyle={styles.mainContent}>
            {header}
            {appliedRow}
            {list}
          </ScrollView>
        </SideSplit>
      </View>
    );
  }

  return (
    <View ref={screenRef} style={styles.screen} onLayout={onLayout}>
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

function rowMeta(agent: HistoryAgent): string {
  return [agent.projectName, agent.place, agent.provider, agent.archived ? "아카이브" : null].filter(Boolean).join(" · ");
}
