import { z } from "zod";

export const searchArgs = z.object({ query: z.string().trim().min(1).max(1000) }).strict();
export const TOOL_DECLARATIONS = [{
  name: "search_web",
  description: "Search the live web for current information or facts needing verification. Include the complete standalone question and relevant conversation context. Do not use for ordinary conversation. Returns verified sources or an actual error.",
  parameters: { type: "OBJECT", properties: { query: { type: "STRING", description: "Standalone search question with relevant context" } }, required: ["query"] },
}];
export type SearchSource = { title: string; url: string };
export type ToolResult =
  | { ok: true; text: string; sources: SearchSource[]; searchEntryPoint: string; searchedAt: string }
  | { ok: false; error: string };

export function safeSourceUrl(value: string): boolean {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}