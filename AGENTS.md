<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Voice logic lives behind the `VoiceSession` interface and `useVoiceSession` adapter in src/lib/voice; the UI never talks to an AI provider directly. Why: keeps transport and provider changes out of presentation code.
- Gemini Live auth: browser gets a single-use ephemeral token from `createGeminiLiveToken` (server fn reading GEMINI_API_KEY); the permanent key never leaves the server. Why: Google's recommended client-to-server security model.
- Active voice uses AI Gateway Live through the server-owned `/api/live` relay with client delegation; Gemini token preparation is inactive. Why: the requested feature uses AI Gateway without exposing permanent keys or requiring a database.
- Keep the official use-live-voice hook and relay lifecycle intact; transcript state is per-page and timestamp-aware. Why: preserves immediate Stop, usage cleanup, and late caption updates without fabricating turns.
