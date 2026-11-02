import type { PluginTheme } from "@getpaseo/plugin";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { PRESSED_OPACITY, SPACE, tint, useHover, type Kind } from "paseo-ui-kit";
import { Pressable, Text, View } from "react-native";

export function OptionRow({
  theme,
  kind,
  label,
  count,
  checked,
  onPress,
}: {
  theme: PluginTheme;
  kind: Kind;
  label: string;
  count: number;
  checked: boolean;
  onPress: () => void;
}) {
  const [hovered, hoverProps] = useHover();
  return (
    <Pressable
      accessibilityRole={kind}
      accessibilityState={{ checked }}
      accessibilityLabel={`${label} ${count}건`}
      onPress={onPress}
      {...hoverProps}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.sm,
        paddingVertical: SPACE.xs,
        paddingHorizontal: SPACE.sm,
        borderRadius: 6,
        backgroundColor: checked
          ? hovered
            ? tint(theme.colors.accent, 0.08, theme.colors.surface2)
            : theme.colors.surface2
          : hovered
            ? theme.colors.surface1
            : "transparent",
        opacity: pressed ? PRESSED_OPACITY : 1,
      })}
    >
      <View
        style={{
          width: 14,
          height: 14,
          borderRadius: kind === "radio" ? 7 : 3,
          borderWidth: 1,
          borderColor: checked ? theme.colors.accent : hovered ? theme.colors.foregroundMuted : theme.colors.border,
          backgroundColor: checked ? theme.colors.accent : undefined,
        }}
      />
      <Text
        numberOfLines={1}
        style={{ flex: 1, color: count === 0 && !checked ? theme.colors.foregroundMuted : theme.colors.foreground, fontSize: 13 }}
      >
        {label}
      </Text>
      <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>{count}</Text>
    </Pressable>
  );
}

export function AppliedLabel({ theme, label, onPress }: { theme: PluginTheme; label: string; onPress: () => void }) {
  const [hovered, hoverProps] = useHover();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} 조건 풀기`}
      onPress={onPress}
      {...hoverProps}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.xs,
        height: 26,
        paddingHorizontal: SPACE.sm,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: hovered ? theme.colors.foregroundMuted : theme.colors.border,
        backgroundColor: theme.colors.surface2,
        opacity: pressed ? PRESSED_OPACITY : 1,
      })}
    >
      <Text style={{ color: theme.colors.foreground, fontSize: 12 }}>{label}</Text>
      <Icon name="X" size={12} color={hovered ? theme.colors.foreground : theme.colors.foregroundMuted} />
    </Pressable>
  );
}

export function ClearAll({ theme, onPress }: { theme: PluginTheme; onPress: () => void }) {
  const [hovered, hoverProps] = useHover();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="모든 조건 풀기"
      onPress={onPress}
      {...hoverProps}
      style={({ pressed }) => ({ padding: SPACE.xs, opacity: pressed ? PRESSED_OPACITY : 1 })}
    >
      <Text style={{ color: theme.colors.accent, fontSize: 12, textDecorationLine: hovered ? "underline" : "none" }}>
        모두 지우기
      </Text>
    </Pressable>
  );
}
