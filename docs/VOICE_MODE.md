# Voice Mode

Voice mode uses browser-native speech synthesis and speech recognition where available. It is an accessibility and convenience feature, not a safety feature, and must not be positioned as safe for active driving.

## Supported Browsers

- Chrome desktop: expected speech synthesis and recognition support.
- Edge desktop: expected speech synthesis and recognition support.
- Chrome Android: expected support, subject to microphone permission and device settings.
- Safari/iOS: speech synthesis may work, but speech recognition is limited or unavailable depending on browser version and platform restrictions.

When recognition is unavailable, PrepCzar shows:

> Voice recognition is not supported in this browser. Use Chrome or Edge, or answer manually.

Manual A/B/C/D answer buttons remain available at all times.

## Security Requirements

Microphone access and speech recognition require:

- HTTPS in production.
- `http://localhost` during local development.

On insecure non-localhost origins, voice input displays:

> Voice input requires HTTPS or localhost.

## Runtime Flow

The voice-practice flow prevents the microphone from hearing the app’s own text-to-speech output:

1. Stop active recognition.
2. Cancel existing speech synthesis.
3. Read the question and options.
4. Wait for `SpeechSynthesisUtterance.onend`.
5. Delay briefly before listening.
6. Request microphone permission.
7. Start recognition.
8. Process transcript.
9. Match the transcript to one answer option.
10. Announce feedback after the answer is selected.

## Recognition States

The UI exposes these states:

- `idle` — Tap to answer.
- `requesting_permission` — Requesting microphone permission.
- `listening` — Listening.
- `hearing_speech` — Speech detected.
- `processing` — Processing answer.
- `success` — Answer captured.
- `error` — Permission, browser, network, language, or no-speech error.

## Spoken Answer Matching

Supported examples:

- `A`, `Option A`, `Answer A`
- `first`, `second`, `third`, `fourth`
- Spanish equivalents such as `primera`, `segunda`, `tercera`, `cuarta`
- French equivalents such as `première`, `deuxième`, `troisième`, `quatrième`
- Exact or partial answer text when it maps to one clear option

Ambiguous transcripts are not auto-submitted. The UI asks for confirmation when it can infer a likely option.

## Local Testing

1. Run `npm run dev`.
2. Open `http://localhost:3000` in Chrome or Edge.
3. Log in as a subscribed student.
4. Open MCQ voice practice.
5. Click `Read + Listen`.
6. Allow microphone permission.
7. Confirm the app starts listening only after the question and options finish reading.
8. Speak `B` or `second option`.
9. Confirm the answer is selected and feedback is spoken.

## Deployed HTTPS Testing

1. Deploy to Vercel with the production HTTPS URL.
2. Confirm Vercel env vars use the deployed domain.
3. Open voice practice in Chrome or Edge.
4. Confirm microphone permission prompt appears.
5. Confirm permission denial shows a clear error.
6. Confirm manual buttons still work when recognition fails.

## Manual QA Checklist

- Permission granted.
- Permission denied.
- No microphone detected.
- Microphone already in use.
- Insecure non-localhost URL warning.
- Unsupported browser fallback.
- TTS finishes before listening starts.
- Correct answer heard and selected.
- Ambiguous answer requires confirmation.
- Retry after no speech.
- Stop Listening stops recognition.
- Manual fallback works.
- Chrome Android works.
- Edge desktop works.
- Production HTTPS works.
