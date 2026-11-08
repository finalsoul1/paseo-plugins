import { accessSync, constants, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ProviderLaunch } from "@getpaseo/plugin/server/provider";
import {
  balanceToneFromRemaining,
  hashAccountKey,
  toneFromUsedPct,
  unavailable,
  windowFromUsedPct,
  type UsageAccount,
  type UsageBalance,
  type UsageReport,
  type UsageScope,
  type UsageSourceRegistration,
  type UsageWindow,
} from "@getpaseo/plugin/server/usage";
import { z } from "zod";
import { resolveAntigravityHome } from "./internal/history.js";
import { probe } from "./internal/process.js";
import { AntigravityError } from "./internal/wire.js";

const USAGE_TIMEOUT_MS = 15_000;

const usageInputSchema = z
  .object({
    appHome: z.string().min(1),
    command: z.string().min(1),
    args: z.array(z.string()),
  })
  .strict();

type UsageInput = z.infer<typeof usageInputSchema>;

let rememberedLaunch: { command: string; args: string[] } | null = null;

export function rememberProviderLaunch(launch: ProviderLaunch | undefined): void {
  if (!launch?.command) return;
  rememberedLaunch = { command: launch.command, args: [...launch.args] };
}

function isExecutable(filePath: string): boolean {
  try {
    accessSync(filePath, process.platform === "win32" ? constants.F_OK : constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function readCommandFromPaseoConfig(
  env: Readonly<Record<string, string | undefined>>,
): Promise<{ command: string; args: string[] } | null> {
  const home = env.HOME?.trim() || env.USERPROFILE?.trim() || os.homedir();
  const paseoHome = env.PASEO_HOME?.trim() || path.join(home, ".paseo");
  const configPath = path.join(paseoHome, "config.json");
  if (!existsSync(configPath)) return null;
  try {
    const parsed: unknown = JSON.parse(await readFile(configPath, "utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    const agents = (parsed as Record<string, unknown>).agents;
    if (!agents || typeof agents !== "object") return null;
    const providers = (agents as Record<string, unknown>).providers;
    if (!providers || typeof providers !== "object") return null;
    for (const id of ["agy", "antigravity"]) {
      const entry = (providers as Record<string, unknown>)[id];
      if (!entry || typeof entry !== "object") continue;
      const cmd = (entry as Record<string, unknown>).command;
      if (
        Array.isArray(cmd) &&
        cmd.length > 0 &&
        cmd.every((item): item is string => typeof item === "string" && item.length > 0) &&
        isExecutable(cmd[0]!)
      ) {
        return { command: cmd[0]!, args: cmd.slice(1) };
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function resolveUsageCommand(
  env: Readonly<Record<string, string | undefined>>,
): Promise<{ command: string; args: string[] } | null> {
  if (rememberedLaunch && isExecutable(rememberedLaunch.command)) {
    return rememberedLaunch;
  }
  const configured = await readCommandFromPaseoConfig(env);
  if (configured) return configured;

  const home = env.HOME?.trim() || env.USERPROFILE?.trim() || os.homedir();
  const binaryName = process.platform === "win32" ? "agy.exe" : "agy";
  const pathDirs = (env.PATH ?? process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  const candidates = [
    ...pathDirs.map((dir) => path.join(dir, binaryName)),
    path.join(home, ".local", "bin", binaryName),
    path.join(home, ".gemini", "antigravity-cli", "bin", binaryName),
    path.join("/opt/homebrew/bin", binaryName),
    path.join("/usr/local/bin", binaryName),
  ];
  for (const candidate of candidates) {
    if (isExecutable(candidate)) return { command: candidate, args: [] };
  }
  return null;
}

async function readAccountSeed(appHome: string): Promise<string> {
  const installIdPath = path.join(appHome, "installation_id");
  try {
    const id = (await readFile(installIdPath, "utf8")).trim();
    if (id) return id;
  } catch {
    // Fall back to appHome when installation_id has not been written yet.
  }
  return appHome;
}

export async function discoverAntigravityUsage(scope: UsageScope): Promise<UsageAccount[]> {
  if (scope.kind === "session" && scope.provider !== "agy" && scope.provider !== "antigravity") {
    return [];
  }
  const env = scope.kind === "session" ? scope.env : process.env;
  const appHome = resolveAntigravityHome(env);
  if (!existsSync(path.join(appHome, "antigravity-oauth-token"))) {
    return [];
  }
  const resolved = await resolveUsageCommand(env);
  if (!resolved) return [];

  const seed = await readAccountSeed(appHome);
  const input: UsageInput = {
    appHome,
    command: resolved.command,
    args: resolved.args,
  };
  return [{ key: `agy-${hashAccountKey(seed)}`, input }];
}

function normalizeId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function formatGroupLabels(rawGroup: string): {
  id: string;
  label: string;
  shortLabel: string;
  rank: number;
} {
  const trimmed = rawGroup.trim();
  const id = normalizeId(trimmed) || "models";
  if (/argon/i.test(trimmed)) {
    return { id, label: trimmed, shortLabel: "Argon", rank: 0 };
  }
  if (/^gemini\s+models$/i.test(trimmed)) {
    return { id, label: "Gemini Models", shortLabel: "Gemini", rank: 1 };
  }
  if (/^claude\s+and\s+gpt\s+models$/i.test(trimmed)) {
    return { id, label: "Claude & GPT", shortLabel: "Claude/GPT", rank: 2 };
  }
  const shortLabel = trimmed.replace(/\s+models$/i, "").trim() || trimmed;
  return { id, label: trimmed, shortLabel, rank: 3 };
}

function formatPeriodLabels(rawLimit: string): {
  id: string;
  label: string;
  shortLabel: string;
  rank: number;
} {
  const trimmed = rawLimit.trim();
  if (/five[\s-]*hour|5[\s-]*hour|\b5h\b/i.test(trimmed)) {
    return { id: "five_hour", label: "5-hour", shortLabel: "5h", rank: 0 };
  }
  if (/week|7[\s-]*day/i.test(trimmed)) {
    return { id: "weekly", label: "Weekly", shortLabel: "wk", rank: 1 };
  }
  if (/daily|24[\s-]*hour|\bday\b/i.test(trimmed)) {
    return { id: "daily", label: "Daily", shortLabel: "1d", rank: 2 };
  }
  const cleaned = trimmed.replace(/\s*(limit\s*)?(remaining|used)$/i, "").trim() || "Limit";
  return { id: normalizeId(cleaned) || "limit", label: cleaned, shortLabel: "", rank: 3 };
}

function parseIsoOrNull(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const parsed = Date.parse(raw.trim());
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

interface ParsedRow {
  id: string;
  label: string;
  shortLabel: string;
  usedPct: number;
  resetsAt: string | null;
  groupRank: number;
  periodRank: number;
  defaultSummary: boolean;
}

export function parseUsageOutput(output: string): UsageWindow[] {
  const rows: ParsedRow[] = [];
  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const cols = trimmed.split("\t");
    if (cols.length < 3) continue;
    const [rawGroup, rawLimit, rawPct, rawReset] = cols;
    if (!rawGroup || !rawLimit || !rawPct) continue;
    const numeric = Number(rawPct.replace(/%/g, "").trim());
    if (!Number.isFinite(numeric)) continue;

    // `agy -p /usage` reports remaining quota percentage across all rows.
    const isExplicitlyUsed = /\bused\b/i.test(rawLimit) && !/remaining/i.test(rawLimit);
    const rawUsed = isExplicitlyUsed ? numeric : 100 - numeric;
    const usedPct = Math.min(100, Math.max(0, Math.round(rawUsed * 10) / 10));

    const group = formatGroupLabels(rawGroup);
    const period = formatPeriodLabels(rawLimit);
    const shortLabel = period.shortLabel
      ? `${group.shortLabel} ${period.shortLabel}`
      : group.shortLabel;

    rows.push({
      id: `${group.id}:${period.id}`,
      label: `${group.label} · ${period.label}`,
      shortLabel,
      usedPct,
      resetsAt: parseIsoOrNull(rawReset),
      groupRank: group.rank,
      periodRank: period.rank,
      defaultSummary:
        group.rank === 0 || (group.rank === 1 && period.id === "five_hour"),
    });
  }

  rows.sort((left, right) => {
    if (left.groupRank !== right.groupRank) return left.groupRank - right.groupRank;
    if (left.periodRank !== right.periodRank) return left.periodRank - right.periodRank;
    return left.id.localeCompare(right.id);
  });

  if (rows.length > 0 && !rows.some((row) => row.defaultSummary)) {
    rows[0]!.defaultSummary = true;
  }

  const seen = new Set<string>();
  return rows.map((row) => {
    let id = row.id;
    if (seen.has(id)) {
      let suffix = 2;
      while (seen.has(`${id}_${suffix}`)) suffix += 1;
      id = `${id}_${suffix}`;
    }
    seen.add(id);
    return windowFromUsedPct({
      id,
      label: row.label,
      shortLabel: row.shortLabel,
      summary: row.defaultSummary,
      utilizationPct: row.usedPct,
      resetsAt: row.resetsAt,
      tone: toneFromUsedPct(row.usedPct),
    });
  });
}

export function parseCreditsOutput(output: string | null): UsageBalance[] {
  if (!output) return [];
  for (const line of output.split(/\r?\n/)) {
    const [key, rawValue] = line.trim().split("\t");
    if (!key || rawValue === undefined) continue;
    if (!/^remaining\s+credits$/i.test(key.trim())) continue;
    const remaining = Number(rawValue.replace(/,/g, "").trim());
    if (!Number.isFinite(remaining)) continue;
    return [
      {
        id: "credits",
        label: "Credits",
        remaining,
        unit: "credits",
        tone: balanceToneFromRemaining(remaining),
      },
    ];
  }
  return [];
}

function buildUsageLaunch(input: UsageInput): ProviderLaunch {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") env[key] = value;
  }
  env.ANTIGRAVITY_CLI_HOME = input.appHome;
  return { command: input.command, args: input.args, env };
}

function isAuthError(message: string): boolean {
  return /sign\s*in|not\s+logged\s+in|unauthenticated|unauthorized|\b401\b|\b403\b/i.test(message);
}

export async function fetchAntigravityUsage(rawInput: unknown): Promise<UsageReport> {
  const input = usageInputSchema.parse(rawInput);
  if (!existsSync(path.join(input.appHome, "antigravity-oauth-token"))) {
    throw new Error("Antigravity login store no longer exists");
  }
  const launch = buildUsageLaunch(input);
  let usageRaw: string;
  let creditsRaw: string | null;
  try {
    [usageRaw, creditsRaw] = await Promise.all([
      probe({ launch, args: ["-p", "/usage"], timeoutMs: USAGE_TIMEOUT_MS }),
      probe({ launch, args: ["-p", "/credits"], timeoutMs: USAGE_TIMEOUT_MS }).catch(() => null),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof AntigravityError && isAuthError(message)) {
      return unavailable({ kind: "rejected", status: 401, refreshedBy: "agy" });
    }
    throw error;
  }

  const windows = parseUsageOutput(usageRaw);
  const balances = parseCreditsOutput(creditsRaw);
  if (windows.length === 0 && balances.length === 0) {
    return unavailable({ kind: "no_quota", detail: "Antigravity returned no quota windows." });
  }
  return {
    status: "available",
    windows,
    balances,
    details: [],
  };
}

export function createAntigravityUsageSource(): UsageSourceRegistration {
  return {
    id: "antigravity",
    label: "Antigravity",
    icon: "icon.svg",
    input: usageInputSchema,
    discover: discoverAntigravityUsage,
    fetch: fetchAntigravityUsage,
  };
}
