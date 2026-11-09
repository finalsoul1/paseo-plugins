import type { PluginClientContext } from "@getpaseo/plugin/client";
import { addScreenShortcut } from "paseo-ui-kit";
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
  return addScreenShortcut("y", "/plugin/paseo-agent-history/surface/history", () => client.openScreen({ screenId: "history" }));
}
