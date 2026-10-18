export type VoiceStatus = "ready" | "connecting" | "listening" | "speaking" | "disconnected";

export interface TranscriptMessage {
  id: string;
  role: "user" | "zarine" | "system";
  text: string;
  at: number;
}

/**
 * Contract a real voice backend must fulfil.
 * UI-facing contract; providers and permanent credentials stay outside the UI.
 */
export interface VoiceSession {
  connect(): void | Promise<void>;
  disconnect(): void;
  sendText(text: string): Promise<void>;
}
