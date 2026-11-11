import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import type { ProviderEvent, ProviderUsage } from "@getpaseo/plugin/server/provider";
import { buildToolDetail } from "./timeline.js";

const MAX_TOOL_OUTPUT_CHARS = 65_536;

interface TranscriptToolCall {
  name?: unknown;
  args?: unknown;
}

interface TranscriptRow {
  step_index?: unknown;
  source?: unknown;
  type?: unknown;
  status?: unknown;
  created_at?: unknown;
  content?: unknown;
  thinking?: unknown;
  tool_calls?: unknown;
  error?: unknown;
  input_tokens?: unknown;
  output_tokens?: unknown;
  cache_read_tokens?: unknown;
}

export function resolveAntigravityHome(
  env: Readonly<Record<string, string | undefined>> = {},
): string {
  const override = env.ANTIGRAVITY_CLI_HOME?.trim();
  if (override) return path.resolve(override);
  const home = env.HOME?.trim() || env.USERPROFILE?.trim() || os.homedir();
  return path.join(home, ".gemini", "antigravity-cli");
}

export function isValidConversationId(conversationId: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(conversationId);
}

export async function resolveTranscriptPath(
  conversationId: string,
  appHome = resolveAntigravityHome(),
): Promise<string | null> {
  if (!isValidConversationId(conversationId)) return null;
  const logsDir = path.join(appHome, "brain", conversationId, ".system_generated", "logs");
  // transcript.jsonl truncates long assistant/user messages; prefer transcript_full.jsonl.
  for (const filename of ["transcript_full.jsonl", "transcript.jsonl"]) {
    const candidate = path.join(logsDir, filename);
    const exists = await access(candidate).then(
      () => true,
      () => false,
    );
    if (exists) return candidate;
  }
  return null;
}

export function extractUserPrompt(raw: string, systemPrompt?: string): string {
  const matches = [...raw.matchAll(/<USER_REQUEST>\r?\n?([\s\S]*?)\r?\n?<\/USER_REQUEST>/g)];
  let text = matches.length > 0 ? matches.map((match) => match[1]).join("\n\n") : raw;
  if (systemPrompt && text.startsWith(`${systemPrompt}\n\n`)) {
    text = text.slice(systemPrompt.length + 2);
  }
  const hadAttachedImage = /Attached image: [^\n]*paseo-antigravity-images-/.test(text);
  text = text.replace(/\n?Attached image: [^\n]*paseo-antigravity-images-[^\n]*/g, "").trim();
  if (!text && hadAttachedImage) return "[Attached image]";
  return text;
}

export async function replayConversationHistory(options: {
  sessionId: string;
  conversationId: string;
  systemPrompt?: string;
  appHome?: string;
  emit(event: ProviderEvent): void;
}): Promise<void> {
  const transcriptPath = await resolveTranscriptPath(options.conversationId, options.appHome);
  if (!transcriptPath) return;

  const rows = await readTranscriptRows(transcriptPath);
  if (rows.length === 0) return;

  let firstUserSeen = false;
  let latestUsage: Required<
    Pick<ProviderUsage, "inputTokens" | "outputTokens" | "cachedInputTokens">
  > | null = null;

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const stepIndex = typeof row.step_index === "number" ? row.step_index : i;
    const timestamp = typeof row.created_at === "string" ? row.created_at : undefined;

    if (row.type === "USER_INPUT") {
      const rawContent = typeof row.content === "string" ? row.content : "";
      const text = extractUserPrompt(rawContent, firstUserSeen ? undefined : options.systemPrompt);
      firstUserSeen = true;
      latestUsage = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 };
      if (text) {
        const id = `history:user:${stepIndex}`;
        options.emit({
          type: "timeline.item",
          sessionId: options.sessionId,
          ...(timestamp ? { timestamp } : {}),
          item: { type: "user_message", id, messageId: id, text },
        });
      }
      continue;
    }

    if (row.type === "PLANNER_RESPONSE") {
      if (typeof row.input_tokens === "number" || typeof row.output_tokens === "number") {
        if (!latestUsage) {
          latestUsage = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 };
        }
        latestUsage.inputTokens += typeof row.input_tokens === "number" ? row.input_tokens : 0;
        latestUsage.outputTokens += typeof row.output_tokens === "number" ? row.output_tokens : 0;
        latestUsage.cachedInputTokens +=
          typeof row.cache_read_tokens === "number" ? row.cache_read_tokens : 0;
      }

      if (typeof row.thinking === "string" && row.thinking.trim().length > 0) {
        options.emit({
          type: "timeline.item",
          sessionId: options.sessionId,
          ...(timestamp ? { timestamp } : {}),
          item: {
            type: "reasoning",
            id: `history:reasoning:${stepIndex}`,
            text: row.thinking.trim(),
          },
        });
      }

      if (typeof row.content === "string" && row.content.length > 0) {
        const id = `history:assistant:${stepIndex}`;
        options.emit({
          type: "timeline.item",
          sessionId: options.sessionId,
          ...(timestamp ? { timestamp } : {}),
          item: { type: "assistant_message", id, messageId: id, text: row.content },
        });
      }

      const calls = Array.isArray(row.tool_calls) ? (row.tool_calls as TranscriptToolCall[]) : [];
      if (calls.length > 0) {
        let consumed = 0;
        for (let callIdx = 0; callIdx < calls.length; callIdx += 1) {
          const call = calls[callIdx];
          const nextRow = rows[i + 1 + consumed];
          const matchedResult =
            nextRow && nextRow.source === "MODEL" && nextRow.type === "GENERIC"
              ? nextRow
              : undefined;
          if (matchedResult) consumed += 1;

          const name =
            typeof call?.name === "string" && call.name ? call.name : "Antigravity tool";
          const parameters = toJsonObject(call?.args);
          const rawOutput = typeof matchedResult?.content === "string" ? matchedResult.content : "";
          const output = truncateOutput(rawOutput);
          const failed =
            matchedResult !== undefined &&
            (matchedResult.status === "ERROR" || typeof matchedResult.error === "string");
          const errorText = failed
            ? typeof matchedResult?.error === "string" && matchedResult.error
              ? matchedResult.error
              : "Antigravity tool failed"
            : null;
          const id = `history:tool:${stepIndex}:${callIdx}`;
          const detail = buildToolDetail(name, parameters, output, errorText);
          const itemTimestamp =
            typeof matchedResult?.created_at === "string" ? matchedResult.created_at : timestamp;

          options.emit({
            type: "timeline.item",
            sessionId: options.sessionId,
            ...(itemTimestamp ? { timestamp: itemTimestamp } : {}),
            item: failed
              ? {
                  type: "tool_call",
                  id,
                  callId: id,
                  name,
                  detail,
                  status: "failed",
                  error: errorText ?? "Antigravity tool failed",
                }
              : {
                  type: "tool_call",
                  id,
                  callId: id,
                  name,
                  detail,
                  status: matchedResult ? "completed" : "canceled",
                  error: null,
                },
          });
        }
        i += consumed;
      }
      continue;
    }

    if (row.type === "ERROR_MESSAGE" && typeof row.error === "string" && row.error.trim()) {
      options.emit({
        type: "timeline.item",
        sessionId: options.sessionId,
        ...(timestamp ? { timestamp } : {}),
        item: {
          type: "error",
          id: `history:error:${stepIndex}`,
          message: row.error.trim(),
        },
      });
    }
  }

  if (
    latestUsage &&
    (latestUsage.inputTokens > 0 ||
      latestUsage.outputTokens > 0 ||
      latestUsage.cachedInputTokens > 0)
  ) {
    options.emit({
      type: "session.usage",
      sessionId: options.sessionId,
      usage: latestUsage,
    });
  }
}

async function readTranscriptRows(filePath: string): Promise<TranscriptRow[]> {
  const stream = createReadStream(filePath, { encoding: "utf8" });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  const rows: TranscriptRow[] = [];
  try {
    for await (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          rows.push(parsed as TranscriptRow);
        }
      } catch {
        // Ignore a trailing partial JSON line written concurrently during an active turn.
      }
    }
  } finally {
    lines.close();
    stream.destroy();
  }
  return rows;
}

function toJsonObject(value: unknown): Parameters<typeof buildToolDetail>[1] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  try {
    return JSON.parse(JSON.stringify(value)) as Parameters<typeof buildToolDetail>[1];
  } catch {
    return {};
  }
}

function truncateOutput(text: string): string {
  if (text.length <= MAX_TOOL_OUTPUT_CHARS) return text;
  return `${text.slice(0, MAX_TOOL_OUTPUT_CHARS)}\n...[truncated ${text.length - MAX_TOOL_OUTPUT_CHARS} chars]`;
}
