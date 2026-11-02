import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

const viewId = z.string().min(1).max(64);

export const openView = defineRpc({
  name: "remote-browser.open",
  input: z.object({
    viewId,
    url: z.string().min(1),
    width: z.number().int().min(100).max(2000),
    height: z.number().int().min(100).max(3000),
    scale: z.number().min(1).max(3),
  }),
  output: z.object({ ok: z.literal(true) }),
});

export const nextFrame = defineRpc({
  name: "remote-browser.frame",
  input: z.object({ viewId, afterSeq: z.number().int() }),
  output: z.object({
    seq: z.number().int(),
    jpegBase64: z.string().nullable(),
    url: z.string(),
  }),
});

export const sendInput = defineRpc({
  name: "remote-browser.input",
  input: z.object({
    viewId,
    action: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("tap"), x: z.number(), y: z.number() }),
      z.object({
        kind: z.literal("scroll"),
        x: z.number(),
        y: z.number(),
        dx: z.number(),
        dy: z.number(),
      }),
      z.object({ kind: z.literal("text"), text: z.string().min(1) }),
      z.object({ kind: z.literal("key"), key: z.enum(["Enter", "Backspace"]) }),
      z.object({ kind: z.literal("back") }),
      z.object({ kind: z.literal("forward") }),
      z.object({ kind: z.literal("reload") }),
      z.object({ kind: z.literal("goto"), url: z.string().min(1) }),
    ]),
  }),
  output: z.object({ ok: z.literal(true) }),
});

export const closeView = defineRpc({
  name: "remote-browser.close",
  input: z.object({ viewId }),
  output: z.object({ ok: z.literal(true) }),
});
