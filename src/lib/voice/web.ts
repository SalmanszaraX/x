/**
 * Public-URL validation for server-side page retrieval.
 * Blocks non-http(s) schemes, IP literals outside public ranges, and
 * well-known internal hostnames. DNS re-resolution is not available in the
 * edge runtime, so redirect targets are re-validated hop by hop instead.
 */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
]);

const BLOCKED_SUFFIXES = [".local", ".internal", ".localhost", ".corp", ".lan"];

function isPrivateIpv4(parts: number[]): boolean {
  const [a, b] = parts;
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224 // multicast, reserved, broadcast
  );
}

function isBlockedIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "::" || normalized === "::1" ||
    normalized.startsWith("fe80:") || // link-local
    normalized.startsWith("fc") || normalized.startsWith("fd") || // unique local
    normalized.startsWith("::ffff:") // IPv4-mapped: literal check below covers dotted form
  );
}

/** Returns an error reason when the URL must not be fetched, otherwise null. */
export function blockedUrlReason(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "That is not a valid web address.";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return "Only public http and https pages can be opened.";
  }
  if (url.username || url.password) return "Addresses with embedded credentials are not allowed.";
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host) || BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return "That address points to a private network and cannot be opened.";
  }
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const parts = ipv4.slice(1).map(Number);
    if (parts.some((part) => part > 255)) return "That is not a valid web address.";
    if (isPrivateIpv4(parts)) return "That address points to a private network and cannot be opened.";
  }
  if (host.startsWith("[") && isBlockedIpv6(host.slice(1, -1))) {
    return "That address points to a private network and cannot be opened.";
  }
  return null;
}

const MAX_BYTES = 200_000;

/** Reads at most MAX_BYTES of a response body as text. */
export async function readLimitedText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    chunks.push(value);
    if (total >= MAX_BYTES) { void reader.cancel(); break; }
  }
  const merged = new Uint8Array(Math.min(total, MAX_BYTES));
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk.subarray(0, merged.length - offset), offset);
    offset += chunk.byteLength;
    if (offset >= merged.length) break;
  }
  return new TextDecoder().decode(merged);
}

/** Strips markup to readable text. Retrieved content is data, never executed. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|iframe|svg|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
