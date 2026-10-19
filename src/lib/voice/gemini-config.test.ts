import { describe, expect, it } from "vitest";
import { restrictedTokenRequest, GEMINI_VOICE_ENDPOINT } from "./gemini-config";
import { decodePcm, encodePcm } from "./pcm";

describe("Direct voice security", () => {
  it("restricts tokens to one session", () => { expect(restrictedTokenRequest(0).uses).toBe(1); });
  it("restricts the verified model and audio response modality", () => {
    const setup = restrictedTokenRequest(0).bidiGenerateContentSetup;
    expect(setup.model).toBe("models/gemini-3.8-live");
    expect(setup.generationConfig.responseModalities).toEqual(["AUDIO"]);
  });
  it("expires new session authorization after one minute", () => {
    expect(Date.parse(restrictedTokenRequest(0).newSessionExpireTime)).toBe(60000);
  });
  it("expires session authorization after thirty minutes", () => {
    expect(Date.parse(restrictedTokenRequest(0).expireTime)).toBe(1800000);
  });
  it("enables barge-in interruption", () => {
    expect(restrictedTokenRequest(0).bidiGenerateContentSetup.realtimeInputConfig.activityHandling).toBe("START_OF_ACTIVITY_INTERRUPTS");
  });
  it("routes voice only to Google's constrained Developer API", () => {
    expect(GEMINI_VOICE_ENDPOINT).toBe("wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained");
  });
});
describe("Microphone PCM", () => {
  it("encodes signed little endian audio at 16kHz", () => {
    const decoded = decodePcm(encodePcm(new Float32Array([-1, 0, 1]), 16000));
    expect(Array.from(decoded)).toEqual([-1, 0, 32767 / 32768]);
  });
  it("resamples 48kHz capture to 16kHz", () => {
    expect(decodePcm(encodePcm(new Float32Array(480), 48000))).toHaveLength(160);
  });
});