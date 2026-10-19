import type { LiveEvent } from "@/hooks/use-live-voice";
import { useGeminiVoice } from "@/hooks/use-gemini-voice";
import type { VoiceSession } from "./types";

/** Provider adapter: the page sees the VoiceSession contract, not transport APIs. */
export function useVoiceSession(onEvent: (event: LiveEvent) => void) {
  const call = useGeminiVoice(onEvent);
  const session: VoiceSession = {
    connect: call.start,
    disconnect: call.stop,
    sendText: call.sendText,
  };
  return { ...call, session };
}
