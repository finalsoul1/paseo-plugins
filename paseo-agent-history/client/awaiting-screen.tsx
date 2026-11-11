import type { PluginTheme } from "@getpaseo/plugin";
import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { goBack, isShown, listNavKey, LoadingText, SPACE, useWebEscape } from "paseo-ui-kit";
import { GROUPS, type AwaitingRow } from "./awaiting";
import { AgentPreviewPane } from "./preview";
import { useAwaitingAgents } from "./queries";
import { AgentRow } from "./row";

const CONTENT_MAX_WIDTH = 960;

export function AwaitingScreen({ theme, layout, navigation, params }: PluginScreenProps) {
  const awaiting = useAwaitingAgents();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const screenRef = useRef<View>(null);
  const rowRefs = useRef(new Map<string, View>());
  useWebEscape(screenRef, () => {
    if (!isShown(screenRef.current)) return false;
    goBack();
    return true;
  });

  const groups = useMemo(
    () =>
      GROUPS.map((group) => ({ ...group, rows: (awaiting.rows ?? []).filter((row) => row.group === group.key) })).filter(
        (group) => group.rows.length > 0,
      ),
    [awaiting.rows],
  );
  const ordered = groups.flatMap((group) => group.rows);

  // 사이드바의 묶음 행으로 열면 그 묶음 위치로 간다. 묶음 위치는 그려진 뒤에야 알 수 있어서 onLayout 에서도 시도한다.
  const scrollRef = useRef<ScrollView>(null);
  const groupY = useRef(new Map<string, number>());
  const scrolledTo = useRef<string | null>(null);
  const target = params.group ?? null;
  const scrollToTarget = () => {
    if (!target || scrolledTo.current === target) return;
    const y = groupY.current.get(target);
    if (y === undefined) return;
    scrolledTo.current = target;
    scrollRef.current?.scrollTo({ y, animated: false });
  };
  useEffect(() => {
    scrolledTo.current = null;
    scrollToTarget();
  }, [target]);
  const tabbable = Math.min(activeIndex, ordered.length - 1);
  const focusRow = (index: number) => {
    const row = ordered[index];
    if (!row) return;
    setActiveIndex(index);
    rowRefs.current.get(row.agent.id)?.focus();
  };
  const now = Date.now();

  const muted = { color: theme.colors.foregroundMuted, fontSize: 12 };
  const listBox = {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    overflow: "hidden" as const,
    backgroundColor: theme.colors.surface0,
  };

  const body = awaiting.error ? (
    <Text style={{ color: theme.colors.statusDanger, fontSize: 13 }}>불러오지 못했습니다: {awaiting.error.message}</Text>
  ) : !awaiting.rows ? (
    <LoadingText theme={theme} label="에이전트 목록을 불러오는 중" />
  ) : ordered.length === 0 && awaiting.pending > 0 ? (
    <LoadingText theme={theme} label="대화를 확인하는 중" />
  ) : ordered.length === 0 ? (
    <View style={listBox}>
      <Text style={{ color: theme.colors.foregroundMuted, fontSize: 13, padding: SPACE.lg }}>기다리는 에이전트가 없습니다.</Text>
    </View>
  ) : (
    groups.map((group) => (
      <View
        key={group.key}
        style={{ gap: SPACE.sm, marginTop: SPACE.md }}
        onLayout={(event) => {
          groupY.current.set(group.key, event.nativeEvent.layout.y);
          if (group.key === target) scrollToTarget();
        }}
      >
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11, fontWeight: "600", letterSpacing: 0.4 }}>
          {group.title} {group.rows.length}
        </Text>
        <View style={listBox}>
          {group.rows.map((row, indexInGroup) => {
            const index = ordered.indexOf(row);
            const last = indexInGroup === group.rows.length - 1;
            const previewing = row.agent.id === previewId;
            return (
              <Fragment key={row.agent.id}>
                <AgentRow
                  agent={row.agent}
                  theme={theme}
                  time={row.waitingSince}
                  now={now}
                  last={last && !previewing}
                  tabbable={index === tabbable}
                  previewing={previewing}
                  accessibilityLabel={`${row.agent.title ?? "제목 없음"}, ${group.title}, ${summaryText(row)}`}
                  rowRef={(node) => {
                    if (node) rowRefs.current.set(row.agent.id, node);
                    else rowRefs.current.delete(row.agent.id);
                  }}
                  onFocus={() => setActiveIndex(index)}
                  onKey={(key) => listNavKey(key, index, ordered.length, focusRow, () => {})}
                  onPress={() => setPreviewId(previewing ? null : row.agent.id)}
                >
                  <Summary theme={theme} row={row} />
                  <Text numberOfLines={1} style={[muted, { paddingLeft: SPACE.lg }]}>
                    {[row.agent.projectName, row.agent.place].filter(Boolean).join(" · ")}
                  </Text>
                </AgentRow>
                {previewing ? (
                  <View
                    style={{
                      paddingVertical: SPACE.md,
                      paddingHorizontal: SPACE.lg,
                      borderBottomWidth: last ? 0 : 1,
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surface1,
                    }}
                  >
                    <AgentPreviewPane
                      theme={theme}
                      agentId={row.agent.id}
                      openLabel="열기"
                      onOpen={navigation ? () => navigation.openAgent({ agentId: row.agent.id }) : undefined}
                      // 목록이 updatedAt 이 바뀔 때마다 대화를 다시 받으므로, 펼칠 때는 받은 것을 그대로 쓴다.
                      staleTime={Infinity}
                    />
                  </View>
                ) : null}
              </Fragment>
            );
          })}
        </View>
      </View>
    ))
  );

  return (
    <View ref={screenRef} style={{ flex: 1, backgroundColor: theme.colors.surface0 }}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          width: "100%",
          maxWidth: CONTENT_MAX_WIDTH,
          alignSelf: "center",
          padding: layout.compact ? SPACE.lg : SPACE.xl,
          gap: SPACE.sm,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
          <Text
            style={{ color: theme.colors.foreground, fontSize: layout.compact ? 18 : 20, fontWeight: "600" }}
            accessibilityRole="header"
          >
            판단 대기
          </Text>
          <Text style={[muted, { flex: 1 }]}>
            {awaiting.rows ? `${ordered.length}개${awaiting.pending > 0 ? ` · ${awaiting.pending}개 확인 중` : ""}` : ""}
          </Text>
        </View>
        {body}
      </ScrollView>
    </View>
  );
}

function summaryText(row: AwaitingRow): string {
  if (row.loadError) return `대화를 불러오지 못함: ${row.loadError}`;
  if (row.summary) return row.summary;
  return row.group === "error" ? "오류 문구가 없습니다." : "마지막 메시지가 비어 있습니다.";
}

function Summary({ theme, row }: { theme: PluginTheme; row: AwaitingRow }) {
  const color = row.loadError ? theme.colors.statusDanger : row.summary ? theme.colors.foreground : theme.colors.foregroundMuted;
  return (
    <Text numberOfLines={2} style={{ color, fontSize: 13, lineHeight: 19, paddingLeft: SPACE.lg }}>
      {summaryText(row)}
    </Text>
  );
}
