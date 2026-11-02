import type { PluginTheme } from "@getpaseo/plugin";
import { Button, LoadingText, SPACE } from "paseo-ui-kit";
import { useRef } from "react";
import { ScrollView, Text, View } from "react-native";
import { useAgentPreview } from "./queries";

const MAX_HEIGHT = 360;

export function AgentPreviewPane({
  theme,
  agentId,
  openLabel,
  onOpen,
}: {
  theme: PluginTheme;
  agentId: string;
  openLabel: string;
  onOpen: (() => void) | undefined;
}) {
  const preview = useAgentPreview(agentId);
  const scrollRef = useRef<ScrollView>(null);
  const muted = { color: theme.colors.foregroundMuted, fontSize: 12 };
  const data = preview.data;

  const summary = data
    ? `메시지 ${data.messages.length}개 · 생략 ${data.skipped}개${data.hasOlder ? " · 이전 대화는 에이전트를 열어서 보기" : ""}`
    : "";

  const body = preview.isLoading ? (
    <LoadingText theme={theme} label="대화를 불러오는 중" />
  ) : preview.error ? (
    <Text style={{ color: theme.colors.statusDanger, fontSize: 13 }}>
      미리보기를 불러오지 못했습니다: {preview.error.message}
    </Text>
  ) : !data || data.messages.length === 0 ? (
    <Text style={muted}>저장된 대화가 없습니다.</Text>
  ) : (
    <ScrollView
      ref={scrollRef}
      style={{ maxHeight: MAX_HEIGHT }}
      contentContainerStyle={{ gap: SPACE.md }}
      // 미리보기로 보려는 것은 최근 대화라서 맨 아래부터 보여준다.
      onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
    >
      {data.messages.map((message, index) => (
        <Text
          key={index}
          selectable
          style={{
            color: theme.colors.foreground,
            fontSize: 13,
            lineHeight: 19,
            ...(message.role === "user"
              ? { backgroundColor: theme.colors.surface2, borderRadius: 6, padding: SPACE.sm }
              : null),
          }}
        >
          {message.text}
        </Text>
      ))}
    </ScrollView>
  );

  return (
    <View style={{ gap: SPACE.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
        <Text style={[muted, { flex: 1 }]}>{summary}</Text>
        {onOpen ? <Button theme={theme} label={openLabel} accessibilityLabel={`에이전트 ${openLabel}`} onPress={onOpen} /> : null}
      </View>
      {body}
    </View>
  );
}
