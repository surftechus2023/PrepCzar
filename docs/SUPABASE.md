# Supabase

Run all migrations in `supabase/migrations`.

Required tables:

- `users` and compatibility view `profiles`
- `exam_categories`
- `exam_tracks`
- `topics`
- `questions`
- `flashcards`
- `case_vignettes`
- `subscriptions`
- `user_exam_access`
- `practice_sessions`
- `responses`
- `scores`
- `generation_logs`

Access model:

- Stripe webhooks write `subscriptions`.
- A trigger syncs active Stripe-backed subscriptions into `user_exam_access`.
- Student content RLS checks `user_exam_access.active = true`.
- Questions, flashcards, and vignettes require `active = true` and `reviewed = true`.

Before launch, test a new Supabase auth user and confirm the signup trigger inserts a row in `users` and that the `profiles` view returns the same row.
