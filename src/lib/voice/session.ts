import type { VoiceSession } from "./types";

export class BackendNotConnectedError extends Error {
  constructor() {
    super("Zarine's voice service isn't connected yet. This arrives in the next phase.");
  }
}

/** Placeholder session: no fake replies. Replace with a Gemini Live session in Phase 2. */
export function createVoiceSession(): VoiceSession {
  return {
    async connect() {
      await new Promise((r) => setTimeout(r, 900));
      throw new BackendNotConnectedError();
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
