import type { VoiceStatus } from "@/lib/voice/types";
import { cn } from "@/lib/utils";

export function VoiceOrb({ status }: { status: VoiceStatus }) {
  const active = status === "listening" || status === "speaking";
  return (
    <div className="relative flex h-56 w-56 items-center justify-center sm:h-72 sm:w-72">
      {active && (
        <>
          <span className="absolute inset-6 rounded-full border border-primary/40 animate-ring" />
          <span className="absolute inset-6 rounded-full border border-primary/30 animate-ring [animation-delay:1.1s]" />
        </>
      )}
      {status === "connecting" && (
        <span className="absolute inset-2 rounded-full border-2 border-transparent border-t-primary animate-spin-slow" />
      )}
      <div
        className={cn(
          "orb h-40 w-40 rounded-full transition-all duration-700 sm:h-52 sm:w-52",
          status === "speaking" ? "animate-pulse-orb" : "animate-breathe",
          status === "disconnected" && "opacity-40 grayscale",
        )}
      />
      {active && (
        <div className="absolute flex h-12 items-center gap-1.5" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="h-full w-1.5 rounded-full bg-foreground/80 animate-bar"
              style={{ animationDelay: `${i * 0.12}s` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
