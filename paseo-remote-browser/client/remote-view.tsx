import type { PluginHostProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  type GestureResponderEvent,
  Image,
  type LayoutChangeEvent,
  PixelRatio,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { closeView, nextFrame, openView, sendInput } from "../shared/browser";

const TAP_SLOP = 8;
const SCROLL_SEND_MS = 50;

type Props = Pick<PluginHostProps, "theme" | "layout"> & { initialUrl: string };

function newViewId() {
  return `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeUrl(input: string) {
  const value = input.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
  if (value.startsWith("/")) return `file://${encodeURI(value)}`;
  return `http://${value}`;
}

export function RemoteView({ initialUrl, theme, layout }: Props) {
  const open = useRpc(openView);
  const frame = useRpc(nextFrame);
  const input = useRpc(sendInput);
  const close = useRpc(closeView);

  const viewId = useRef(newViewId()).current;
  const currentUrl = useRef(initialUrl);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [generation, setGeneration] = useState(0);
  const [image, setImage] = useState<string | null>(null);
  const [addressBar, setAddressBar] = useState(initialUrl);
  const [editingAddress, setEditingAddress] = useState(false);
  const [typed, setTyped] = useState("");
  const [status, setStatus] = useState("연결 중");
  const [stats, setStats] = useState({ frames: 0, lastKb: 0, startedAt: Date.now() });

  const styles = useMemo(
    () => ({
      root: { flex: 1, backgroundColor: theme.colors.surface0 },
      bar: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 6,
        padding: 6,
        borderBottomWidth: 1,
        borderColor: theme.colors.border,
      },
      button: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: theme.colors.surface2,
      },
      buttonText: { color: theme.colors.foreground, fontSize: 14 },
      input: {
        flex: 1,
        color: theme.colors.foreground,
        backgroundColor: theme.colors.surface1,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 6,
        fontSize: 13,
      },
      viewport: { flex: 1, overflow: "hidden" as const, backgroundColor: theme.colors.surface1 },
      status: { color: theme.colors.foregroundMuted, fontSize: 11, paddingHorizontal: 8, paddingVertical: 2 },
    }),
    [theme],
  );

  function onLayout(event: LayoutChangeEvent) {
    const width = Math.round(event.nativeEvent.layout.width);
    const height = Math.round(event.nativeEvent.layout.height);
    if (width < 100 || height < 100) return;
    setSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
  }

  useEffect(() => {
    if (!size) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setStatus("페이지 여는 중");
      open({
        viewId,
        url: currentUrl.current,
        width: size.width,
        height: size.height,
        scale: Math.min(PixelRatio.get(), 2),
      })
        .then(() => {
          if (!cancelled) setGeneration((value) => value + 1);
        })
        .catch((error: Error) => {
          if (!cancelled) setStatus(`열기 실패: ${error.message}`);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [size, viewId]);

  useEffect(() => {
    if (generation === 0) return;
    let cancelled = false;
    let afterSeq = 0;
    setStats({ frames: 0, lastKb: 0, startedAt: Date.now() });
    (async () => {
      while (!cancelled) {
        try {
          const result = await frame({ viewId, afterSeq });
          if (cancelled) return;
          currentUrl.current = result.url;
          if (result.jpegBase64) {
            afterSeq = result.seq;
            setImage(result.jpegBase64);
            const kb = Math.round((result.jpegBase64.length * 3) / 4 / 1024);
            setStats((prev) => ({ ...prev, frames: prev.frames + 1, lastKb: kb }));
            setStatus("연결됨");
          }
        } catch (error) {
          if (cancelled) return;
          const message = (error as Error).message;
          setStatus(`프레임 오류: ${message}`);
          if (message.includes("not open")) {
            setSize((prev) => (prev ? { ...prev } : prev));
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [generation, viewId]);

  useEffect(() => () => void close({ viewId }).catch(() => {}), [viewId]);

  useEffect(() => {
    if (!editingAddress) setAddressBar(currentUrl.current);
  }, [image, editingAddress]);

  function act(action: Parameters<typeof input>[0]["action"]) {
    input({ viewId, action }).catch((error: Error) => setStatus(`입력 오류: ${error.message}`));
  }

  const gesture = useRef({ startX: 0, startY: 0, lastPageX: 0, lastPageY: 0, totalX: 0, totalY: 0 });
  const pending = useRef({ dx: 0, dy: 0, sentAt: 0 });

  function flushScroll(force: boolean) {
    const now = Date.now();
    const { dx, dy, sentAt } = pending.current;
    if (dx === 0 && dy === 0) return;
    if (!force && now - sentAt < SCROLL_SEND_MS) return;
    pending.current = { dx: 0, dy: 0, sentAt: now };
    act({ kind: "scroll", x: gesture.current.startX, y: gesture.current.startY, dx, dy });
  }

  const responder = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant(event: GestureResponderEvent) {
      const { locationX, locationY, pageX, pageY } = event.nativeEvent;
      gesture.current = { startX: locationX, startY: locationY, lastPageX: pageX, lastPageY: pageY, totalX: 0, totalY: 0 };
      pending.current = { dx: 0, dy: 0, sentAt: 0 };
    },
    onResponderMove(event: GestureResponderEvent) {
      const { pageX, pageY } = event.nativeEvent;
      const state = gesture.current;
      const dx = state.lastPageX - pageX;
      const dy = state.lastPageY - pageY;
      state.lastPageX = pageX;
      state.lastPageY = pageY;
      state.totalX += Math.abs(dx);
      state.totalY += Math.abs(dy);
      pending.current.dx += dx;
      pending.current.dy += dy;
      if (state.totalX + state.totalY > TAP_SLOP) flushScroll(false);
    },
    onResponderRelease() {
      const state = gesture.current;
      if (state.totalX + state.totalY <= TAP_SLOP) {
        act({ kind: "tap", x: state.startX, y: state.startY });
        return;
      }
      flushScroll(true);
    },
  };

  const elapsed = Math.max(1, (Date.now() - stats.startedAt) / 1000);

  return (
    <View style={styles.root}>
      <View style={styles.bar}>
        <Pressable style={styles.button} onPress={() => act({ kind: "back" })} accessibilityLabel="뒤로">
          <Text style={styles.buttonText}>{"<"}</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => act({ kind: "forward" })} accessibilityLabel="앞으로">
          <Text style={styles.buttonText}>{">"}</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => act({ kind: "reload" })} accessibilityLabel="새로고침">
          <Text style={styles.buttonText}>R</Text>
        </Pressable>
        <TextInput
          style={styles.input}
          value={addressBar}
          onChangeText={setAddressBar}
          onFocus={() => setEditingAddress(true)}
          onBlur={() => setEditingAddress(false)}
          onSubmitEditing={() => {
            setEditingAddress(false);
            act({ kind: "goto", url: normalizeUrl(addressBar) });
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          placeholder="localhost:3000"
          placeholderTextColor={theme.colors.foregroundMuted}
        />
      </View>
      <View style={styles.viewport} onLayout={onLayout} {...responder}>
        {image && size ? (
          <Image
            source={{ uri: `data:image/jpeg;base64,${image}` }}
            style={{ width: size.width, height: size.height }}
            resizeMode="stretch"
            fadeDuration={0}
          />
        ) : null}
      </View>
      <View style={styles.bar}>
        <TextInput
          style={styles.input}
          value={typed}
          onChangeText={setTyped}
          onSubmitEditing={() => {
            if (typed) act({ kind: "text", text: typed });
            setTyped("");
          }}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="페이지에 입력할 텍스트"
          placeholderTextColor={theme.colors.foregroundMuted}
        />
        <Pressable
          style={styles.button}
          onPress={() => {
            if (typed) act({ kind: "text", text: typed });
            setTyped("");
          }}
        >
          <Text style={styles.buttonText}>보내기</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => act({ kind: "key", key: "Backspace" })}>
          <Text style={styles.buttonText}>지우기</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => act({ kind: "key", key: "Enter" })}>
          <Text style={styles.buttonText}>Enter</Text>
        </Pressable>
      </View>
      <Text style={styles.status} numberOfLines={1}>
        {`${status} · ${stats.frames}프레임 · ${(stats.frames / elapsed).toFixed(1)}fps · 마지막 ${stats.lastKb}KB${layout.compact ? "" : ` · ${size ? `${size.width}x${size.height}` : ""}`}`}
      </Text>
    </View>
  );
}
