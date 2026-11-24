import type { PluginTheme } from "@getpaseo/plugin";
import type { Ref } from "react";
import { Text, View, type NativeSyntheticEvent, type TextInput, type TextInputKeyPressEventData } from "react-native";
import { Button, SearchInput, SPACE } from "paseo-ui-kit";

interface Props {
  theme: PluginTheme;
  inputRef: Ref<TextInput>;
  query: string;
  result: { total: number; current: number } | null;
  onChangeQuery(query: string): void;
  onStep(delta: 1 | -1): void;
  onClose(): void;
}

// React Native Web 이 넘기는 키 이벤트다. RN 타입에는 shiftKey·preventDefault 가 없다.
type WebKeyPress = NativeSyntheticEvent<TextInputKeyPressEventData & { shiftKey?: boolean; isComposing?: boolean; keyCode?: number }> & {
  shiftKey?: boolean;
  preventDefault?: () => void;
};

export function FindBar({ theme, inputRef, query, result, onChangeQuery, onStep, onClose }: Props) {
  const status = !query || !result ? "" : result.total === 0 ? "결과 없음" : `${result.current + 1}/${result.total}`;
  const canStep = !!result && result.total > 0;

  const onKeyPress = (event: WebKeyPress) => {
    const native = event.nativeEvent;
    // 한글 조합 중에 누른 Enter 는 글자를 확정하는 키다.
    if (native.isComposing || native.keyCode === 229) return;
    if (native.key === "Enter") {
      // 막지 않으면 React Native Web 이 Enter 뒤에 입력칸 포커스를 뺀다.
      event.preventDefault?.();
      onStep((event.shiftKey ?? native.shiftKey) ? -1 : 1);
    } else if (native.key === "Escape") {
      event.preventDefault?.();
      onClose();
    }
  };

  return (
    <View
      style={{
        position: "absolute",
        top: SPACE.sm,
        right: SPACE.lg,
        maxWidth: "100%",
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.xs,
        padding: SPACE.xs,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface1,
      }}
    >
      <View style={{ width: 200, flexShrink: 1 }}>
        <SearchInput
          theme={theme}
          inputRef={inputRef}
          value={query}
          onChangeText={onChangeQuery}
          onKeyPress={onKeyPress}
          placeholder="찾기"
          accessibilityLabel="문서에서 찾기"
          shortcutHint={false}
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
        />
      </View>
      <Text style={{ minWidth: 56, color: theme.colors.foregroundMuted, fontSize: 12, textAlign: "center" }} accessibilityLiveRegion="polite">
        {status}
      </Text>
      <Button theme={theme} variant="tertiary" icon="ChevronUp" accessibilityLabel="이전 결과" onPress={() => onStep(-1)} disabled={!canStep} />
      <Button theme={theme} variant="tertiary" icon="ChevronDown" accessibilityLabel="다음 결과" onPress={() => onStep(1)} disabled={!canStep} />
      <Button theme={theme} variant="tertiary" icon="X" accessibilityLabel="찾기 닫기" onPress={onClose} />
    </View>
  );
}
