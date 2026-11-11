import type { PluginTheme } from "@getpaseo/plugin";
import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { PRESSED_OPACITY, SPACE, useHover, webKeyDown } from "paseo-ui-kit";
import type { AgentStatus, HistoryAgent } from "./filters";

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

export function AgentRow({
  agent,
  theme,
  time,
  now,
  last,
  tabbable,
  previewing,
  accessibilityLabel,
  rowRef,
  onFocus,
  onKey,
  onPress,
  children,
}: {
  agent: HistoryAgent;
  theme: PluginTheme;
  time: number;
  now: number;
  last: boolean;
  tabbable: boolean;
  previewing: boolean;
  accessibilityLabel: string;
  rowRef: (node: View | null) => void;
  onFocus: () => void;
  onKey: (key: string) => boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const [hovered, hoverProps] = useHover();
  const [focused, setFocused] = useState(false);
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
      accessibilityLabel={accessibilityLabel}
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
          {agent.title ?? "제목 없음"}
        </Text>
        {agent.requiresAttention ? (
          <Text style={{ color: theme.colors.statusWarning, fontSize: 11, fontWeight: "600" }}>확인 필요</Text>
        ) : null}
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>{relativeTime(time, now)}</Text>
      </View>
      {children}
    </Pressable>
  );
}
