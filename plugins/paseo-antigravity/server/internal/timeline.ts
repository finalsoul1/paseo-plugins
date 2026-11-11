import type {
  ProviderTimelineItem,
  ProviderToolCallDetail,
} from "@getpaseo/plugin/server/provider";
import type { Step } from "./wire.js";

type JsonObject = Extract<ProviderToolCallDetail, { type: "unknown" }>["input"] &
  Record<string, unknown>;

export function toolItem(
  step: Step,
  id: string,
): Extract<ProviderTimelineItem, { type: "tool_call" }> {
  const detail = toolDetailFromStep(step);
  const name = step.tool_name || "Antigravity tool";
  const metadata = step.subagent_info ? { subagents: step.subagent_info.subagents } : undefined;
  const base = { type: "tool_call" as const, id, callId: id, name, detail, metadata };
  if (step.state === "ERROR") {
    const error =
      step.tool_info && step.tool_info.error
        ? step.tool_info.error.message
        : "Antigravity tool failed";
    return { ...base, status: "failed", error };
  }
  const status = step.state === "ACTIVE" ? "running" : "completed";
  return { ...base, status, error: null };
}

function toolDetailFromStep(step: Step): ProviderToolCallDetail {
  if (step.subagent_info) {
    const child = step.subagent_info.subagents[0];
    if (child)
      return {
        type: "sub_agent",
        subAgentType: child.type_name,
        description: child.initial_prompt,
        childSessionId: child.conversation_id === null ? undefined : child.conversation_id,
        log: child.log_uri,
      };
  }
  const info = step.tool_info;
  if (!info) return { type: "plain_text", label: step.tool_name, text: "" };
  return buildToolDetail(
    info.name,
    info.parameters as JsonObject,
    info.output,
    info.error ? info.error.message : null,
  );
}

export function buildToolDetail(
  name: string,
  parameters: JsonObject,
  output: string,
  error: string | null,
): ProviderToolCallDetail {
  const filePath =
    stringField(parameters, "Path") ??
    stringField(parameters, "AbsolutePath") ??
    stringField(parameters, "TargetFile");

  if (name === "run_command") {
    const command = stringField(parameters, "CommandLine");
    if (command !== undefined) {
      return { type: "shell", command, output: stripCommandEnvelope(output) };
    }
  }
  if ((name === "read_file" || name === "view_file") && filePath !== undefined) {
    const startLine = numberField(parameters, "StartLine");
    const endLine = numberField(parameters, "EndLine");
    return {
      type: "read",
      filePath,
      content: stripTimestampHeader(output),
      ...(startLine !== undefined ? { offset: startLine } : {}),
      ...(startLine !== undefined && endLine !== undefined && endLine >= startLine
        ? { limit: endLine - startLine + 1 }
        : {}),
    };
  }
  if ((name === "write_file" || name === "write_to_file") && filePath !== undefined) {
    const content = stringField(parameters, "Content");
    return { type: "write", filePath, ...(content !== undefined ? { content } : {}) };
  }
  if (
    (name === "edit_file" ||
      name === "replace_file_content" ||
      name === "multi_replace_file_content") &&
    filePath !== undefined
  ) {
    const oldString = stringField(parameters, "Target");
    const newString = stringField(parameters, "Replacement");
    return {
      type: "edit",
      filePath,
      ...(oldString !== undefined ? { oldString } : {}),
      ...(newString !== undefined ? { newString } : {}),
    };
  }
  if (name === "search_web") {
    const query = stringField(parameters, "query");
    if (query !== undefined) {
      return { type: "search", query, toolName: "web_search", content: stripTimestampHeader(output) };
    }
  }
  if (name === "invoke_subagent") {
    const subAgentType = stringField(parameters, "TypeName");
    const description = stringField(parameters, "Prompt") ?? stringField(parameters, "Role");
    return {
      type: "sub_agent",
      ...(subAgentType !== undefined ? { subAgentType } : {}),
      ...(description !== undefined ? { description } : {}),
      log: stripTimestampHeader(output),
    };
  }
  return {
    type: "unknown",
    input: parameters,
    output: error ?? stripTimestampHeader(output),
  };
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function numberField(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stripCommandEnvelope(output: string): string {
  const match =
    /^Created At: [^\n]+\nCompleted At: [^\n]+\nCommand exited with code 0\.\n\nCommand output:\n([\s\S]*)$/.exec(
      output,
    );
  return match ? match[1] : output;
}

function stripTimestampHeader(output: string): string {
  return output.replace(/^Created At: [^\n]+\nCompleted At: [^\n]+\n/, "");
}
