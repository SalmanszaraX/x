import { describe, expect, it, vi } from "vitest";
import { executeTool } from "./search.server";
import { restrictedTokenRequest } from "./gemini-config";

describe("Real tool execution", () => {
  it("declares web search in the restricted voice setup", () => {
    expect(restrictedTokenRequest(0).bidiGenerateContentSetup.tools[0].functionDeclarations.map((t) => t.name)).toEqual(["search_web"]);
  });
  it("does not execute unconnected tools", async () => {
    const request = vi.fn();
    expect((await executeTool("send_email", {}, "test", undefined, request)).ok).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
  it("requires configured authorization", async () => {
    const request = vi.fn();
    expect((await executeTool("search_web", { query: "weather" }, undefined, undefined, request)).ok).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
  it("returns only actual grounded source links and verified search metadata", async () => {
    const request = vi.fn().mockResolvedValue(Response.json({ candidates: [{ content: { parts: [{ text: "Current facts" }] }, groundingMetadata: {
      webSearchQueries: ["current facts"], groundingChunks: [{ web: { title: "Source", uri: "https://example.com/news" } }, { web: { uri: "javascript:alert(1)" } }], searchEntryPoint: { renderedContent: "<p>Search</p>" },
    } }] }));
    const result = await executeTool("search_web", { query: "current facts" }, "test", undefined, request);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.sources).toEqual([{ title: "Source", url: "https://example.com/news" }]);
    expect(JSON.parse(request.mock.calls[0][1].body).tools).toEqual([{ google_search: {} }]);
  });
  it("does not claim a search when no grounding sources were returned", async () => {
    const request = vi.fn().mockResolvedValue(Response.json({ candidates: [{ content: { parts: [{ text: "An unsupported answer" }] } }] }));
    expect((await executeTool("search_web", { query: "news" }, "test", undefined, request)).ok).toBe(false);
  });
  it("reports the actual quota failure instead of success", async () => {
    const request = vi.fn().mockResolvedValue(new Response("private provider body", { status: 429 }));
    const result = await executeTool("search_web", { query: "news" }, "test", undefined, request);
    expect(result).toEqual({ ok: false, error: "Web search is unavailable because the search account's quota or rate limit was exceeded. No verified search results were returned." });
  });
  it("handles network failure without exposing private errors", async () => {
    const request = vi.fn().mockRejectedValue(new Error("secret"));
    const result = await executeTool("search_web", { query: "news" }, "test", undefined, request);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("secret");
  });
});