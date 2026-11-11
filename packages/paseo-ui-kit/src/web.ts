import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

interface WebKeyEvent {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  defaultPrevented: boolean;
  target: unknown;
  preventDefault(): void;
  stopImmediatePropagation(): void;
}

// 이 플러그인은 DOM lib 없이 타입체크한다. 이 모듈에서 쓰는 것만 선언한다.
declare const navigator: { platform?: string; userAgent: string };

declare const window: {
  addEventListener(type: "keydown" | "keyup", listener: (event: WebKeyEvent) => void, capture: boolean): void;
  addEventListener(type: "blur", listener: () => void, capture: boolean): void;
  removeEventListener(type: "keydown" | "keyup", listener: (event: WebKeyEvent) => void, capture: boolean): void;
  removeEventListener(type: "blur", listener: () => void, capture: boolean): void;
  getSelection(): { removeAllRanges(): void } | null;
  location: { pathname: string };
  history: { back(): void };
};

declare const document: { elementFromPoint(x: number, y: number): unknown };

interface WebElement {
  getBoundingClientRect(): { left: number; top: number; width: number; height: number };
  contains(other: unknown): boolean;
}

// RN 타입에는 onKeyDown 이 없지만 React Native Web 은 이 prop 을 DOM 으로 넘긴다. 네이티브에서는 붙이지 않는다.
export function webKeyDown(handler: (key: string) => boolean): object {
  if (Platform.OS !== "web") return {};
  return {
    onKeyDown(event: { key?: string; nativeEvent?: { key?: string }; preventDefault(): void }) {
      const key = event.nativeEvent?.key ?? event.key;
      if (key && handler(key)) event.preventDefault();
    },
  };
}

// Cmd/Ctrl + key 를 화면 단위로 가로챈다. handler 가 false 를 돌려주면 앱의 원래 단축키가 그대로 동작한다.
// 앱이 같은 조합을 쓸 수 있어서 capture 단계에서 먼저 받고, 처리했을 때만 전파를 막는다.
export function addWebShortcut(key: string, handler: () => boolean): () => void {
  if (Platform.OS !== "web") return () => {};
  const listener = (event: WebKeyEvent) => {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== key) return;
    // ⌥·Shift 조합은 앱이 따로 쓴다(⌘⌥I 개발자 도구, ⌘⇧D 등). 같은 글자라도 가로채지 않는다.
    if (event.altKey || event.shiftKey) return;
    if (!handler()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  window.addEventListener("keydown", listener, true);
  return () => window.removeEventListener("keydown", listener, true);
}

export function useWebShortcut(key: string, handler: () => boolean): void {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => addWebShortcut(key, () => latest.current()), [key]);
}

// Paseo 사이드바 배지와 같은 시간이다. 단축키를 바로 누를 때는 배지가 깜빡이지 않는다.
const MODIFIER_HOLD_MS = 150;

// Cmd/Ctrl 을 누르고 있는 동안 true 다. Cmd+Tab 으로 창을 떠나면 keyup 이 오지 않아서 blur 에서도 내린다.
export function useModifierHeld(): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const isModifier = (event: WebKeyEvent) => event.key === "Meta" || event.key === "Control";
    const release = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      setHeld(false);
    };
    const onDown = (event: WebKeyEvent) => {
      if (isModifier(event) && timer === undefined) timer = setTimeout(() => setHeld(true), MODIFIER_HOLD_MS);
    };
    const onUp = (event: WebKeyEvent) => {
      if (isModifier(event)) release();
    };
    window.addEventListener("keydown", onDown, true);
    window.addEventListener("keyup", onUp, true);
    // blur 는 버블링하지 않아서 capture 로 붙이면 입력창 포커스가 빠질 때마다 불린다. 창 자신의 blur 만 받는다.
    window.addEventListener("blur", release, false);
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      window.removeEventListener("keydown", onDown, true);
      window.removeEventListener("keyup", onUp, true);
      window.removeEventListener("blur", release, false);
    };
  }, []);
  return held;
}

// Shift 클릭은 브라우저에서 앞서 누른 곳부터 글자 선택을 넓힌다. 범위 선택 뒤에 남은 파란 글자 선택을 지운다.
export function clearTextSelection(): void {
  if (Platform.OS !== "web") return;
  window.getSelection()?.removeAllRanges();
}

// 화면 안 요소가 Esc 를 먼저 처리했으면(선택 해제 등) 넘어가도록 bubble 단계에서 받는다.
// 포커스가 이 화면 밖(⌘K, 대화상자)에 있으면 그쪽 Esc 라서 건드리지 않는다.
export function useWebEscape(container: { current: unknown }, handler: () => boolean): void {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const listener = (event: WebKeyEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const root = container.current as { contains(node: unknown): boolean } | null;
      const target = event.target as { tagName?: string } | null;
      const unfocused = target?.tagName === "BODY" || target?.tagName === "HTML";
      if (!root || !(unfocused || root.contains(target))) return;
      if (latest.current()) event.preventDefault();
    };
    window.addEventListener("keydown", listener, false);
    return () => window.removeEventListener("keydown", listener, false);
  }, [container]);
}

// 앱은 플러그인 화면을 router.push 로 연다. 뒤로 가면 화면을 열기 전 자리로 돌아간다.
export function isRouteOpen(pathSuffix: string): boolean {
  if (Platform.OS !== "web") return false;
  return window.location.pathname.endsWith(pathSuffix);
}

export function goBack(): void {
  if (Platform.OS !== "web") return;
  window.history.back();
}

// 화면이 다른 탭 뒤로 숨어 있어도 마운트는 남을 수 있어서, 실제로 보이는지 DOM 으로 확인한다.
export function isShown(node: unknown): boolean {
  if (Platform.OS !== "web") return true;
  return (node as { offsetParent?: unknown } | null)?.offsetParent != null;
}

// isShown 보다 엄격하다. 다른 화면 뒤에 겹쳐 가려진 요소는 offsetParent 가 남아 있어서, 가운데 점에 실제로 그려진 것이 이 요소인지 본다.
export function isOnTop(node: unknown): boolean {
  if (Platform.OS !== "web" || !node) return false;
  const element = node as WebElement;
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  return element.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2));
}

// 단축키 안내를 Mac 이면 Command 기호로, 아니면 Ctrl 로 보여준다. 네이티브에는 이 단축키가 없어 null 이다.
export function shortcutLabel(key: string): string | null {
  if (Platform.OS !== "web") return null;
  const mac = /Mac|iPhone|iPad/.test(navigator.platform ?? navigator.userAgent);
  return mac ? `\u2318${key.toUpperCase()}` : `Ctrl+${key.toUpperCase()}`;
}

// 사이드바 행이 여는 화면의 단축키다. 어디서든 누르면 그 화면을 열고, 그 화면에서 한 번 더 누르면 열기 전 화면으로 돌아간다.
export function addScreenShortcut(key: string, routeSuffix: string, open: () => void): () => void {
  return addWebShortcut(key, () => {
    if (isRouteOpen(routeSuffix)) goBack();
    else open();
    return true;
  });
}

// 목록 화면들이 같은 키로 동작하게 묶었다. ⌘L은 입력칸으로, Esc는 열기 전 화면으로, 화면을 열면 입력칸에 포커스.
// ⌘L은 Paseo의 "메시지 입력창 포커스" 단축키라서 화면이 실제로 보일 때만 가로챈다.
// ready는 화면 폭을 잰 뒤 true로 준다. 폭을 재기 전후로 배치가 바뀌며 입력칸이 다시 마운트되기 때문이다.
// 네이티브는 키보드가 목록을 가려서 열 때 포커스를 옮기지 않는다.
export function useScreenKeys({
  screenRef,
  inputRef,
  ready,
  escapeBlocked = false,
}: {
  screenRef: { current: unknown };
  inputRef: { current: { focus(): void } | null };
  ready: boolean;
  escapeBlocked?: boolean;
}): void {
  useWebShortcut("l", () => {
    if (!isShown(inputRef.current)) return false;
    inputRef.current?.focus();
    return true;
  });
  const openFocused = useRef(false);
  useEffect(() => {
    if (!ready || openFocused.current || Platform.OS !== "web") return;
    openFocused.current = true;
    inputRef.current?.focus();
  }, [ready]);
  useWebEscape(screenRef, () => {
    if (escapeBlocked || !isShown(screenRef.current)) return false;
    goBack();
    return true;
  });
}

// 목록 행 사이는 Tab 대신 화살표로 옮겨 다니고, Tab 은 목록 전체를 한 번에 건너뛴다(roving tabindex).
// 첫 행에서 위 화살표는 입력칸으로 돌아간다. 처리한 키면 true 다. Space·Enter·Esc 는 화면마다 달라서 부르는 쪽이 처리한다.
export function listNavKey(
  key: string,
  index: number,
  count: number,
  focusRow: (index: number) => void,
  focusInput: () => void,
): boolean {
  switch (key) {
    case "ArrowDown":
      focusRow(Math.min(index + 1, count - 1));
      return true;
    case "ArrowUp":
      if (index === 0) focusInput();
      else focusRow(index - 1);
      return true;
    case "Home":
      focusRow(0);
      return true;
    case "End":
      focusRow(count - 1);
      return true;
    default:
      return false;
  }
}

// React Native Web 의 TextInput 은 keydown 전파를 막아서 화면의 Esc 처리(useWebEscape)가 받지 못한다. 입력칸에서 직접 처리한다.
// 아래 화살표는 첫 행으로, Esc 는 입력값이 있으면 지우고 비어 있으면 포커스를 뺀다.
export function inputListKey(key: string, opts: { hasValue: boolean; clear(): void; blur(): void; focusFirstRow(): void }): void {
  if (key === "ArrowDown") opts.focusFirstRow();
  if (key === "Escape") {
    if (opts.hasValue) opts.clear();
    else opts.blur();
  }
}
