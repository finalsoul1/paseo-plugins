import type { PluginTheme } from "@getpaseo/plugin";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { tint } from "./color";
import { PRESSED_OPACITY, useHover } from "./hover";
import { SPACE } from "./space";

export type Kind = "radio" | "checkbox";

export function LoadingText({ theme, label }: { theme: PluginTheme; label: string }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
      <ActivityIndicator size="small" color={theme.colors.foregroundMuted} />
      <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

export function Chip({
  theme,
  kind,
  label,
  checked,
  muted,
  accessibilityLabel,
  onPress,
}: {
  theme: PluginTheme;
  kind: Kind;
  label: string;
  checked: boolean;
  muted?: boolean;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const [hovered, hoverProps] = useHover();
  return (
    <Pressable
      accessibilityRole={kind}
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      {...hoverProps}
      style={({ pressed }) => ({
        height: 26,
        justifyContent: "center",
        paddingHorizontal: SPACE.md,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: checked ? theme.colors.accent : hovered ? theme.colors.foregroundMuted : theme.colors.border,
        backgroundColor: checked
          ? hovered
            ? tint(theme.colors.accent, 0.12, theme.colors.surface2)
            : theme.colors.surface2
          : hovered
            ? theme.colors.surface2
            : "transparent",
        opacity: pressed ? PRESSED_OPACITY : 1,
      })}
    >
      <Text
        style={{
          color: muted && !checked ? theme.colors.foregroundMuted : theme.colors.foreground,
          fontSize: 12,
          fontWeight: checked ? "600" : "400",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Segmented<Key extends string>({
  theme,
  groupLabel,
  options,
  value,
  onChange,
}: {
  theme: PluginTheme;
  groupLabel: string;
  options: readonly { key: Key; label: string }[];
  value: Key;
  onChange: (key: Key) => void;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={groupLabel}
      style={{
        flexDirection: "row",
        alignSelf: "flex-start",
        padding: 2,
        borderRadius: 7,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      {options.map((option) => (
        <SegmentOption
          key={option.key}
          theme={theme}
          label={option.label}
          selected={option.key === value}
          onPress={() => onChange(option.key)}
        />
      ))}
    </View>
  );
}

function SegmentOption({
  theme,
  label,
  selected,
  onPress,
}: {
  theme: PluginTheme;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const [hovered, hoverProps] = useHover();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      {...hoverProps}
      style={({ pressed }) => ({
        // 바깥 테두리 1과 안쪽 여백 2를 더해 칩과 같은 26이 되게 한다.
        height: 20,
        justifyContent: "center",
        paddingHorizontal: SPACE.md,
        borderRadius: 5,
        backgroundColor: selected ? theme.colors.surface2 : hovered ? theme.colors.surface1 : "transparent",
        opacity: pressed ? PRESSED_OPACITY : 1,
      })}
    >
      <Text
        style={{
          color: selected || hovered ? theme.colors.foreground : theme.colors.foregroundMuted,
          fontSize: 12,
          fontWeight: selected ? "600" : "400",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
