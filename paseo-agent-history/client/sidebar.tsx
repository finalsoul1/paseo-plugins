import type { PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";

export function HistorySidebarItem({ currentScreen, openScreen }: PluginSidebarItemProps) {
  return (
    <SidebarRow
      id="history"
      icon="History"
      label="에이전트 기록"
      active={currentScreen?.screenId === "history"}
      onPress={() => openScreen({ screenId: "history" })}
    />
  );
}
