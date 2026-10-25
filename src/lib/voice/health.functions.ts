import { createServerFn } from "@tanstack/react-start";
import { GEMINI_CHAT_MODEL, GEMINI_LIVE_MODEL, GEMINI_SEARCH_MODEL } from "./gemini-config";

export type HealthStatus = {
  voiceKey: "configured" | "missing";
  n8n: "configured" | "not_configured";
  searchProvider: string;
  liveModel: string;
  searchModel: string;
  chatModel: string;
};

/** Reports configuration presence only; never returns secret values. */
export const getVoiceHealth = createServerFn({ method: "GET" }).handler(async (): Promise<HealthStatus> => ({
  voiceKey: process.env["GEMINI_API_KEY"] ? "configured" : "missing",
  n8n: process.env["N8N_WEBHOOK_URL"] ? "configured" : "not_configured",
  searchProvider: "Google Search grounding via the configured Google key",
  liveModel: GEMINI_LIVE_MODEL,
  searchModel: GEMINI_SEARCH_MODEL,
  chatModel: GEMINI_CHAT_MODEL,
}));
