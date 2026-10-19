import { createServerFn } from "@tanstack/react-start";
import { GEMINI_LIVE_MODEL, GEMINI_TOKEN_ENDPOINT, restrictedTokenRequest } from "./gemini-config";

/**
 * Model and constraints taken from the official Gemini Live ephemeral-token docs:
 * https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens
 */
export { GEMINI_LIVE_MODEL } from "./gemini-config";

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

    const request = restrictedTokenRequest(Date.now());
    const { expireTime, newSessionExpireTime } = request;
    let res: Response;
    try {
      res = await fetch(GEMINI_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(request),
      });
    } catch {
      return { ok: false, reason: "upstream_error", message: "The voice service could not be reached. No fallback connection was started." };
    }

    if (!res.ok) {
      // Never log upstream bodies: they may include credentials or token material.
      return { ok: false, reason: "upstream_error", message: `The voice service could not authorize a call (${res.status}). No fallback connection was started.` };
    }
    const body = (await res.json()) as { name?: string };
    if (!body.name) {
      return { ok: false, reason: "upstream_error", message: "Google returned no token." };
    }
    return { ok: true, token: body.name, model: GEMINI_LIVE_MODEL, expireTime, newSessionExpireTime };
  },
);
