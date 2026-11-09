import type { PluginClientContext } from "@getpaseo/plugin/client";
import { addWebShortcut, goBack, isRouteOpen } from "paseo-ui-kit";
import { HistoryScreen } from "./client/history-screen";
import { HistorySidebarItem } from "./client/sidebar";

export default function contribute(client: PluginClientContext) {
  client.addScreen({ id: "history", title: "에이전트 기록", Component: HistoryScreen });
  client.addSidebarHeaderItem({ id: "history", title: "에이전트 기록", Component: HistorySidebarItem });
  client.addCommandCenterItem({
    id: "open-history",
    title: "에이전트 기록 열기",
    icon: "History",
    keywords: ["history", "agent", "archive", "기록", "에이전트", "아카이브"],
    context: "global",
    onSelect: ({ openScreen }) => openScreen({ screenId: "history" }),
  });
  // ⌘Y는 브라우저의 방문 기록 단축키다. ⌘H는 macOS 「Paseo 가리기」라 쓰지 않는다.
  // 기록 화면에서 한 번 더 누르면 열기 전 화면으로 돌아간다.
  return addWebShortcut("y", () => {
    if (isRouteOpen("/plugin/paseo-agent-history/surface/history")) goBack();
    else client.openScreen({ screenId: "history" });
    return true;
  });
}
