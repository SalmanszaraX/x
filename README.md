# x

Build a polished, responsive browser app named Zarine — Live Voice Assistant.

This is Phase 1 of a larger personal AI assistant project. I am a beginner and do not want to write code manually.

Design

Elegant, futuristic, sophisticated interface.

Dark navy/black background, subtle violet accents, clean typography.

A central animated voice orb or waveform.

Clear status labels: Ready, Connecting, Listening, Zarine is speaking, and Disconnected.

A large Start Conversation button and an End Conversation button.

A readable conversation transcript with separate user and Zarine messages.

A text input as a fallback if the microphone is unavailable.

Responsive layout for desktop and Android mobile browsers.

Phase 1 requirements

Build the user interface and its interaction states.

Do not simulate successful AI conversations or fake live audio.

Do not add a permanent API key to frontend code.

Do not connect n8n, Telegram, video generation, or posting yet.

Keep the code organized so we can connect Google Gemini Live API securely in the next step.

Clearly distinguish interface features that work now from features awaiting backend integration.

First build the interface and show me how to preview it. Do not add unnecessary databases, paid services, subscriptions, or unrelated features.

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

## Conversational tools audit — 21 October 2026

### Root causes

- `src/lib/voice/gemini-config.ts`: the active Live prompt cautioned against claiming tool access and declared no tools at all. API access alone did not provide browsing.
- `src/hooks/use-gemini-voice.ts`: the direct socket supported audio, transcripts and typed conversation, but had no handling for Live `toolCall`, `toolResponse` or cancellation events.
- `src/lib/voice/chat-config.ts`: the separate inactive text prompt explicitly said it had no external tools/live search. `chat.functions.ts` remains disconnected; it was not causing the active voice reply, and its instructions now clarify that boundary.
- Existing server functions provisioned Live tokens and prepared text answers; none performed web search. No search integration was configured or invoked.
- `GEMINI_API_KEY` presence and the Google models catalog were checked without revealing credentials. The key/model/provider and direct voice endpoint remain unchanged. Lovable Cloud was enabled as required for added server-side functionality; no application tables, storage, sign-in UI or Gateway AI use were added.

### Smallest fixes

- The restricted server-owned Live setup now declares `search_web`; Zarine decides when to call it, instead of applying a fixed search workflow to all conversation.
- `tools.ts` owns declarations, validated search arguments and serializable results; `tools.functions.ts` exposes the server RPC; `search.server.ts` executes only the explicitly registered read-only tool. Unknown tools are rejected without performing an action. Future tools must be explicitly registered and permission-checked before execution; no email, private-account or posting actions are connected.
- Search calls native Google `POST /v1beta/models/gemini-3.8-flash:generateContent` with `google_search`. The model is present in this account's catalog. This avoids the previously unresponsive OpenAI-compatible endpoint and does not replace Live voice.
- The controller returns each result to Live with its matching function-call ID. Provider cancellations and End Conversation abort pending RPCs and discard late results, while ordered audio processing continues without awaiting search.
- Search success requires actual web-search metadata, answer text and HTTPS grounding-source links. No sources means failure, not a fabricated grounded answer. Source links appear in the existing transcript; returned Google search suggestions render in a sandboxed frame. The successful source UI has not yet been verified with real results.
- Failures return safe, accurate errors (quota, authorization, service failure or timeout), never secret-bearing upstream bodies. The model is instructed not to pretend success. The existing same-origin public access policy is unchanged; this is not login-protected quota control.

Official references: https://ai.google.dev/api/live, https://ai.google.dev/gemini-api/docs/live-api/tools, https://ai.google.dev/gemini-api/docs/generate-content/google-search. Live built-in search support for the selected model was not assumed; its declared function is executed explicitly by our server.

### Actual test results

- **General conversation, real browser/Google session:** Zarine greeted the user, answered the typed “What is seven times eight?” with “fifty-six,” returned 49 PCM audio messages over the tested session, and made zero tool calls for the arithmetic question.
- **Current-information request, separately in the same real session:** “Search the web now for the latest stable Chrome desktop version, with current source links” caused a real `search_web` function call, a server-side Google request and a matching unsuccessful tool response. Google returned HTTP 429; the transcript displayed the account quota/rate-limit problem and Zarine said she could not check the current version. No current result or source was invented.
- **Tool failures:** real quota failure verified end-to-end; unit tests separately verify unknown-tool refusal, missing authorization, ungrounded responses and network failure. Successful grounded-result parsing/source filtering was tested with a fixture only, not claimed as real search verification.
- **Regression checks:** 20 tests passed; preview check reported build OK. End Conversation released audio and re-enabled Start. Browser reported no runtime errors. The existing screen and direct Google voice were preserved. Physical microphone recognition and spoken barge-in remain unverified from the earlier migration.

**Blocker:** the saved Google account currently rejects generateContent search with `RESOURCE_EXHAUSTED` (429). A second catalog-listed model returned the same status; no silent model/provider fallback was added. A successful source-backed search must be retested after account quota/access is available. Google billing settings were not changed or verified; the code cannot resolve account quota. The old footer was left intact under the standing requirement, despite not describing the active direct voice connection.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f91e3b79-29eb-47c5-be11-88d76c7ef900).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
