import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { executeTool } from "./search.server";

const input = z.object({ name: z.string().min(1).max(128), args: z.unknown() });
export const runVoiceTool = createServerFn({ method: "POST" })
  .inputValidator((data) => input.parse(data))
  .handler(async ({ data }) =>
    executeTool(data.name, data.args, {
      geminiKey: process.env["GEMINI_API_KEY"],
      n8nWebhookUrl: process.env["N8N_WEBHOOK_URL"],
      n8nWebhookSecret: process.env["N8N_WEBHOOK_SECRET"],
    }, getRequest().signal));
