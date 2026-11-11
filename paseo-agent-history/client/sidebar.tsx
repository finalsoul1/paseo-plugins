import type { PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { ShortcutBadge } from "paseo-ui-kit";
import { Text } from "react-native";
import { GROUPS, type AwaitingGroup } from "./awaiting";
import { useAwaitingAgents } from "./queries";

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

const GROUP_ICONS: Record<AwaitingGroup, string> = {
  permission: "ShieldAlert",
  error: "CircleAlert",
  new: "Inbox",
  seen: "CheckCheck",
};

export function AwaitingSidebarItem({ theme, currentScreen, openScreen }: PluginSidebarItemProps) {
  const { rows } = useAwaitingAgents();
  const onScreen = currentScreen?.screenId === "awaiting";
  const groups = GROUPS.map((group) => ({ ...group, count: rows?.filter((row) => row.group === group.key).length ?? 0 })).filter(
    (group) => group.count > 0,
  );
  if (groups.length === 0) {
    return <SidebarRow id="awaiting" icon="Inbox" label="판단 대기" active={onScreen} onPress={() => openScreen({ screenId: "awaiting" })} />;
  }
  const countColor: Record<AwaitingGroup, string> = {
    permission: theme.colors.statusWarning,
    error: theme.colors.statusDanger,
    new: theme.colors.statusWarning,
    seen: theme.colors.foregroundMuted,
  };
  return (
    <>
      {groups.map((group) => (
        <SidebarRow
          key={group.key}
          id={`awaiting-${group.key}`}
          icon={GROUP_ICONS[group.key]}
          label={group.title}
          active={onScreen && currentScreen.params.group === group.key}
          onPress={() => openScreen({ screenId: "awaiting", params: { group: group.key } })}
          trailing={<Text style={{ color: countColor[group.key], fontSize: 12, fontWeight: "600" }}>{group.count}</Text>}
        />
      ))}
    </>
  );
}
