import { describe, expect, it, vi } from "vitest";
import { executeTool } from "./search.server";
import { restrictedTokenRequest } from "./gemini-config";
import { blockedUrlReason, htmlToText } from "./web";

describe("Real tool execution", () => {
  it("declares the connected tools in the restricted voice setup", () => {
    expect(restrictedTokenRequest(0).bidiGenerateContentSetup.tools[0]?.functionDeclarations.map((t) => t.name)).toEqual(["search_web", "fetch_page", "trigger_automation"]);
  });
  it("does not execute unconnected tools", async () => {
    const request = vi.fn();
    expect((await executeTool("send_email", {}, { geminiKey: "test" }, undefined, request)).ok).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
  it("requires configured authorization", async () => {
    const request = vi.fn();
    expect((await executeTool("search_web", { query: "weather" }, {}, undefined, request)).ok).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
  it("returns only actual grounded source links and verified search metadata", async () => {
    const request = vi.fn().mockResolvedValue(Response.json({ candidates: [{ content: { parts: [{ text: "Current facts" }] }, groundingMetadata: {
      webSearchQueries: ["current facts"], groundingChunks: [{ web: { title: "Source", uri: "https://example.com/news" } }, { web: { uri: "javascript:alert(1)" } }], searchEntryPoint: { renderedContent: "<p>Search</p>" },
    } }] }));
    const result = await executeTool("search_web", { query: "current facts" }, { geminiKey: "test" }, undefined, request);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.sources).toEqual([{ title: "Source", url: "https://example.com/news" }]);
    const call = request.mock.calls[0];
    expect(call).toBeDefined();
    if (!call) throw new Error("Search did not execute");
    expect(JSON.parse(call[1].body).tools).toEqual([{ google_search: {} }]);
  });
  it("does not claim a search when no grounding sources were returned", async () => {
    const request = vi.fn().mockResolvedValue(Response.json({ candidates: [{ content: { parts: [{ text: "An unsupported answer" }] } }] }));
    expect((await executeTool("search_web", { query: "news" }, { geminiKey: "test" }, undefined, request)).ok).toBe(false);
  });
  it("reports the actual quota failure instead of success", async () => {
    const request = vi.fn().mockResolvedValue(new Response("private provider body", { status: 429 }));
    const result = await executeTool("search_web", { query: "news" }, { geminiKey: "test" }, undefined, request);
    expect(result).toEqual({ ok: false, error: "Web search is unavailable because the search account's quota or rate limit was exceeded. No verified search results were returned." });
  });
  it("handles network failure without exposing private errors", async () => {
    const request = vi.fn().mockRejectedValue(new Error("secret"));
    const result = await executeTool("search_web", { query: "news" }, { geminiKey: "test" }, undefined, request);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("secret");
  });
});

describe("Page retrieval safety", () => {
  it("blocks private and non-web addresses before any request", () => {
    for (const url of [
      "http://localhost/admin", "http://127.0.0.1/", "http://10.0.0.5/", "http://192.168.1.1/",
      "http://172.16.0.1/", "http://169.254.169.254/latest", "http://[::1]/", "http://[fd00::1]/",
      "file:///etc/passwd", "javascript:alert(1)", "https://user:pass@example.com/",
      "http://printer.internal/", "not a url",
    ]) {
      expect(blockedUrlReason(url), url).not.toBeNull();
    }
    expect(blockedUrlReason("https://example.com/article")).toBeNull();
  });
  it("never requests a blocked URL", async () => {
    const request = vi.fn();
    const result = await executeTool("fetch_page", { url: "http://192.168.0.1/router" }, {}, undefined, request);
    expect(result.ok).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
  it("extracts readable text without executing page scripts", async () => {
    const request = vi.fn().mockResolvedValue(new Response(
      "<html><head><style>body{color:red}</style><script>alert(1)</script></head><body><h1>Real story</h1><p>Enough readable page text to pass the minimum length check.</p></body></html>",
      { status: 200, headers: { "content-type": "text/html" } },
    ));
    const result = await executeTool("fetch_page", { url: "https://example.com/story" }, {}, undefined, request);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toContain("Real story");
      expect(result.text).not.toContain("alert(1)");
      expect(result.sources).toEqual([{ title: "example.com", url: "https://example.com/story" }]);
    }
  });
  it("revalidates redirect targets and blocks redirects to private networks", async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "http://169.254.169.254/meta" } }));
    const result = await executeTool("fetch_page", { url: "https://example.com/short" }, {}, undefined, request);
    expect(result.ok).toBe(false);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("reports inaccessible pages honestly", async () => {
    const request = vi.fn().mockResolvedValue(new Response("paywall", { status: 403 }));
    const result = await executeTool("fetch_page", { url: "https://example.com/paid" }, {}, undefined, request);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("not publicly accessible");
  });
  it("rejects non-readable content types", async () => {
    const request = vi.fn().mockResolvedValue(new Response("binary", { status: 200, headers: { "content-type": "application/pdf" } }));
    expect((await executeTool("fetch_page", { url: "https://example.com/file.pdf" }, {}, undefined, request)).ok).toBe(false);
  });
});

describe("Automation tool", () => {
  it("refuses to run without explicit user approval", async () => {
    const request = vi.fn();
    const result = await executeTool("trigger_automation", { task: "publish video" }, { n8nWebhookUrl: "https://n8n.example.com/webhook/x" }, undefined, request);
    expect(result.ok).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
  it("reports honestly when no workflow is configured", async () => {
    const request = vi.fn();
    const result = await executeTool("trigger_automation", { task: "publish video", confirmed: true }, {}, undefined, request);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("N8N_WEBHOOK_URL");
    expect(request).not.toHaveBeenCalled();
  });
  it("sends the approved payload and reports delivery, not completion", async () => {
    const request = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    const result = await executeTool("trigger_automation", { task: "publish video", details: "topic A", confirmed: true }, { n8nWebhookUrl: "https://n8n.example.com/webhook/x", n8nWebhookSecret: "s" }, undefined, request);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text).toContain("not completion");
    const call = request.mock.calls[0];
    if (!call) throw new Error("Automation did not execute");
    expect(JSON.parse(call[1].body)).toMatchObject({ task: "publish video", details: "topic A" });
    expect(call[1].headers.Authorization).toBe("Bearer s");
  });
  it("reports workflow rejection instead of claiming success", async () => {
    const request = vi.fn().mockResolvedValue(new Response("bad", { status: 500 }));
    const result = await executeTool("trigger_automation", { task: "publish video", confirmed: true }, { n8nWebhookUrl: "https://n8n.example.com/webhook/x" }, undefined, request);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("500");
  });
});

describe("Page text extraction", () => {
  it("strips markup, scripts and entities", () => {
    expect(htmlToText("<p>Tom &amp; Jerry</p><script>steal()</script>")).toBe("Tom & Jerry");
  });
});
