import { type PluginFilePanelProps, useFileUrl } from "@getpaseo/plugin/client";
import { DocumentFrame, Loading } from "@getpaseo/plugin/client/ui";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { RemoteView } from "./remote-view";

type Mode = "frame" | "remote";

function FramePreview({ file, theme }: Pick<PluginFilePanelProps, "file" | "theme">) {
  const url = useFileUrl(file);
  if (url.status === "loading") return <Loading />;
  if (url.status === "error") {
    return <Text style={{ color: theme.colors.statusDanger, padding: 12 }}>{url.error.message}</Text>;
  }
  return <DocumentFrame url={url.url} testID="remote-browser-frame" />;
}

export function HtmlPanel({ file, theme, layout }: PluginFilePanelProps) {
  const [mode, setMode] = useState<Mode>("frame");
  const styles = useMemo(
    () => ({
      root: { flex: 1, backgroundColor: theme.colors.surface0 },
      tabs: {
        flexDirection: "row" as const,
        gap: 6,
        padding: 6,
        borderBottomWidth: 1,
        borderColor: theme.colors.border,
      },
      tab: (active: boolean) => ({
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: active ? theme.colors.accent : theme.colors.surface2,
      }),
      tabText: (active: boolean) => ({
        color: active ? theme.colors.accentForeground : theme.colors.foreground,
        fontSize: 13,
      }),
    }),
    [theme],
  );

  const options: { mode: Mode; label: string }[] = [
    { mode: "frame", label: "미리보기 (JS 없음)" },
    { mode: "remote", label: "원격 Chrome" },
  ];

  return (
    <View style={styles.root}>
      <View style={styles.tabs}>
        {options.map((option) => (
          <Pressable key={option.mode} style={styles.tab(mode === option.mode)} onPress={() => setMode(option.mode)}>
            <Text style={styles.tabText(mode === option.mode)}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
      {mode === "frame" ? (
        <FramePreview file={file} theme={theme} />
      ) : (
        <RemoteView initialUrl={`file://${encodeURI(file.path)}`} theme={theme} layout={layout} />
      )}
    </View>
  );
}
