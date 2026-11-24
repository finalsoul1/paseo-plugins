import { createElement, useEffect, useRef, type ReactElement } from "react";
import { Platform } from "react-native";
import { addWebShortcut, isShown } from "paseo-ui-kit";
import { isFrameEvent, MESSAGE_SOURCE, type FrameEvent, type FrameRequest } from "./document";

// 이 플러그인은 DOM lib 없이 타입체크한다. 이 모듈에서 쓰는 것만 선언한다.
interface FrameWindow {
  postMessage(message: unknown, targetOrigin: string): void;
}

export interface FrameElement {
  readonly contentWindow: FrameWindow | null;
}

interface WebNode {
  contains(other: unknown): boolean;
}

declare const window: {
  addEventListener(type: "message", listener: (event: { source: unknown; data: unknown }) => void): void;
  removeEventListener(type: "message", listener: (event: { source: unknown; data: unknown }) => void): void;
  addEventListener(type: "pointerdown", listener: (event: { target: unknown }) => void, capture: boolean): void;
  removeEventListener(type: "pointerdown", listener: (event: { target: unknown }) => void, capture: boolean): void;
};

declare const document: { activeElement: { tagName?: string } | null };

// allow-same-origin 은 주지 않는다. 주면 문서 스크립트가 같은 출처가 되어 Paseo 앱의 DOM과 저장소에 접근할 수 있다.
export function HtmlFrame({ html, frameRef, title }: { html: string; frameRef: { current: FrameElement | null }; title: string }): ReactElement | null {
  if (Platform.OS !== "web") return null;
  return createElement("iframe", {
    ref: frameRef,
    title,
    srcDoc: html,
    sandbox: "allow-scripts",
    referrerPolicy: "no-referrer",
    style: { flex: 1, minHeight: 0, width: "100%", border: "none", backgroundColor: "white" },
  });
}

export function postToFrame(frame: FrameElement | null, request: FrameRequest): void {
  frame?.contentWindow?.postMessage({ ...request, source: MESSAGE_SOURCE }, "*");
}

// 다른 HTML 패널의 iframe 이 보낸 메시지와 섞이지 않게 보낸 창이 이 패널의 iframe 인지 확인한다.
export function useFrameEvents(frameRef: { current: FrameElement | null }, onEvent: (event: FrameEvent) => void): void {
  const latest = useRef(onEvent);
  latest.current = onEvent;
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const listener = (event: { source: unknown; data: unknown }) => {
      const frameWindow = frameRef.current?.contentWindow;
      if (!frameWindow || event.source !== frameWindow || !isFrameEvent(event.data)) return;
      latest.current(event.data);
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [frameRef]);
}

// ⌘F 는 이 패널을 쓰고 있을 때만 가로챈다. 다른 pane 의 ⌘F(코드 편집기 찾기 등)는 그대로 둔다.
// 포커스를 받지 않는 곳을 눌렀으면 activeElement 가 body 라서, 마지막으로 누른 곳이 이 패널인지도 본다.
export function useFindShortcut(container: { current: unknown }, onFind: () => void): void {
  const latest = useRef(onFind);
  latest.current = onFind;
  useEffect(() => {
    if (Platform.OS !== "web") return;
    let pressedInside = false;
    const onPointerDown = (event: { target: unknown }) => {
      const root = container.current as WebNode | null;
      pressedInside = !!root && root.contains(event.target);
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    const removeShortcut = addWebShortcut("f", () => {
      const root = container.current as WebNode | null;
      if (!root || !isShown(root)) return false;
      const active = document.activeElement;
      const unfocused = !active || active.tagName === "BODY" || active.tagName === "HTML";
      if (!root.contains(active) && !(unfocused && pressedInside)) return false;
      latest.current();
      return true;
    });
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      removeShortcut();
    };
  }, [container]);
}

export function selectAll(input: unknown): void {
  if (Platform.OS !== "web") return;
  (input as { select?: () => void } | null)?.select?.();
}
