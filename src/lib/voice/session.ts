import type { VoiceSession } from "./types";
import { createGeminiLiveToken } from "./gemini-token.functions";

export class BackendNotConnectedError extends Error {
  constructor(message = "Zarine's voice service isn't connected yet. This arrives in the next phase.") {
    super(message);
  }
}

/**
 * Phase 2 prep: obtains a short-lived token from our server, but does NOT open
 * a live Gemini session yet. Next step: use the token with
 * `new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: "v1beta" } }).live.connect(...)`.
 */
export function createVoiceSession(): VoiceSession {
  return {
    async connect() {
      const result = await createGeminiLiveToken();
      if (!result.ok) throw new BackendNotConnectedError(result.message);
      throw new BackendNotConnectedError(
        "Secure voice token received. The live voice connection will be switched on in the next step.",
      );
    },
    disconnect() {},
    async sendText() {
      throw new BackendNotConnectedError();
    },
  };
}

/** Real check: asks the browser for microphone permission, then releases it. */
export async function checkMicrophone(): Promise<"granted" | "denied" | "unavailable"> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return "unavailable";
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach((t) => t.stop());
    return "granted";
  } catch {
    return "denied";
  }
}
