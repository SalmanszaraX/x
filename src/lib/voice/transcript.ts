import type { TranscriptMessage } from "./types";

export interface CaptionRow extends TranscriptMessage {
  startMs: number;
  endMs: number;
}

export function appendCaption(rows: CaptionRow[], role: "user" | "zarine", delta: string, startMs: number, endMs: number): CaptionRow[] {
  if (!delta || !Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs < 0 || endMs < startMs) return rows;
  // Search by audio time, not arrival order: late fragments revise the same speaker's earlier row.
  const index = rows.findLastIndex((row) => row.role === role && startMs >= row.startMs && startMs <= row.endMs + 800);
  if (index < 0) return [...rows, { id: crypto.randomUUID(), role, text: delta, at: Date.now(), startMs, endMs }].sort((a, b) => a.startMs - b.startMs);
  return rows.map((row, i) => i === index ? { ...row, text: row.text + delta, endMs: Math.max(row.endMs, endMs) } : row);
}

export function voiceSeconds(reported: number): number {
  return Math.max(15, Number.isFinite(reported) && reported >= 0 ? reported : 0);
}