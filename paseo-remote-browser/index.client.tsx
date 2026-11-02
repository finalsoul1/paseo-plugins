import type {
  PluginClientContext,
  PluginScreenProps,
  PluginSidebarItemProps,
  PluginWorkspacePanelProps,
} from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { HtmlPanel } from "./client/html-panel";
import { normalizeUrl, RemoteView } from "./client/remote-view";

const DEFAULT_URL = "http://localhost:3000";

function BrowserPanel({ theme, layout }: PluginWorkspacePanelProps) {
  return <RemoteView initialUrl={DEFAULT_URL} theme={theme} layout={layout} />;
}

function BrowserScreen({ theme, layout, params }: PluginScreenProps) {
  const url = params.url ?? DEFAULT_URL;
  return <RemoteView key={url} initialUrl={url} theme={theme} layout={layout} />;
}

function BrowserSidebarItem({ currentScreen, openScreen }: PluginSidebarItemProps) {
  return (
    <SidebarRow
      icon="Globe"
      active={currentScreen?.screenId === "browser"}
      onPress={() => openScreen({ screenId: "browser" })}
    />
  );
}

export default function contribute(client: PluginClientContext) {
  const removers = [
    client.addScreen({ id: "browser", title: "원격 브라우저", Component: BrowserScreen }),
    client.addSidebarHeaderItem({ id: "browser", title: "원격 브라우저", Component: BrowserSidebarItem }),
    client.addSlashCommand({
      name: "browse",
      description: "원격 브라우저로 URL이나 파일 경로를 연다",
      argumentHint: "[localhost:3000 | /path/to/file.html]",
      context: "agent",
      onSubmit({ args, openScreen }) {
        openScreen({ screenId: "browser", params: { url: args ? normalizeUrl(args) : DEFAULT_URL } });
      },
    }),
    client.addFilePanel({
      id: "html",
      title: "HTML (원격 브라우저 시험)",
      icon: "Globe",
      files: { extensions: ["html", "htm"] },
      Component: HtmlPanel,
    }),
    client.addWorkspacePanel({
      id: "browser",
      title: "원격 브라우저",
      icon: "Globe",
      Component: BrowserPanel,
    }),
    client.addCommandCenterItem({
      id: "open-browser",
      title: "원격 브라우저 열기",
      icon: "Globe",
      context: "workspace",
      onSelect({ openPanel }) {
        openPanel("browser");
      },
    }),
  ];
  return () => {
    for (const remove of removers) remove();
  };
}
