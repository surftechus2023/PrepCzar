# Performance

PrepCzar should serve normal student learning from stored Supabase content. AI calls are limited to admin generation, review, improvement, import cleanup, translation jobs, and optional case coaching when enabled.

## Runtime Rules

- Do not call AI to serve MCQs, flashcards, stored rationales, stored translations, or basic diagnostics.
- Fetch only fields needed by the current practice mode.
- Keep authenticated dashboard data dynamic; do not cache private user data across users.
- Avoid loading entire question banks into the browser.
- Paginate admin content tables and batch expensive operations.

## Database Indexes

Performance indexes live in `supabase/migrations/20260713000400_performance_indexes.sql`.

They target:

- Published practice delivery by exam track, status, difficulty, and created date.
- Topic and blueprint-objective lookup for questions.
- Flashcard and case-vignette practice delivery.
- Practice sessions by user, exam track, mode, completion status, and start date.
- Responses by session and question.
- Subscription access by user, exam track, status, and expiration date.

Apply with:

```bash
supabase db push
```

## Next.js Practices

- Prefer server components for authenticated route shells and read-only pages.
- Use client components only for interaction-heavy screens.
- Add route `loading.tsx` and `error.tsx` fallbacks for admin and dashboard sections.
- Use responsive layouts instead of fixed-width tables or cards.
- Keep private API routes `dynamic = 'force-dynamic'` where user-specific data is returned.

## Admin Tables

Admin question review uses paginated API retrieval. New admin tables should follow the same pattern:

- Accept `page` and `limit`.
- Cap `limit` server-side.
- Return pagination metadata.
- Use `range()` rather than fetching all rows.

## Performance QA

Before release:

- Run `npm run build`.
- Open dashboard and practice routes with devtools network throttling.
- Confirm no OpenAI requests occur during ordinary MCQ or flashcard practice.
- Confirm admin content lists paginate instead of retrieving all records.
- Confirm Supabase query plans use the delivery indexes for large content tables.
