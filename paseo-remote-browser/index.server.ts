import type { PluginServerContext } from "@getpaseo/plugin/server";
import { closeView, openView, sendInput, shutdownChrome, startIdleSweep, waitForFrame } from "./server/chrome";
import * as rpc from "./shared/browser";

export default function contribute(server: PluginServerContext) {
  server.handle(rpc.openView, async ({ viewId, url, width, height, scale }) => {
    await openView(viewId, url, width, height, scale);
    return { ok: true as const };
  });
  server.handle(rpc.nextFrame, ({ viewId, afterSeq }) => waitForFrame(viewId, afterSeq));
  server.handle(rpc.sendInput, async ({ viewId, action }) => {
    await sendInput(viewId, action);
    return { ok: true as const };
  });
  server.handle(rpc.closeView, async ({ viewId }) => {
    await closeView(viewId);
    return { ok: true as const };
  });
  const stopSweep = startIdleSweep();
  return () => {
    stopSweep();
    shutdownChrome();
  };
}
