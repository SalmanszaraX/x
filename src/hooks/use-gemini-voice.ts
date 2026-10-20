import { useCallback, useEffect, useRef, useState } from "react";
import { createGeminiLiveToken } from "@/lib/voice/gemini-token.functions";
import { GEMINI_VOICE_ENDPOINT, restrictedLiveSetup } from "@/lib/voice/gemini-config";
import { decodePcm, encodePcm } from "@/lib/voice/pcm";
import workletUrl from "@/lib/voice/microphone-worklet.js?url";
import type { LiveEvent } from "@/lib/voice/events";
import { answerGeminiText } from "@/lib/voice/chat.functions";

type State = {
  status: "idle" | "connecting" | "connected" | "stopping" | "closed";
  error: string | null;
  muted: boolean;
  playbackBlocked: boolean;
  hasConnected: boolean;
  finalized: boolean | null;
};
const initial: State = { status: "idle", error: null, muted: false, playbackBlocked: false, hasConnected: false, finalized: null };

export function useGeminiVoice(onEvent: (event: LiveEvent) => void) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const controller = useRef<ReturnType<typeof createDirectVoice> | null>(null);
  const latest = useRef(onEvent);
  const mounted = useRef(false);
  const [call, setCall] = useState(initial);
  useEffect(() => { latest.current = onEvent; });
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; controller.current?.stop(); controller.current = null; };
  }, []);

  const start = useCallback(() => {
    const audio = audioRef.current;
    if (!mounted.current || controller.current || !audio) return;
    const voice = createDirectVoice(audio, (event) => {
      if (!mounted.current || controller.current !== voice) return;
      if (event.type === "app.connected") setCall((s) => ({ ...s, status: "connected", hasConnected: true }));
      if (event.type === "app.error") setCall((s) => ({ ...s, error: event.error?.message ?? "Voice connection failed." }));
      if (event.type === "app.stopping") setCall((s) => ({ ...s, status: "stopping", playbackBlocked: false }));
      if (event.type === "app.closed") {
        controller.current = null;
        setCall((s) => ({ ...s, status: "closed", muted: false, playbackBlocked: false }));
      }
      if (event.type === "app.playback.blocked" || event.type === "app.playback.resumed") {
        setCall((s) => ({ ...s, playbackBlocked: event.type === "app.playback.blocked" }));
      }
      latest.current(event);
    });
    controller.current = voice;
    setCall({ ...initial, status: "connecting" });
    void voice.start();
  }, []);
  const stop = useCallback(() => controller.current?.stop(), []);
  const setMuted = useCallback((muted: boolean) => {
    if (controller.current?.setMuted(muted)) setCall((s) => ({ ...s, muted }));
  }, []);
  const resumePlayback = useCallback(() => { void controller.current?.resumePlayback(); }, []);
  const sendText = useCallback(async (text: string) => {
    const voice = controller.current;
    if (!voice) throw new Error("Start a conversation before sending a message.");
    await voice.sendText(text);
  }, []);
  return { ...call, audioRef, start, stop, setMuted, resumePlayback, sendText };
}

type ServerMessage = {
  setupComplete?: object;
  goAway?: object;
  error?: { code?: number };
  serverContent?: {
    interrupted?: boolean;
    turnComplete?: boolean;
    inputTranscription?: { text?: string; finished?: boolean };
    outputTranscription?: { text?: string; finished?: boolean };
    modelTurn?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
  };
};

function createDirectVoice(audio: HTMLAudioElement, emit: (event: LiveEvent) => void) {
  let state: "starting" | "active" | "closed" = "starting";
  let socket: WebSocket | undefined;
  let microphone: MediaStream | undefined;
  let context: AudioContext | undefined;
  let input: MediaStreamAudioSourceNode | undefined;
  let capture: AudioWorkletNode | undefined;
  let destination: MediaStreamAudioDestinationNode | undefined;
  let muted = false;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let nextAudioTime = 0;
  const sources = new Set<AudioBufferSourceNode>();
  const startedAt = Date.now();
  const captionTimes: Record<"user" | "zarine", { start: number; end: number; finished: boolean }> = {
    user: { start: 0, end: 0, finished: true }, zarine: { start: 0, end: 0, finished: true },
  };
  let messages = Promise.resolve();
  const history: Array<{ role: "user" | "assistant"; content: string }> = [];
  let textRequest: AbortController | undefined;
  let historyRevision = 0;
  let currentCaption: Record<"user" | "zarine", string> = { user: "", zarine: "" };
  function saveCaption(role: "user" | "zarine") {
    const text = currentCaption[role].trim();
    if (text) history.push({ role: role === "user" ? "user" : "assistant", content: text });
    currentCaption[role] = "";
  }
  function closed() { return state === "closed"; }

  function clearPlayback() {
    for (const source of sources) { source.onended = null; source.stop(); source.disconnect(); }
    sources.clear();
    nextAudioTime = context?.currentTime ?? 0;
  }
  function stop() {
    if (state === "closed") return;
    state = "closed";
    textRequest?.abort();
    emit({ type: "app.stopping" });
    clearTimeout(deadline);
    window.removeEventListener("pagehide", stop);
    microphone?.getTracks().forEach((track) => track.stop());
    if (capture) { capture.port.onmessage = null; capture.disconnect(); }
    input?.disconnect();
    clearPlayback();
    audio.pause(); audio.srcObject = null;
    if (context) void context.close().catch(() => {});
    socket?.close();
    emit({ type: "app.closed" });
  }
  function fail(message: string) {
    if (state === "closed") return;
    emit({ type: "app.error", error: { message } }); stop();
  }
  function send(message: object) {
    if (state === "closed" || socket?.readyState !== WebSocket.OPEN) return false;
    if (socket.bufferedAmount > 256 * 1024) { fail("Voice connection is too slow. Start a new call to retry."); return false; }
    socket.send(JSON.stringify(message)); return true;
  }
  async function resumePlayback() {
    if (state === "closed" || !context) return;
    try {
      await context.resume();
      await audio.play();
      if (!closed()) emit({ type: "app.playback.resumed" });
    } catch {
      if (!closed()) emit({ type: "app.playback.blocked" });
    }
  }
  function caption(role: "user" | "zarine", transcription?: { text?: string; finished?: boolean }) {
    if (!transcription) return;
    const times = captionTimes[role];
    if (times.finished) times.start = Math.max(Date.now() - startedAt, times.end + 1000);
    times.end = Math.max(times.start, Date.now() - startedAt);
    if (transcription.text) emit({
      type: role === "user" ? "session.input_transcript.delta" : "session.output_transcript.delta",
      delta: transcription.text, start_ms: times.start, end_ms: times.end,
    });
    times.finished = transcription.finished === true;
    currentCaption[role] += transcription.text ?? "";
    if (role === "user" && transcription.text) { historyRevision++; textRequest?.abort(); }
    if (times.finished) saveCaption(role);
  }
  function play(data: string, mime: string) {
    if (state !== "active" || !context || !destination) return;
    const samples = decodePcm(data);
    if (!samples.length) return;
    const rate = Number(/rate=(\d+)/.exec(mime)?.[1] ?? 24000);
    const buffer = context.createBuffer(1, samples.length, rate);
    buffer.getChannelData(0).set(samples);
    const source = context.createBufferSource(); source.buffer = buffer;
    source.connect(destination);
    const when = Math.max(context.currentTime + 0.02, nextAudioTime);
    nextAudioTime = when + buffer.duration;
    sources.add(source);
    source.onended = () => { sources.delete(source); source.disconnect(); };
    source.start(when);
  }
  function receive(event: ServerMessage) {
    if (state === "closed") return;
    if (event.error) return fail(`The voice service rejected the call (${event.error.code ?? "unknown"}). No fallback was started.`);
    if (event.goAway) return fail("The voice session is ending. Start a new conversation to continue.");
    if (event.setupComplete && state === "starting") {
      clearTimeout(deadline); state = "active";
      emit({ type: "app.connected" });
      void resumePlayback();
      send({ clientContent: { turns: [{ role: "user", parts: [{ text: "Introduce yourself briefly as Zarine and ask how you can help today." }] }], turnComplete: true } });
    }
    const content = event.serverContent;
    if (!content) return;
    if (content.interrupted) { clearPlayback(); saveCaption("zarine"); captionTimes.zarine.finished = true; emit({ type: "app.interrupted" }); }
    caption("user", content.inputTranscription);
    caption("zarine", content.outputTranscription);
    for (const part of content.modelTurn?.parts ?? []) {
      const inline = part.inlineData;
      if (!content.interrupted && inline?.data && inline.mimeType?.startsWith("audio/pcm")) play(inline.data, inline.mimeType);
    }
    if (content.turnComplete) {
      saveCaption("zarine"); captionTimes.zarine.finished = true;
      emit({ type: "app.delegation.completed" });
    }
  }
  async function start() {
    window.addEventListener("pagehide", stop);
    // Create and unlock audio during the user's Start gesture, before async authorization.
    context = new AudioContext();
    void context.resume().catch(() => {});
    destination = context.createMediaStreamDestination();
    audio.srcObject = destination.stream;
    void resumePlayback();
    try {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        if (state === "closed") { stream.getTracks().forEach((track) => track.stop()); return; }
        microphone = stream;
      } catch {
        if (closed()) return;
        emit({ type: "app.error", error: { message: "Microphone unavailable. You can still type messages in this conversation." } });
      }
      if (microphone) {
        await context.audioWorklet.addModule(workletUrl);
        if (closed()) return;
        input = context.createMediaStreamSource(microphone);
        capture = new AudioWorkletNode(context, "zarine-microphone");
        input.connect(capture);
        // The processor emits only zeros, so this keeps capture running without microphone feedback.
        capture.connect(context.destination);
        capture.port.onmessage = ({ data }: MessageEvent<Float32Array>) => {
          if (state !== "active" || muted || !context) return;
          try { send({ realtimeInput: { audio: { data: encodePcm(data, context.sampleRate), mimeType: "audio/pcm;rate=16000" } } }); }
          catch { fail("Microphone audio could not be sent. Start a new call to retry."); }
        };
      }
      const result = await createGeminiLiveToken();
      if (closed()) return;
      if (!result.ok) return fail(result.message);
      const endpoint = new URL(GEMINI_VOICE_ENDPOINT);
      endpoint.searchParams.set("access_token", result.token);
      socket = new WebSocket(endpoint);
      deadline = setTimeout(() => fail("Voice startup timed out. Start a new call to retry."), 20_000);
      socket.onopen = () => { if (state === "closed") socket?.close(); else send({ setup: restrictedLiveSetup() }); };
      socket.onmessage = ({ data }) => {
        // Blob decoding is asynchronous: preserve provider event order.
        messages = messages.then(async () => {
          if (state === "closed") return;
          const text = typeof data === "string" ? data : await (data as Blob).text();
          receive(JSON.parse(text) as ServerMessage);
        }).catch(() => fail("The voice service sent an unreadable message."));
      };
      socket.onerror = () => fail("The voice connection failed. No fallback connection was started.");
      socket.onclose = ({ code }) => {
        if (state !== "closed") fail(`Voice connection ended (${code}). Start a new call to retry.`);
      };
    } catch {
      fail("Voice could not start. No fallback connection was started.");
    }
  }
  function setMuted(value: boolean) {
    if (state === "closed") return false;
    muted = value;
    microphone?.getAudioTracks().forEach((track) => { track.enabled = !value; });
    if (value && state === "active") send({ realtimeInput: { audioStreamEnd: true } });
    return true;
  }
  async function sendText(text: string) {
    if (state !== "active" || !text.trim() || text.length > 4000) throw new Error("Start a conversation before sending a message.");
    clearPlayback();
    textRequest?.abort();
    saveCaption("user"); saveCaption("zarine");
    captionTimes.zarine.finished = true;
    history.push({ role: "user", content: text });
    const revision = ++historyRevision;
    const request = new AbortController(); textRequest = request;
    emit({ type: "app.delegation.pending" });
    try {
      const result = await answerGeminiText({ data: { messages: history.slice(-200) }, signal: request.signal });
      if (closed() || request.signal.aborted || revision !== historyRevision) return;
      if (!result.ok) throw new Error(result.message);
      send({ clientContent: { turns: [{ role: "user", parts: [{ text: `The user asked: ${JSON.stringify(text)}. Read this answer aloud naturally, without adding anything: ${JSON.stringify(result.text)}` }] }], turnComplete: true } });
    } catch (error) {
      if (!request.signal.aborted && !closed()) throw new Error(error instanceof Error ? error.message : "Zarine could not answer right now.");
    } finally {
      if (textRequest === request) { textRequest = undefined; emit({ type: "app.delegation.completed" }); }
    }
  }
  return { start, stop, setMuted, resumePlayback, sendText };
}