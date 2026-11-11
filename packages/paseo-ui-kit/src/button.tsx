import type { PluginTheme } from "@getpaseo/plugin";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { ActivityIndicator, Pressable, Text } from "react-native";
import { PRESSED_OPACITY, useHover } from "./hover";
import { SPACE } from "./space";

// Helios Button 위계를 따른다. primary 는 화면에서 가장 중요한 동작 하나, tertiary 는 아이콘이 붙은 가벼운 동작이다.
export type ButtonVariant = "primary" | "secondary" | "tertiary";

interface Props {
  theme: PluginTheme;
  label?: string;
  icon?: string;
  accessibilityLabel: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
}

export function Button({ theme, label, icon, accessibilityLabel, onPress, variant = "secondary", disabled: disabledProp, loading }: Props) {
  const [hovered, hoverProps] = useHover();
  const disabled = disabledProp || loading;
  const active = hovered && !disabled;
  const color = variant === "primary" ? theme.colors.accentForeground : theme.colors.foreground;
  const iconColor = variant === "tertiary" && !active ? theme.colors.foregroundMuted : color;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={disabled}
      onPress={onPress}
      {...hoverProps}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: SPACE.xs,
        height: 28,
        ...(label ? { paddingHorizontal: SPACE.md } : { width: 28 }),
        borderRadius: 6,
        borderWidth: variant === "secondary" ? 1 : 0,
        borderColor: active ? theme.colors.foregroundMuted : theme.colors.border,
        backgroundColor: variant === "primary" ? theme.colors.accent : active ? theme.colors.surface2 : "transparent",
        opacity: loading ? 0.8 : disabled ? 0.5 : pressed ? PRESSED_OPACITY : active && variant === "primary" ? 0.88 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator size="small" color={iconColor} style={{ width: 14, height: 14 }} />
      ) : icon ? (
        <Icon name={icon} size={14} color={iconColor} />
      ) : null}
      {label ? <Text style={{ color, fontSize: 12, fontWeight: variant === "primary" ? "600" : "400" }}>{label}</Text> : null}
    </Pressable>
  );
}
