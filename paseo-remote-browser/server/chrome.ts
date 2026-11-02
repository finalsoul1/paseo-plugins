import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PROFILE_DIR = join(homedir(), "Library", "Application Support", "paseo-remote-browser", "profile");
const FRAME_WAIT_MS = 20_000;
const VIEW_IDLE_MS = 60_000;
const CHROME_IDLE_MS = 5 * 60_000;

type CdpMessage = {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: { message: string };
  sessionId?: string;
};

class Cdp {
  private nextId = 1;
  private pending = new Map<number, { resolve(v: Record<string, unknown>): void; reject(e: Error): void }>();
  private listeners = new Map<string, (params: Record<string, unknown>) => void>();

  private socket: WebSocket;

  constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as CdpMessage;
      if (message.id !== undefined) {
        const entry = this.pending.get(message.id);
        if (!entry) return;
        this.pending.delete(message.id);
        if (message.error) entry.reject(new Error(message.error.message));
        else entry.resolve(message.result ?? {});
        return;
      }
      if (message.method && message.sessionId) {
        this.listeners.get(`${message.sessionId}:${message.method}`)?.(message.params ?? {});
      }
    });
    socket.addEventListener("close", () => {
      for (const entry of this.pending.values()) entry.reject(new Error("CDP connection closed"));
      this.pending.clear();
    });
  }

  send(method: string, params: Record<string, unknown> = {}, sessionId?: string) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  on(sessionId: string, method: string, listener: (params: Record<string, unknown>) => void) {
    this.listeners.set(`${sessionId}:${method}`, listener);
  }

  off(sessionId: string) {
    for (const key of this.listeners.keys()) {
      if (key.startsWith(`${sessionId}:`)) this.listeners.delete(key);
    }
  }

  close() {
    this.socket.close();
  }
}

type View = {
  targetId: string;
  sessionId: string;
  seq: number;
  jpegBase64: string | null;
  url: string;
  lastSeenAt: number;
  waiters: Set<() => void>;
};

let chrome: { process: ChildProcess; cdp: Cdp } | null = null;
let chromeStarting: Promise<{ process: ChildProcess; cdp: Cdp }> | null = null;
const views = new Map<string, View>();
let lastUsedAt = Date.now();

function launchChrome() {
  mkdirSync(PROFILE_DIR, { recursive: true });
  const child = spawn(
    CHROME_PATH,
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${PROFILE_DIR}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--allow-file-access-from-files",
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  return new Promise<{ process: ChildProcess; cdp: Cdp }>((resolve, reject) => {
    let stderr = "";
    const timer = setTimeout(() => reject(new Error(`Chrome did not start: ${stderr.slice(-500)}`)), 15_000);
    child.once("exit", (code) => {
      clearTimeout(timer);
      chrome = null;
      reject(new Error(`Chrome exited with ${code}: ${stderr.slice(-500)}`));
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
      const match = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
      if (!match) return;
      clearTimeout(timer);
      child.stderr?.removeAllListeners("data");
      const socket = new WebSocket(match[1]);
      socket.addEventListener("open", () => resolve({ process: child, cdp: new Cdp(socket) }));
      socket.addEventListener("error", () => reject(new Error("Could not connect to Chrome")));
    });
  });
}

async function getChrome() {
  if (chrome) return chrome;
  chromeStarting ??= launchChrome().finally(() => {
    chromeStarting = null;
  });
  chrome = await chromeStarting;
  chrome.process.once("exit", () => {
    chrome = null;
    views.clear();
  });
  return chrome;
}

function notify(view: View) {
  for (const wake of view.waiters) wake();
  view.waiters.clear();
}

export async function openView(viewId: string, url: string, width: number, height: number, scale: number) {
  lastUsedAt = Date.now();
  const { cdp } = await getChrome();
  const existing = views.get(viewId);
  if (existing) await closeView(viewId);

  const { targetId } = (await cdp.send("Target.createTarget", { url: "about:blank" })) as { targetId: string };
  const { sessionId } = (await cdp.send("Target.attachToTarget", { targetId, flatten: true })) as {
    sessionId: string;
  };
  const view: View = {
    targetId,
    sessionId,
    seq: 0,
    jpegBase64: null,
    url,
    lastSeenAt: Date.now(),
    waiters: new Set(),
  };
  views.set(viewId, view);

  cdp.on(sessionId, "Page.screencastFrame", (params) => {
    view.seq += 1;
    view.jpegBase64 = params.data as string;
    notify(view);
    void cdp.send("Page.screencastFrameAck", { sessionId: params.sessionId }, sessionId).catch(() => {});
  });
  cdp.on(sessionId, "Page.frameNavigated", (params) => {
    const frame = params.frame as { parentId?: string; url: string };
    if (!frame.parentId) view.url = frame.url;
  });

  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send(
    "Emulation.setDeviceMetricsOverride",
    { width, height, deviceScaleFactor: scale, mobile: true },
    sessionId,
  );
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 }, sessionId);
  await cdp.send(
    "Page.startScreencast",
    { format: "jpeg", quality: 60, maxWidth: Math.round(width * scale), maxHeight: Math.round(height * scale) },
    sessionId,
  );
  await cdp.send("Page.navigate", { url }, sessionId);
}

export async function waitForFrame(viewId: string, afterSeq: number) {
  lastUsedAt = Date.now();
  const view = views.get(viewId);
  if (!view) throw new Error("View is not open");
  view.lastSeenAt = Date.now();
  if (view.seq <= afterSeq) {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        view.waiters.delete(wake);
        resolve();
      }, FRAME_WAIT_MS);
      const wake = () => {
        clearTimeout(timer);
        resolve();
      };
      view.waiters.add(wake);
    });
  }
  view.lastSeenAt = Date.now();
  if (view.seq <= afterSeq) return { seq: afterSeq, jpegBase64: null, url: view.url };
  return { seq: view.seq, jpegBase64: view.jpegBase64, url: view.url };
}

const KEYS = {
  Enter: { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" },
  Backspace: { key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 },
} as const;

export type InputAction =
  | { kind: "tap"; x: number; y: number }
  | { kind: "scroll"; x: number; y: number; dx: number; dy: number }
  | { kind: "text"; text: string }
  | { kind: "key"; key: keyof typeof KEYS }
  | { kind: "back" }
  | { kind: "forward" }
  | { kind: "reload" }
  | { kind: "goto"; url: string };

export async function sendInput(viewId: string, action: InputAction) {
  lastUsedAt = Date.now();
  const view = views.get(viewId);
  if (!view || !chrome) throw new Error("View is not open");
  const { cdp } = chrome;
  const send = (method: string, params: Record<string, unknown> = {}) => cdp.send(method, params, view.sessionId);
  view.lastSeenAt = Date.now();

  switch (action.kind) {
    case "tap":
      await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: action.x, y: action.y }] });
      await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      return;
    case "scroll":
      await send("Input.dispatchMouseEvent", {
        type: "mouseWheel",
        x: action.x,
        y: action.y,
        deltaX: action.dx,
        deltaY: action.dy,
      });
      return;
    case "text":
      await send("Input.insertText", { text: action.text });
      return;
    case "key": {
      const key = KEYS[action.key];
      await send("Input.dispatchKeyEvent", { type: "keyDown", ...key });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: key.key, code: key.code });
      return;
    }
    case "back":
    case "forward": {
      const history = (await send("Page.getNavigationHistory")) as {
        currentIndex: number;
        entries: { id: number }[];
      };
      const entry = history.entries[history.currentIndex + (action.kind === "back" ? -1 : 1)];
      if (entry) await send("Page.navigateToHistoryEntry", { entryId: entry.id });
      return;
    }
    case "reload":
      await send("Page.reload");
      return;
    case "goto":
      await send("Page.navigate", { url: action.url });
      return;
  }
}

export async function closeView(viewId: string) {
  const view = views.get(viewId);
  if (!view) return;
  views.delete(viewId);
  notify(view);
  if (!chrome) return;
  chrome.cdp.off(view.sessionId);
  await chrome.cdp.send("Target.closeTarget", { targetId: view.targetId }).catch(() => {});
}

export function startIdleSweep() {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [viewId, view] of views) {
      if (view.waiters.size === 0 && now - view.lastSeenAt > VIEW_IDLE_MS) void closeView(viewId);
    }
    if (chrome && views.size === 0 && now - lastUsedAt > CHROME_IDLE_MS) shutdownChrome();
  }, 15_000);
  return () => clearInterval(timer);
}

export function shutdownChrome() {
  if (!chrome) return;
  const { process, cdp } = chrome;
  chrome = null;
  views.clear();
  cdp.close();
  process.kill();
}
