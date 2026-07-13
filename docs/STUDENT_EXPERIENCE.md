# Student Experience

PrepCzar student screens are subscription-scoped. A student can only load dashboard content, practice content, and session records for exam tracks with active access.

## Dashboard

- Shows subscribed exam tracks only.
- Shows recent sessions, recent scores, weak blueprint domains, incomplete sessions, and subscription status.
- Recommends the next practice mode from stored diagnostics.
- Displays practice-score disclaimers; PrepCzar scores do not guarantee official exam outcomes.

## Practice Modes

- MCQ full sessions request up to 100 approved, active, reviewed questions.
- Flashcard sessions request up to 50 approved, active cards.
- Case vignette sessions request up to 10 approved, active cases.
- Normal MCQ, flashcard, and stored vignette review does not call AI.
- Optional AI coaching must stay behind explicit feature and usage controls.

## Access Control

Access is enforced server-side in practice APIs. Hidden buttons are not treated as security. If a student requests an unsubscribed exam track directly, the API returns an access error and the UI redirects to subscriptions.

## Languages

Student practice uses stored English, Spanish, and French fields. Pages do not translate on every load with AI.

## Manual QA Checklist

- Sign in as a BSW-only subscriber and verify LMSW, LCSW, NCLEX, EPPP, NCE, and CCM are not available.
- Visit a restricted practice URL directly and confirm access is denied.
- Start, answer, exit, and resume an MCQ session.
- Complete MCQ practice and confirm rationales, answer review, bookmarks, and weak-domain report.
- Review flashcards and confirm known/learning classifications persist.
- Submit a vignette response and confirm stored coaching feedback displays.
- Test English, Spanish, and French toggles on content with stored translations.
- Test 320px, 375px, 390px, tablet, and desktop widths for no horizontal scrolling.
