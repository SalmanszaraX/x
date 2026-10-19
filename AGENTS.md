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
- Active voice uses the direct Google Developer API controller behind useVoiceSession; the legacy Gateway relay and hook are inactive and must never be a fallback. Why: avoids unintended workspace voice charges.
- The direct voice controller owns ordered socket events, AudioWorklet capture, queued PCM playback and immediate Stop/interruption cleanup; transcript state remains per-page. Why: preserves the existing UI behavior across transport changes.
- Temporary-token restrictions use the Google REST discovery schema's bidiGenerateContentSetup, with the full setup fixed server-side and no fieldMask. Why: prevents client overrides and avoids unsupported SDK field names in raw REST.
