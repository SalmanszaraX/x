// Verified against this key's Google models catalog and a constrained Live handshake.
export const GEMINI_LIVE_MODEL = "gemini-3.8-live";
export const GEMINI_TOKEN_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/auth_tokens";
export const GEMINI_VOICE_ENDPOINT = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained";

export function restrictedLiveSetup() {
  return {
    model: `models/${GEMINI_LIVE_MODEL}`,
    generationConfig: { responseModalities: ["AUDIO"] },
    sessionResumption: {},
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    realtimeInputConfig: { activityHandling: "START_OF_ACTIVITY_INTERRUPTS" },
    systemInstruction: { parts: [{ text: "You are Zarine, a warm personal voice assistant. Introduce yourself only as Zarine. Never mention Gemini or backend providers. Speak naturally in brief replies. Initially speak English, then follow the user's language. Listen and stop speaking when interrupted. Do not invent memories or claim access to external services or tools." }] },
  };
}

export function restrictedTokenRequest(now: number) {
  return {
    uses: 1,
    expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
    newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
    // Google REST discovery calls this bidiGenerateContentSetup, not the SDK's liveConnectConstraints.
    // No fieldMask means the server-owned setup is used in full, ignoring client overrides.
    bidiGenerateContentSetup: restrictedLiveSetup(),
  };
}