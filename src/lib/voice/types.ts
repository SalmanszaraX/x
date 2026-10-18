export type VoiceStatus = "ready" | "connecting" | "listening" | "speaking" | "disconnected";

export interface TranscriptMessage {
  id: string;
  role: "user" | "zarine" | "system";
  text: string;
  at: number;
}

/**
 * Contract a real voice backend must fulfil.
 * Phase 2: implement this with Google Gemini Live, using a short-lived token
 * issued by a server function (never a permanent key in the browser).
 */
export interface VoiceSession {
  connect(): Promise<void>;
  disconnect(): void;
  sendText(text: string): Promise<void>;
}
