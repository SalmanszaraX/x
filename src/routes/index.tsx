import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Send, Play } from "lucide-react";
import { VoiceOrb } from "@/components/zarine/VoiceOrb";
import { useVoiceSession } from "@/lib/voice/session";
import { appendCaption, voiceSeconds, type CaptionRow } from "@/lib/voice/transcript";
import { Button } from "@/components/ui/button";
import type { TranscriptMessage, VoiceStatus } from "@/lib/voice/types";
import { cn } from "@/lib/utils";
import type { SearchSource } from "@/lib/voice/tools";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Zarine — Live Voice Assistant" },
      { name: "description", content: "Talk with Zarine, your personal AI voice assistant." },
      { property: "og:title", content: "Zarine — Live Voice Assistant" },
      { property: "og:description", content: "Talk with Zarine, your personal AI voice assistant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const LABELS: Record<VoiceStatus, string> = {
  ready: "Ready",
  connecting: "Connecting",
  listening: "Listening",
  speaking: "Zarine is speaking",
  disconnected: "Disconnected",
};
const DOT: Record<VoiceStatus, string> = {
  ready: "bg-success",
  connecting: "bg-warning animate-pulse",
  listening: "bg-primary animate-pulse",
  speaking: "bg-accent animate-pulse",
  disconnected: "bg-destructive",
};

let n = 0;
const msg = (role: TranscriptMessage["role"], text: string): TranscriptMessage => ({
  id: `${Date.now()}-${n++}`, role, text, at: Date.now(),
});

function Index() {
  const [status, setStatus] = useState<VoiceStatus>("ready");
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [captions, setCaptions] = useState<CaptionRow[]>([]);
  const [usage, setUsage] = useState<number | null>(null);
  const [thinking, setThinking] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ id: string; sources: SearchSource[]; searchEntryPoint: string }>>([]);
  const [text, setText] = useState("");
  const speech = useRef(false);
  const call = useVoiceSession((event) => {
    if (event.type === "app.tool.result" && event.sources) setSearchResults((rows) => [...rows, { id: String(event.id), sources: event.sources ?? [], searchEntryPoint: event.searchEntryPoint ?? "" }]);
    if (event.type === "app.tool.error") { setThinking(false); setMessages((rows) => [...rows, msg("system", event.error?.message ?? "The tool could not finish.")]); }
    if (event.type === "session.input_transcript.delta" || event.type === "session.output_transcript.delta") {
      if (typeof event.delta === "string" && typeof event.start_ms === "number" && typeof event.end_ms === "number") {
        setCaptions((rows) => appendCaption(rows, event.type === "session.input_transcript.delta" ? "user" : "zarine", event.delta as string, event.start_ms as number, event.end_ms as number));
      }
    }
    if (event.type === "app.connected") setStatus("listening");
    if (event.type === "app.stopping" || event.type === "app.closed") { setStatus("disconnected"); setThinking(false); }
    if (event.type === "app.delegation.pending") setThinking(true);
    if (event.type === "app.delegation.completed") setThinking(false);
    if (event.type === "gateway.session.created") setUsage(15);
    if (typeof event.usage?.seconds === "number") setUsage(voiceSeconds(event.usage.seconds));
    if (event.type === "app.greeting.error" || event.type === "error") setMessages((rows) => [...rows, msg("system", event.error?.message ?? "The voice command was not accepted.")]);
  });
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, captions]);
  const add = (m: TranscriptMessage) => setMessages((p) => [...p, m]);

  function start() {
    setStatus("connecting");
    speech.current = false;
    setMessages([]);
    setCaptions([]);
    setSearchResults([]);
    setUsage(null);
    call.session.connect();
  }

  function end() {
    call.session.disconnect();
    setStatus("disconnected");
    add(msg("system", "Conversation ended."));
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    try {
      await call.session.sendText(t);
      add(msg("user", t));
      setText("");
    } catch (err) {
      add(msg("system", (err as Error).message));
    }
  }

  const inCall = call.status === "connecting" || call.status === "connected" || call.status === "stopping";
  // Speaking reflects actual incoming speaker audio, not caption arrival or fabricated timers.
  useEffect(() => {
    if (call.status !== "connected") return;
    const audio = call.audioRef.current;
    const stream = audio?.srcObject;
    if (!(stream instanceof MediaStream)) return;
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    const timer = window.setInterval(() => {
      analyser.getByteTimeDomainData(samples);
      const audible = !audio?.paused && samples.some((sample) => Math.abs(sample - 128) > 5);
      if (audible !== speech.current) { speech.current = audible; setStatus(audible ? "speaking" : "listening"); }
    }, 120);
    return () => { clearInterval(timer); void context.close(); };
  }, [call.status, call.audioRef]);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-8 sm:py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Zarine</h1>
          <p className="text-sm text-muted-foreground">Live Voice Assistant</p>
        </div>
        <div className="glass flex items-center gap-2 rounded-full border px-4 py-2 text-sm" role="status" aria-live="polite">
          <span className={cn("h-2.5 w-2.5 rounded-full", DOT[status])} />
          {LABELS[status]}
        </div>
      </header>

      <div className="mt-6 grid flex-1 gap-6 lg:grid-cols-[1fr_420px]">
        <section className="flex flex-col items-center justify-center gap-8 py-6">
          <VoiceOrb status={status} />
          <p className="font-display text-xl text-foreground/90">{LABELS[status]}</p>
          <div className="flex w-full max-w-sm flex-col gap-3">
            <Button
              onClick={start}
              disabled={inCall}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
            >
              <Mic className="h-5 w-5" /> Start Conversation
            </Button>
            <Button variant="outline"
              onClick={end}
              disabled={!inCall || call.status === "stopping"}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-destructive/50 text-destructive transition hover:bg-destructive/10 disabled:opacity-30"
            >
              <PhoneOff className="h-4 w-4" /> End Conversation
            </Button>
            <Button variant="ghost" disabled={call.status !== "connected"} onClick={() => call.setMuted(!call.muted)}>
              {call.muted ? <MicOff /> : <Mic />} {call.muted ? "Unmute microphone" : "Mute microphone"}
            </Button>
            {call.playbackBlocked && <Button onClick={call.resumePlayback}><Play /> Play Zarine’s voice</Button>}
            <audio ref={call.audioRef} controls className="h-10 w-full" aria-label="Zarine voice playback" />
            {call.error && <p role="alert" className="break-words text-sm text-destructive">{call.error}</p>}
            {thinking && <p role="status" className="text-center text-sm text-muted-foreground">Zarine is thinking…</p>}
          </div>
        </section>

        <section className="glass flex min-h-[420px] flex-col rounded-2xl border lg:max-h-[calc(100vh-10rem)]">
          <h2 className="border-b px-5 py-4 text-sm font-medium uppercase tracking-widest text-muted-foreground">Transcript</h2>
          <div className="flex-1 space-y-3 overflow-y-auto p-5">
            {messages.length === 0 && captions.length === 0 && (
              <p className="pt-10 text-center text-sm text-muted-foreground">Your conversation will appear here.</p>
            )}
            {[...captions, ...messages].sort((a, b) => a.at - b.at).map((m) =>
              m.role === "system" ? (
                <p key={m.id} className="text-center text-xs text-muted-foreground">{m.text}</p>
              ) : (
                <div key={m.id} className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
                  <span className="mb-1 text-xs text-muted-foreground">{m.role === "user" ? "You" : "Zarine"}</span>
                  <div className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    m.role === "user" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-secondary",
                  )}>{m.text}</div>
                </div>
              ),
            )}
            {searchResults.map((result) => <div key={result.id} className="space-y-2 text-xs">
              <p className="font-medium text-muted-foreground">Sources</p>
              {result.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="block break-words text-primary underline">{source.title}</a>)}
              {result.searchEntryPoint && <iframe title="Search suggestions" srcDoc={result.searchEntryPoint} sandbox="allow-popups allow-popups-to-escape-sandbox" className="h-24 w-full border-0" />}
            </div>)}
            <div ref={endRef} />
          </div>
          <form onSubmit={send} className="flex gap-2 border-t p-3">
            <input
              value={text}
              aria-label="Message Zarine"
              disabled={call.status !== "connected"}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message instead…"
              className="h-11 flex-1 rounded-xl border bg-input px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <Button type="submit" size="icon" disabled={call.status !== "connected" || !text.trim()} aria-label="Send" className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:brightness-110">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </section>
      </div>

      <footer className="mt-8 flex flex-wrap justify-between gap-3 border-t py-4 text-xs text-muted-foreground">
        <p>Powered by Lovable AI · Voice usage is billed, including silence and a 15-second minimum.</p>
        {usage !== null && <p>{usage} voice seconds{call.finalized === false ? " · Final usage unconfirmed" : ""}</p>}
      </footer>
    </main>
  );
}
