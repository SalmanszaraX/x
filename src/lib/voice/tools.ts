import { z } from "zod";

export const searchArgs = z.object({ query: z.string().trim().min(1).max(1000) }).strict();
export const fetchPageArgs = z.object({ url: z.string().trim().min(1).max(2000) }).strict();
export const automationArgs = z.object({
  task: z.string().trim().min(1).max(2000),
  details: z.string().trim().max(8000).optional(),
  confirmed: z.literal(true),
}).strict();

export const TOOL_DECLARATIONS = [
  {
    name: "search_web",
    description: "Search the live web for current information or facts needing verification. Include the complete standalone question and relevant conversation context. Do not use for ordinary conversation. Returns verified sources or an actual error.",
    parameters: { type: "OBJECT", properties: { query: { type: "STRING", description: "Standalone search question with relevant context" } }, required: ["query"] },
  },
  {
    name: "fetch_page",
    description: "Retrieve and read a specific public web page that the user named or that appeared in search results. Use only for http or https pages. Returns extracted page text or an actual error.",
    parameters: { type: "OBJECT", properties: { url: { type: "STRING", description: "Full public http or https URL to read" } }, required: ["url"] },
  },
  {
    name: "trigger_automation",
    description: "Start the user's configured n8n automation workflow. Only call this after the user has explicitly approved the exact action in this conversation, and then set confirmed to true. Never call it for ordinary conversation.",
    parameters: {
      type: "OBJECT",
      properties: {
        task: { type: "STRING", description: "The approved action the workflow should perform" },
        details: { type: "STRING", description: "Optional approved payload details such as topic, script or options" },
        confirmed: { type: "BOOLEAN", description: "Must be true, and only after explicit user approval" },
      },
      required: ["task", "confirmed"],
    },
  },
];

export type SearchSource = { title: string; url: string };
export type ToolResult =
  | { ok: true; text: string; sources: SearchSource[]; searchEntryPoint: string; searchedAt: string }
  | { ok: false; error: string };

export function safeSourceUrl(value: string): boolean {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}
