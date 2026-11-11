import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  ProviderCatalog,
  ProviderLaunch,
  ProviderModel,
  ProviderMode,
  ProviderStatus,
} from "@getpaseo/plugin/server/provider";
import { resolveAntigravityHome } from "./history.js";
import { probe } from "./process.js";
import { AntigravityError } from "./wire.js";

const FALLBACK_DEFAULT_MODEL = "gemini-4-argon-medium";

const modes: readonly ProviderMode[] = [
  {
    id: "full-access",
    icon: "ShieldOff",
    colorTier: "dangerous",
    label: "Full access",
    description:
      "Antigravity cannot ask for permission when another app drives it. Paseo starts it with --dangerously-skip-permissions.",
    isUnattended: true,
  },
];

export async function readConfiguredModel(
  env: Readonly<Record<string, string | undefined>> = {},
): Promise<string | undefined> {
  const settingsPath = path.join(resolveAntigravityHome(env), "settings.json");
  try {
    const parsed: unknown = JSON.parse(await readFile(settingsPath, "utf8"));
    if (!parsed || typeof parsed !== "object") return undefined;
    const raw = (parsed as Record<string, unknown>).model;
    return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
  } catch {
    return undefined;
  }
}

function selectDefaultModel(
  models: readonly ProviderModel[],
  configured: string | undefined,
): string | undefined {
  if (configured) {
    // `agy` persists the display label in settings.json (`"model": "Gemini 4 Argon (Medium)"`).
    const matched = models.find((model) => model.label === configured || model.id === configured);
    if (matched) return matched.id;
  }
  return (
    models.find((model) => model.id === FALLBACK_DEFAULT_MODEL)?.id ?? models[0]?.id
  );
}

export async function getCatalog(launch: ProviderLaunch, cwd?: string): Promise<ProviderCatalog> {
  const [output, configured] = await Promise.all([
    probe({ launch, args: ["models"], cwd }),
    readConfiguredModel(launch.env),
  ]);
  const models: ProviderModel[] = [];
  for (const line of output.trim().split(/\r?\n/)) {
    const [id, label, ...extra] = line.split("\t");
    if (!id || !label || extra.length > 0)
      throw new AntigravityError("Invalid `agy models` output", "INVALID_CATALOG");
    if (models.some((model) => model.id === id))
      throw new AntigravityError(`Duplicate Antigravity model: ${id}`, "INVALID_CATALOG");
    models.push({ id, label });
  }
  const defaultModel = selectDefaultModel(models, configured);
  return {
    models,
    ...(defaultModel ? { defaultModel } : {}),
    modes,
    thinkingOptions: [],
    defaultMode: "full-access",
  };
}

export async function getStatus(launch: ProviderLaunch): Promise<ProviderStatus> {
  try {
    const version = (await probe({ launch, args: ["--version"] })).trim();
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
    if (!match)
      return {
        available: false,
        diagnostic: "Could not read the Antigravity version. Update `agy` to 1.1.15 or later.",
      };
    const [, major, minor, patch] = match.map(Number);
    const supported = major > 1 || (major === 1 && (minor > 1 || (minor === 1 && patch >= 15)));
    if (!supported)
      return {
        available: false,
        diagnostic: `Antigravity ${version} is unsupported. Update \`agy\` to 1.1.15 or later.`,
      };
    await getCatalog(launch);
    return { available: true };
  } catch (error) {
    if (!(error instanceof AntigravityError)) throw error;
    return { available: false, diagnostic: error.message };
  }
}

export function validateSelection(
  config: { model?: string; mode?: string; thinkingOption?: string },
  catalog: ProviderCatalog,
): void {
  if (config.model && !catalog.models.some((model) => model.id === config.model))
    throw new AntigravityError(`Unknown Antigravity model: ${config.model}`, "INVALID_MODEL");
  if (config.mode && !catalog.modes.some((mode) => mode.id === config.mode))
    throw new AntigravityError(`Unknown Antigravity mode: ${config.mode}`, "INVALID_MODE");
  if (config.thinkingOption)
    throw new AntigravityError(
      "Antigravity effort is selected through the model ID",
      "UNSUPPORTED_THINKING",
    );
}
