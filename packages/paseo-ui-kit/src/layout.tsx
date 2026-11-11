import type { PluginTheme } from "@getpaseo/plugin";
import { useState, type ReactNode } from "react";
import { ScrollView, Text, View, type TextStyle } from "react-native";
import { SPACE } from "./space";

export const CONTENT_MAX_WIDTH = 960;
export const SIDE_WIDTH = 220;
// 왼쪽 칸을 두려면 콘텐츠 최대 폭과 왼쪽 칸에 양옆 여백까지 들어가야 한다.
const SIDE_MARGIN = 120;

// 앱 사이드바가 열려 있으면 화면이 창보다 좁아서, 창 크기가 아니라 화면의 실제 폭으로 왼쪽 칸을 둘지 정한다.
// ready 는 폭을 잰 뒤 true 다. 그전에는 좁은 배치로 그린다.
export function useSideLayout(compact: boolean) {
  const [width, setWidth] = useState(0);
  return {
    side: !compact && width >= CONTENT_MAX_WIDTH + SIDE_WIDTH + SIDE_MARGIN,
    ready: width > 0,
    onLayout: (event: { nativeEvent: { layout: { width: number } } }) => setWidth(event.nativeEvent.layout.width),
  };
}

// 좁은 배치의 본문 폭과 여백이다. 넓은 배치에서는 SideSplit 을 쓴다.
export function contentStyle(compact: boolean) {
  return {
    width: "100%" as const,
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center" as const,
    padding: compact ? SPACE.lg : SPACE.xl,
  };
}

// 넓은 배치: 왼쪽 칸(스크롤)과 본문. 본문은 화면마다 스크롤·겹침 요소가 달라서 children 으로 그대로 받는다.
export function SideSplit({
  side,
  sideGap,
  hideSideScrollbar = false,
  children,
}: {
  side: ReactNode;
  sideGap: number;
  hideSideScrollbar?: boolean;
  children: ReactNode;
}) {
  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        width: "100%",
        maxWidth: CONTENT_MAX_WIDTH + SIDE_WIDTH + SPACE.xl,
        alignSelf: "center",
        gap: SPACE.xl,
        paddingHorizontal: SPACE.xl,
      }}
    >
      <ScrollView
        style={{ width: SIDE_WIDTH, flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{ paddingVertical: SPACE.xl, gap: sideGap }}
        showsVerticalScrollIndicator={!hideSideScrollbar}
      >
        {side}
      </ScrollView>
      {children}
    </View>
  );
}

export function SideTitle({ theme, children, style }: { theme: PluginTheme; children: ReactNode; style?: TextStyle }) {
  return (
    <Text
      style={[
        { color: theme.colors.foregroundMuted, fontSize: 11, fontWeight: "600", letterSpacing: 0.4, marginBottom: SPACE.xs },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
