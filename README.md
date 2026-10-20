# Welcome to your Lovable project

## Zarine Google migration status — 20 October 2026

### Audit and files

The former Gateway integration existed only in `src/lib/live-relay.server.ts`: `createOpenAI`, `LOVABLE_API_KEY`, `openai/gpt-live-1`, and delegated `openai/gpt-6-astra` intelligence. It was invoked through `src/server.ts`, `live-vite-plugin.ts`, and `vite.config.ts`. There was no separate HTTP text-chat endpoint; typed questions previously went through the voice relay. The relay, its Vite adapter, and the old Gateway browser hook have now been removed, and `/api/live` returns 410 in the server entry instead of starting a paid connection.

- `src/lib/voice/session.ts`: selects the direct Google voice adapter.
- `src/hooks/use-gemini-voice.ts`: microphone capture, ordered WebSocket events, playback queue, mute, interruption cleanup, and typed voice-session messages.
- `src/lib/voice/gemini-config.ts`: verified model, endpoints, fixed assistant identity and restricted setup.
- `src/lib/voice/gemini-token.functions.ts`: secure single-use token provisioning; no permanent key returned or upstream body logged.
- `src/lib/voice/pcm.ts` and `microphone-worklet.js`: microphone PCM conversion and capture.
- `src/lib/voice/events.ts`: provider-independent UI event contract.
- `src/lib/voice/chat-config.ts` and `chat.functions.ts`: prepared separate server-side text intelligence using the existing OpenAI adapter, preserved assistant instructions and caller-supplied conversation history. Not connected to the UI because live tests of the required endpoint did not respond.
- `src/lib/voice/gemini-config.test.ts`: token restriction and audio conversion tests.
- `AGENTS.md`, `roadmap.md`, `package.json` and `bun.lock`: architecture, outstanding checks, and dependency cleanup.

### Exact models and endpoints

- Live model: `gemini-3.8-live`, confirmed in the saved key's full Google model listing with `bidiGenerateContent` and a successful constrained WebSocket setup.
- Token: `POST https://generativelanguage.googleapis.com/v1beta/auth_tokens`.
- Voice: `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained`, authenticated using `access_token` with a short-lived token only.
- Prepared text model: `gemini-3.8-flash`, confirmed in the Google model listing.
- Prepared text endpoint: `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`.
- Service: Gemini Developer API, not Vertex AI. Only `GEMINI_API_KEY` is required, already saved server-side; no key changes, database, gateway or additional account configuration was introduced.

The token is single-use, permits a new session for one minute, and expires after thirty minutes. Google REST discovery requires `bidiGenerateContentSetup`; the guide's SDK-shaped `liveConnectConstraints` was rejected with HTTP 400. A full fixed setup without a field mask locks the model, audio modality, transcripts and assistant instructions server-side.

### What actually passed

Browser checks used the real app at `http://localhost:8080` and real Google responses, not mocked assistant replies. Google greeted the user as Zarine, answered the typed question “What is seven times eight?” with a spoken “fifty-six,” and produced readable captions. The speaking label reflected actual incoming audio. Mute/unmute, interruption by a new typed request, and End Conversation were exercised; ending released playback and re-enabled Start. No runtime errors were observed. Network inspection found no Gateway requests; voice traffic went directly to Google. Thirteen unit/routing tests passed and the app check reported build OK.

### Remaining limitations and billing

- Synthetic microphone tests sent hundreds of real PCM frames and received only partial recognized words (“Hello” or “What”), not a complete reliably recognized question. Full listening and spoken barge-in verification is incomplete; typed interruption passed.
- Separate OpenAI-compatible text tests, streaming and non-streaming, did not return within their diagnostic deadlines. The prepared function is intentionally not connected to the UI. Existing typed replies continue through the verified Google Live session, not the Gateway. No automatic provider fallback occurs.
- The old billing footer is still visible as instructed until full direct voice verification; it no longer describes the active connection. It originates from page copy, not a Google billing warning.
- The direct voice path makes no Lovable AI Gateway requests, so it creates no Gateway voice charges. Google usage remains subject to the owner's Google account pricing and quota; no Google paid-tier setting was changed or inspected. Historical credit charges and Lovable app hosting are separate and were not audited here.
- Published behavior and physical Android microphone recognition have not been tested. This app is not published.
- Existing access policy remains unchanged: the token function is same-origin/CSRF-protected but not login-protected. Single-use tokens protect the permanent key, not public usage quotas; do not treat this as authenticated access control.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
