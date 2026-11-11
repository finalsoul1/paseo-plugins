import type { PluginTheme } from "@getpaseo/plugin";
import { useState, type Ref } from "react";
import { Text, TextInput, View, type TextInputProps } from "react-native";
import { SPACE } from "./space";
import { shortcutLabel } from "./web";

type Props = Omit<TextInputProps, "style" | "placeholderTextColor"> & {
  theme: PluginTheme;
  inputRef: Ref<TextInput>;
  value: string;
};

// 목록 화면 맨 위 입력칸이다. 비어 있고 포커스가 없으면 오른쪽에 ⌘L 힌트를 둔다(useScreenKeys 의 ⌘L 과 짝).
export function SearchInput({ theme, inputRef, value, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const hint = shortcutLabel("l");
  return (
    <View style={{ justifyContent: "center" }}>
      <TextInput
        {...rest}
        ref={inputRef}
        value={value}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        placeholderTextColor={theme.colors.foregroundMuted}
        style={{
          paddingVertical: SPACE.sm,
          paddingHorizontal: SPACE.md,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: focused ? theme.colors.accent : theme.colors.border,
          backgroundColor: theme.colors.surface2,
          color: theme.colors.foreground,
          fontSize: 13,
          // 브라우저 기본 포커스 outline 은 왼쪽 칸 ScrollView 가장자리에서 잘려 깨져 보인다. 테두리 색으로 대신 표시한다.
          outlineWidth: 0,
        }}
      />
      {hint && !focused && !value ? (
        <Text style={{ position: "absolute", right: SPACE.md, color: theme.colors.foregroundMuted, fontSize: 12 }} pointerEvents="none">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
