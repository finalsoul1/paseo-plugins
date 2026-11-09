import type { PluginTheme } from "@getpaseo/plugin";
import { Text, View } from "react-native";
import { shortcutLabel, useModifierHeld } from "./web";

// Paseo 사이드바 배지처럼 Cmd 를 누르고 있을 때만 보인다. 배지가 나타나도 행 글자가 밀리지 않도록 자리는 늘 차지한다.
export function ShortcutBadge({ theme, letter }: { theme: PluginTheme; letter: string }) {
  const held = useModifierHeld();
  if (shortcutLabel(letter) === null) return null;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        minWidth: 18,
        height: 18,
        paddingHorizontal: 4,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 4,
        borderWidth: 1,
        borderColor: theme.colors.surface2,
        backgroundColor: theme.colors.surface0,
        opacity: held ? 1 : 0,
      }}
    >
      <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12, fontWeight: "500", lineHeight: 14 }}>{letter.toUpperCase()}</Text>
    </View>
  );
}
