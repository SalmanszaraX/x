import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Mic, PhoneOff, Send, CheckCircle2, Clock } from "lucide-react";
import { VoiceOrb } from "@/components/zarine/VoiceOrb";
import { checkMicrophone, createVoiceSession } from "@/lib/voice/session";
import type { TranscriptMessage, VoiceStatus } from "@/lib/voice/types";
import { cn } from "@/lib/utils";

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
  const [text, setText] = useState("");
  const session = useRef(createVoiceSession());
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages]);
  const add = (m: TranscriptMessage) => setMessages((p) => [...p, m]);

  async function start() {
    setStatus("connecting");
    const mic = await checkMicrophone();
    if (mic !== "granted") {
      add(msg("system", mic === "denied"
        ? "Microphone access was blocked. You can use the text box below instead."
        : "No microphone is available in this browser. You can use the text box below instead."));
    } else {
      add(msg("system", "Microphone access granted."));
    }
    try {
      await session.current.connect();
      setStatus("listening");
    } catch (e) {
      add(msg("system", (e as Error).message));
      setStatus("disconnected");
    }
  }

  function end() {
    session.current.disconnect();
    setStatus("disconnected");
    add(msg("system", "Conversation ended."));
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    add(msg("user", t));
    setText("");
    try {
      await session.current.sendText(t);
    } catch (err) {
      add(msg("system", (err as Error).message));
    }
  }

  const inCall = status === "connecting" || status === "listening" || status === "speaking";

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
            <button
              onClick={start}
              disabled={inCall}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
            >
              <Mic className="h-5 w-5" /> Start Conversation
            </button>
            <button
              onClick={end}
              disabled={!inCall}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-destructive/50 text-destructive transition hover:bg-destructive/10 disabled:opacity-30"
            >
              <PhoneOff className="h-4 w-4" /> End Conversation
            </button>
          </div>
        </section>

        <section className="glass flex min-h-[420px] flex-col rounded-2xl border lg:max-h-[calc(100vh-10rem)]">
          <h2 className="border-b px-5 py-4 text-sm font-medium uppercase tracking-widest text-muted-foreground">Transcript</h2>
          <div className="flex-1 space-y-3 overflow-y-auto p-5">
            {messages.length === 0 && (
              <p className="pt-10 text-center text-sm text-muted-foreground">Your conversation will appear here.</p>
            )}
            {messages.map((m) =>
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
            <div ref={endRef} />
          </div>
          <form onSubmit={send} className="flex gap-2 border-t p-3">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message instead…"
              className="h-11 flex-1 rounded-xl border bg-input px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button type="submit" aria-label="Send" className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:brightness-110">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </section>
      </div>

      <footer className="glass mt-8 grid gap-4 rounded-2xl border p-5 text-sm sm:grid-cols-2">
        <div>
          <p className="mb-2 flex items-center gap-2 font-medium text-success"><CheckCircle2 className="h-4 w-4" /> Works now</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>Status indicators, animated orb, buttons</li>
            <li>Real microphone permission check</li>
            <li>Transcript and text input</li>
          </ul>
        </div>
        <div>
          <p className="mb-2 flex items-center gap-2 font-medium text-warning"><Clock className="h-4 w-4" /> Coming in Phase 2</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>Live voice with Google Gemini</li>
            <li>Zarine's spoken and written replies</li>
            <li>Secure key handling on the server</li>
          </ul>
        </div>
      </footer>
    </main>
  );
}
