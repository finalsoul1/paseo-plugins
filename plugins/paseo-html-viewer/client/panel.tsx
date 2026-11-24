import { useFileText, useFileUrl, type PluginFile, type PluginFilePanelProps } from "@getpaseo/plugin/client";
import { DocumentFrame, Loading } from "@getpaseo/plugin/client/ui";
import { useMemo, useRef, useState } from "react";
import { Platform, Text, View, type TextInput } from "react-native";
import { SPACE } from "paseo-ui-kit";
import { buildDocument, type FrameEvent } from "./document";
import { FindBar } from "./find-bar";
import { HtmlFrame, postToFrame, selectAll, useFindShortcut, useFrameEvents, type FrameElement } from "./web";

interface FindResult {
  total: number;
  current: number;
}

export function HtmlPanel(props: PluginFilePanelProps) {
  // iframe 과 postMessage 는 웹에만 있다. 모바일은 Paseo 의 문서 프레임으로 검색 없이 보여 준다.
  if (Platform.OS !== "web") return <NativePanel file={props.file} theme={props.theme} />;
  return <WebPanel {...props} />;
}

function WebPanel({ file, theme }: PluginFilePanelProps) {
  const text = useFileText(file);
  const html = text.status === "ready" ? text.text : null;
  const srcDoc = useMemo(() => (html === null ? null : buildDocument(html)), [html]);

  const containerRef = useRef<View>(null);
  const frameRef = useRef<FrameElement | null>(null);
  const inputRef = useRef<TextInput>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<FindResult | null>(null);

  const focusInput = () => {
    inputRef.current?.focus();
    selectAll(inputRef.current);
  };

  const openFind = () => {
    if (!open) {
      setOpen(true);
      if (query) postToFrame(frameRef.current, { type: "search", query });
    }
    // 검색 바가 처음 그려질 때는 아직 입력칸이 없다. 그린 뒤에 포커스를 옮긴다.
    setTimeout(focusInput, 0);
  };

  const closeFind = () => {
    setOpen(false);
    setResult(null);
    postToFrame(frameRef.current, { type: "clear" });
  };

  const changeQuery = (next: string) => {
    setQuery(next);
    if (next) {
      postToFrame(frameRef.current, { type: "search", query: next });
    } else {
      setResult(null);
      postToFrame(frameRef.current, { type: "clear" });
    }
  };

  const step = (delta: 1 | -1) => postToFrame(frameRef.current, { type: "step", delta });

  useFrameEvents(frameRef, (event: FrameEvent) => {
    if (event.type === "open-find") {
      openFind();
    } else if (event.type === "result") {
      setResult({ total: event.total, current: event.current });
    } else if (event.type === "ready" && open && query) {
      // 파일이 바뀌어 문서를 다시 그렸다. 보던 순번을 유지해서 다시 찾는다.
      postToFrame(frameRef.current, { type: "search", query, index: result?.current });
    }
  });

  useFindShortcut(containerRef, openFind);

  if (text.status === "error") return <ErrorText theme={theme} message={text.error.message} />;

  return (
    <View ref={containerRef} style={{ flex: 1, minHeight: 0, backgroundColor: theme.colors.surface0 }}>
      {srcDoc === null ? <Loading /> : <HtmlFrame html={srcDoc} frameRef={frameRef} title={file.name} />}
      {open ? (
        <FindBar
          theme={theme}
          inputRef={inputRef}
          query={query}
          result={result}
          onChangeQuery={changeQuery}
          onStep={step}
          onClose={closeFind}
        />
      ) : null}
    </View>
  );
}

function NativePanel({ file, theme }: { file: PluginFile; theme: PluginFilePanelProps["theme"] }) {
  const url = useFileUrl(file);
  if (url.status === "loading") return <Loading />;
  if (url.status === "error") return <ErrorText theme={theme} message={url.error.message} />;
  return <DocumentFrame url={url.url} />;
}

function ErrorText({ theme, message }: { theme: PluginFilePanelProps["theme"]; message: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: SPACE.lg, backgroundColor: theme.colors.surface0 }}>
      <Text style={{ color: theme.colors.statusDanger, fontSize: 13, textAlign: "center" }}>{message}</Text>
    </View>
  );
}
