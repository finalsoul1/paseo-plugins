import type { PluginClientContext } from "@getpaseo/plugin/client";
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
  return () => {};
}
