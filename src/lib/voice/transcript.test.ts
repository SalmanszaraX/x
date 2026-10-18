import { describe, expect, it } from "vitest";
import { appendCaption, voiceSeconds } from "./transcript";

describe("Live captions", () => {
  it("preserves whitespace fragments and repeated speech exactly", () => {
    let rows = appendCaption([], "user", "Hello", 0, 100);
    rows = appendCaption(rows, "user", " ", 100, 150);
    rows = appendCaption(rows, "user", "hello", 150, 300);
    expect(rows[0]?.text).toBe("Hello hello");
  });
  it("updates an earlier speaker row when a fragment arrives late", () => {
    let rows = appendCaption([], "user", "I need", 0, 400);
    rows = appendCaption(rows, "zarine", "What?", 1000, 1500);
    rows = appendCaption(rows, "user", " help", 400, 600);
    expect(rows.map((r) => r.text)).toEqual(["I need help", "What?"]);
  });
  it("keeps separate later turns and rejects invalid timing", () => {
    let rows = appendCaption([], "user", "One", 0, 100);
    rows = appendCaption(rows, "user", "Two", 3000, 3300);
    expect(rows).toHaveLength(2);
    expect(appendCaption(rows, "user", "bad", -1, 1)).toBe(rows);
  });
});

describe("Live usage snapshots", () => {
  it("includes the 15 second minimum without adding it to longer calls", () => {
    expect(voiceSeconds(10)).toBe(15);
    expect(voiceSeconds(90)).toBe(90);
  });
});