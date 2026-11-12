import type { PluginButtonIconProps, PluginButtonRegistration, PluginClientContext } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { isOnTop } from "paseo-ui-kit";
import { useEffect, useRef } from "react";
import { View } from "react-native";
import { claimAutoOpen, getAutoOpened } from "../shared";

// 앱은 들렀던 워크스페이스 화면을 숨긴 채 마운트해 둘 수 있다(reload 직후 5곳이 한꺼번에 열렸다). 그래서 실제로 보이는지 1초마다 확인한다.
const VISIBILITY_POLL_MS = 1_000;

// 워크스페이스를 처음 볼 때 Explorer 의 참조 탭(panelId)을 한 번 열어 둔다. 그 뒤로 닫거나 바꾸는 것은 건드리지 않는다.
// openPanel 은 그 워크스페이스로 화면을 옮긴다. 그래서 워크스페이스가 생길 때가 아니라, 그 워크스페이스 헤더 버튼이
// 화면에 보일 때 연다. 이미 보고 있는 화면이라 옮겨지지 않는다. 열고 나면 버튼을 지운다.
export function contributeRefsAutoOpen(client: PluginClientContext, { panelId }: { panelId: string }): () => void {
  const lifetime = new AbortController();
  const buttons = new Map<string, PluginButtonRegistration>();
  const done = new Set<string>();
  let release: (() => Promise<void>) | null = null;

  const removeButton = (workspaceId: string) => {
    buttons.get(workspaceId)?.remove();
    buttons.delete(workspaceId);
  };

  function OpenOnShow({ workspaceId, layout, size, color }: PluginButtonIconProps) {
    const ref = useRef<View>(null);
    useEffect(() => {
      // 휴대폰에서는 Explorer 가 대화를 덮으므로 자동으로 열지 않는다. 버튼은 남아 있어 눌러서 열 수 있다.
      if (layout.compact) return;
      const timer = setInterval(() => {
        if (done.has(workspaceId) || !isOnTop(ref.current)) return;
        done.add(workspaceId);
        clearInterval(timer);
        client
          .rpc(claimAutoOpen, { workspaceId })
          .then(({ open }) => {
            if (open && !lifetime.signal.aborted) client.openPanel(panelId, { workspaceId, location: "explorer" });
          })
          .catch((error: unknown) => console.error("refs auto-open failed", error))
          .finally(() => removeButton(workspaceId));
      }, VISIBILITY_POLL_MS);
      return () => clearInterval(timer);
    }, [workspaceId, layout.compact]);
    return (
      <View ref={ref}>
        <Icon name="Link" size={size} color={color} />
      </View>
    );
  }

  const consider = (workspace: { id: string; archivingAt: string | null }) => {
    if (workspace.archivingAt || done.has(workspace.id) || buttons.has(workspace.id)) return;
    buttons.set(
      workspace.id,
      client.addHeaderButton({
        id: "refs-auto-open",
        workspaceId: workspace.id,
        button: {
          title: "참조 열기",
          icon: OpenOnShow,
          behavior: { kind: "action", onPress: () => client.openPanel(panelId, { workspaceId: workspace.id, location: "explorer" }) },
        },
      }),
    );
  };

  void (async () => {
    const { opened } = await client.rpc(getAutoOpened, {});
    for (const id of opened) done.add(id);
    const { entries, subscription } = await client.paseo.workspaces.list({ subscribe: {} });
    if (lifetime.signal.aborted) {
      void subscription?.release();
      return;
    }
    release = subscription ? () => subscription.release() : null;
    for (const workspace of entries) consider(workspace);
    subscription?.subscribe({
      snapshot: (snapshot) => {
        for (const workspace of snapshot.entries) consider(workspace);
      },
      update: (message) => {
        if (message.type !== "workspace_update") return;
        const update = message.payload;
        if (update.kind === "remove") removeButton(update.id);
        else consider(update.workspace);
      },
    });
  })().catch((error: unknown) => {
    if (!lifetime.signal.aborted) console.error("refs auto-open observation failed", error);
  });

  return () => {
    lifetime.abort();
    void release?.();
    for (const id of [...buttons.keys()]) removeButton(id);
  };
}
