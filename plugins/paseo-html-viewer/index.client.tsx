import type { PluginClientContext } from "@getpaseo/plugin/client";
import { HtmlPanel } from "./client/panel";

export default function contribute(client: PluginClientContext) {
  const removePanel = client.addFilePanel({
    id: "html",
    title: "HTML (검색)",
    icon: "FileCode",
    files: { extensions: ["html", "htm"] },
    Component: HtmlPanel,
  });
  return () => removePanel();
}
