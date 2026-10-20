import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { z } from "zod";
import { CHAT_SYSTEM_PROMPT, GEMINI_CHAT_BASE_URL, GEMINI_CHAT_MODEL } from "./chat-config";

const input = z.object({ messages: z.array(z.object({
  role: z.enum(["user", "assistant"]), content: z.string().min(1).max(12000),
})).min(1).max(200) });

export const answerGeminiText = createServerFn({ method: "POST" })
  .inputValidator((data) => input.parse(data))
  .handler(async ({ data }): Promise<{ ok: true; text: string } | { ok: false; message: string }> => {
    const key = process.env["GEMINI_API_KEY"];
    if (!key) return { ok: false, message: "Voice authorization has not been configured." };
    try {
      const provider = createOpenAI({ baseURL: GEMINI_CHAT_BASE_URL, apiKey: key });
      const result = streamText({
        model: provider.chat(GEMINI_CHAT_MODEL),
        messages: data.messages,
        system: CHAT_SYSTEM_PROMPT,
        maxRetries: 0,
        abortSignal: getRequest().signal,
      });
      let text = "";
      let completed = false;
      for await (const part of result.fullStream) {
        if (part.type === "text-delta") text += part.text;
        if (part.type === "error") throw part.error;
        if (part.type === "finish") completed = part.finishReason === "stop";
      }
      if (!completed || !text.trim()) return { ok: false, message: "Zarine could not finish the answer. No fallback service was used." };
      return { ok: true, text: text.trim() };
    } catch {
      // Never log SDK exceptions: request headers can include the permanent key.
      return { ok: false, message: "Zarine could not answer right now. No fallback service was used." };
    }
  });