import { createReadStream, existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import type { ProviderSessionSummary } from "@getpaseo/plugin/server/provider";
import { extractUserPrompt, isValidConversationId, resolveAntigravityHome } from "./history.js";

const METADATA_PROMPT_PREFIX = "Generate metadata for a coding agent based on the user prompt.";
const DEFAULT_LIMIT = 50;

interface ListSessionsOptions {
  query?: string;
  cwd?: string;
  limit?: number;
  appHome?: string;
}

interface CandidateRow {
  conversationId: string;
  cwd: string | null;
  updatedAt: string;
  dbTitle: string;
  dbPreview: string;
}

export async function listSessions(
  options: ListSessionsOptions = {},
): Promise<ProviderSessionSummary[]> {
  const appHome = options.appHome ?? resolveAntigravityHome();
  const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_LIMIT, 500));
  const normalizedQuery = options.query?.trim().toLowerCase() || null;
  const requestedCwd = options.cwd ? path.resolve(options.cwd) : null;

  const candidates =
    readDbCandidates(appHome, requestedCwd) ?? (await scanBrainDirectories(appHome, requestedCwd));

  const results: ProviderSessionSummary[] = [];
  for (const candidate of candidates) {
    if (results.length >= limit) break;
    if (!isValidConversationId(candidate.conversationId)) continue;
    const cwd = candidate.cwd ?? requestedCwd ?? os.homedir();
    if (requestedCwd && path.resolve(cwd) !== requestedCwd) continue;

    const preview = await readTranscriptSummary(appHome, candidate.conversationId);
    const title = firstLine(candidate.dbTitle || preview.firstUserPrompt || "");
    const description = firstLine(candidate.dbPreview || preview.lastUserPrompt || "");
    if (!title && !description) continue;
    if (title.startsWith(METADATA_PROMPT_PREFIX)) continue;

    if (normalizedQuery) {
      const haystack = `${title}\n${description}\n${cwd}\n${candidate.conversationId}`.toLowerCase();
      if (!haystack.includes(normalizedQuery)) continue;
    }

    results.push({
      persistence: { version: 1, data: { conversationId: candidate.conversationId } },
      cwd,
      ...(title ? { title: truncateLine(title, 120) } : {}),
      ...(description ? { description: truncateLine(description, 160) } : {}),
      updatedAt: candidate.updatedAt,
    });
  }
  return results;
}

function readDbCandidates(appHome: string, fallbackCwd: string | null): CandidateRow[] | null {
  const dbPath = path.join(appHome, "conversation_summaries.db");
  if (!existsSync(dbPath)) return null;
  let db: DatabaseSync | null = null;
  try {
    db = new DatabaseSync(dbPath, { readOnly: true });
    const rows = db
      .prepare(
        `SELECT conversation_id, title, preview, last_modified_time, workspace_uris
         FROM conversation_summaries
         WHERE nesting_depth = 0
         ORDER BY last_modified_time DESC
         LIMIT 500`,
      )
      .all() as Array<Record<string, unknown>>;
    return rows.flatMap((row) => {
      const conversationId =
        typeof row.conversation_id === "string" ? row.conversation_id : null;
      if (!conversationId) return [];
      const cwd = parseWorkspaceCwd(row.workspace_uris) ?? fallbackCwd;
      const updatedAt = normalizeTimestamp(row.last_modified_time);
      return [
        {
          conversationId,
          cwd,
          updatedAt,
          dbTitle: typeof row.title === "string" ? row.title : "",
          dbPreview: typeof row.preview === "string" ? row.preview : "",
        },
      ];
    });
  } catch {
    return null;
  } finally {
    try {
      db?.close();
    } catch {
      // Ignore close errors on read-only SQLite handles.
    }
  }
}

async function scanBrainDirectories(
  appHome: string,
  fallbackCwd: string | null,
): Promise<CandidateRow[]> {
  const brainDir = path.join(appHome, "brain");
  const entries = await readdir(brainDir, { withFileTypes: true }).catch(() => []);
  const items: Array<CandidateRow & { mtimeMs: number }> = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isValidConversationId(entry.name)) continue;
    const transcript = path.join(
      brainDir,
      entry.name,
      ".system_generated",
      "logs",
      "transcript.jsonl",
    );
    const info = await stat(transcript).catch(() => null);
    if (!info?.isFile()) continue;
    items.push({
      conversationId: entry.name,
      cwd: fallbackCwd,
      updatedAt: info.mtime.toISOString(),
      dbTitle: "",
      dbPreview: "",
      mtimeMs: info.mtimeMs,
    });
  }
  return items.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

async function readTranscriptSummary(
  appHome: string,
  conversationId: string,
): Promise<{ firstUserPrompt: string; lastUserPrompt: string }> {
  const transcriptPath = path.join(
    appHome,
    "brain",
    conversationId,
    ".system_generated",
    "logs",
    "transcript.jsonl",
  );
  if (!existsSync(transcriptPath)) return { firstUserPrompt: "", lastUserPrompt: "" };
  const stream = createReadStream(transcriptPath, { encoding: "utf8" });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  let firstUserPrompt = "";
  let lastUserPrompt = "";
  try {
    for await (const line of lines) {
      if (!line.includes('"USER_INPUT"')) continue;
      try {
        const parsed = JSON.parse(line) as { type?: unknown; content?: unknown };
        if (parsed.type !== "USER_INPUT" || typeof parsed.content !== "string") continue;
        const prompt = extractUserPrompt(parsed.content);
        if (!prompt) continue;
        if (!firstUserPrompt) firstUserPrompt = prompt;
        lastUserPrompt = prompt;
      } catch {
        // Ignore malformed lines.
      }
    }
  } finally {
    lines.close();
    stream.destroy();
  }
  return { firstUserPrompt, lastUserPrompt };
}

function parseWorkspaceCwd(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    for (const item of parsed) {
      if (typeof item !== "string") continue;
      if (item.startsWith("file://")) return fileURLToPath(item);
      if (path.isAbsolute(item)) return item;
    }
  } catch {
    // Ignore malformed workspace URI JSON.
  }
  return null;
}

function normalizeTimestamp(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) return new Date(0).toISOString();
  const isoCandidate = raw.includes("T") ? raw : raw.replace(" ", "T");
  const parsed = Date.parse(isoCandidate);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date(0).toISOString();
}

function firstLine(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? ""
  );
}

function truncateLine(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}...`;
}
