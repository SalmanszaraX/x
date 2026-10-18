import { createServerFn } from "@tanstack/react-start";

/**
 * Model and constraints taken from the official Gemini Live ephemeral-token docs:
 * https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens
 */
export const GEMINI_LIVE_MODEL = "gemini-3.8-live";

export type LiveTokenResult =
  | { ok: true; token: string; model: string; expireTime: string; newSessionExpireTime: string }
  | { ok: false; reason: "not_configured" | "upstream_error"; message: string };

/**
 * Asks Google for a single-use, short-lived Live API token.
 * GEMINI_API_KEY is read only here on the server and is never returned.
 */
export const createGeminiLiveToken = createServerFn({ method: "POST" }).handler(
  async (): Promise<LiveTokenResult> => {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) {
      return { ok: false, reason: "not_configured", message: "The Gemini key hasn't been added yet." };
    }

    const now = Date.now();
    const expireTime = new Date(now + 30 * 60 * 1000).toISOString();
    const newSessionExpireTime = new Date(now + 60 * 1000).toISOString();

    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        uses: 1,
        expireTime,
        newSessionExpireTime,
        liveConnectConstraints: {
          model: `models/${GEMINI_LIVE_MODEL}`,
          config: { sessionResumption: {}, responseModalities: ["AUDIO"] },
        },
      }),
    });

    if (!res.ok) {
      console.error("Gemini auth_tokens failed", res.status, await res.text().catch(() => ""));
      return { ok: false, reason: "upstream_error", message: "Google couldn't issue a voice token right now." };
    }
    const body = (await res.json()) as { name?: string };
    if (!body.name) {
      return { ok: false, reason: "upstream_error", message: "Google returned no token." };
    }
    return { ok: true, token: body.name, model: GEMINI_LIVE_MODEL, expireTime, newSessionExpireTime };
  },
);
