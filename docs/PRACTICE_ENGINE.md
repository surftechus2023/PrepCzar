# Practice Engine

The practice engine retrieves stored content only. It does not generate, translate, score, or improve ordinary student practice items with AI.

## Content Eligibility

Student APIs return content only when it is:

- linked to the subscribed exam track
- active
- reviewed
- passed integrity or eligible through configured publication rules

## MCQ Sessions

- Standard session size: 100 questions.
- Questions are prioritized by unseen status.
- Blueprint weights are used when topic weights are available.
- Session progress, answers, time per item, difficulty, cognitive level, domain, and competency are saved.
- Completion stores score and weak-topic diagnostics.

## Flashcard Sessions

- Standard session size: 50 cards.
- Known and learning classifications are saved in `flashcard_reviews`.
- The review table stores a basic spaced-repetition foundation through `next_review_at`.

## Case Vignette Sessions

- Standard session size: 10 cases.
- Student responses are stored in `vignette_responses`.
- Stored rubric, ideal response, and coaching feedback are displayed without mandatory AI calls.

## Server-Side Access

`lib/access/server.ts` checks active exam access from `user_exam_access` and active/trialing subscriptions. Practice APIs call this guard before returning content or updating sessions.
