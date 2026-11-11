import type { PluginClientContext } from "@getpaseo/plugin/client";
import { Platform } from "react-native";
import preset from "./client/appearance.json";

interface AppearancePreset {
  theme?: string;
  pluginThemeId?: string | null;
  uiFontFamily?: string;
  monoFontFamily?: string;
  uiBaseFontSize?: number;
  contentFontSize?: number;
  codeFontSize?: number;
  contentMaxWidth?: number | null;
  syntaxTheme?: string;
}

const APP_SETTINGS_KEY = "@paseo:app-settings";
const RELOAD_GUARD_KEY = "@paseo-appearance:reloaded-for";

const MANAGED_KEYS: readonly (keyof AppearancePreset)[] = [
  "theme",
  "pluginThemeId",
  "uiFontFamily",
  "monoFontFamily",
  "uiBaseFontSize",
  "contentFontSize",
  "codeFontSize",
  "contentMaxWidth",
  "syntaxTheme",
];

function readStoredObject(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {}
  return {};
}

export default function contribute(_client: PluginClientContext) {
  if (Platform.OS !== "web") return () => {};

  try {
    const current = readStoredObject(window.localStorage.getItem(APP_SETTINGS_KEY));
    const source: AppearancePreset = preset;
    const next: Record<string, unknown> = { ...current };
    let changed = false;

    for (const key of MANAGED_KEYS) {
      const value = source[key];
      if (value !== undefined && current[key] !== value) {
        next[key] = value;
        changed = true;
      }
    }

    if (!changed) {
      window.sessionStorage.removeItem(RELOAD_GUARD_KEY);
      return () => {};
    }

    const signature = JSON.stringify(source);
    window.localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(next));

    // 호스트 앱의 QueryClient는 @paseo:app-settings를 staleTime: Infinity로 캐시하고
    // 플러그인과 분리돼 있어서, localStorage를 고쳐도 새로고침 전에는 화면에 반영되지 않는다.
    // 앱이 허용 범위 밖 값을 보정해 프리셋과 계속 어긋날 때 무한 새로고침에 빠지지 않도록 세션당 한 번만 허용한다.
    if (window.sessionStorage.getItem(RELOAD_GUARD_KEY) !== signature) {
      window.sessionStorage.setItem(RELOAD_GUARD_KEY, signature);
      window.location.reload();
    }
  } catch {}

  return () => {};
}
