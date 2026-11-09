import type { PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { ShortcutBadge } from "paseo-ui-kit";

export function HistorySidebarItem({ theme, currentScreen, openScreen }: PluginSidebarItemProps) {
  return (
    <SidebarRow
      id="history"
      icon="History"
      label="에이전트 기록"
      active={currentScreen?.screenId === "history"}
      onPress={() => openScreen({ screenId: "history" })}
      trailing={<ShortcutBadge theme={theme} letter="y" />}
    />
  );
}
