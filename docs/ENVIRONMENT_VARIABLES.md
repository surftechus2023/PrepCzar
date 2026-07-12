# Environment Variables

Use `.env.example` as the source template. Never commit real credentials.

## Public Browser Variables

- `NEXT_PUBLIC_APP_URL` — canonical app origin, such as `http://localhost:3000` or the production domain.
- `NEXT_PUBLIC_SITE_URL` — legacy alias supported by existing code.
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous browser key.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — Stripe publishable key for browser-side Stripe flows.

## Server Secrets

- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service-role key for server API routes only.
- `STRIPE_SECRET_KEY` — Stripe secret key for checkout, portal, and webhook APIs.
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret.
- `OPENAI_API_KEY` — OpenAI API key for server-side model calls.

## Stripe Price Compatibility

Checkout currently uses `exam_tracks.monthly_price` to create Stripe subscription price data dynamically. These variables are still reserved for hosted Stripe price ID support:

- `STRIPE_PRICE_EPPP`
- `STRIPE_PRICE_BSW`
- `STRIPE_PRICE_LMSW`
- `STRIPE_PRICE_LCSW`
- `STRIPE_PRICE_NCE`
- `STRIPE_PRICE_CCM`
- `STRIPE_PRICE_NCLEX_RN`
- `STRIPE_PRICE_NCLEX_PN`
- `STRIPE_PRICE_SOCIAL_WORK`
- `STRIPE_PRICE_NCLEX`

## OpenAI Model Variables

- `CONTENT_GENERATION_MODEL`
- `CONTENT_INTEGRITY_MODEL`
- `CONTENT_IMPROVEMENT_MODEL`
- `IMPORT_CLEANUP_MODEL`
- `TRANSLATION_MODEL`
- `CASE_COACHING_MODEL`
- `CONTENT_BLUEPRINT_REVIEW_MODEL`
- `CONTENT_DIFFICULTY_MODEL`
- `CONTENT_DISTRACTOR_MODEL`
- `CONTENT_PSYCHOMETRIC_MODEL`
- `CONTENT_BIAS_MODEL`
- `CONTENT_SECURITY_MODEL`
- `CONTENT_REWRITE_MODEL`
- `CONTENT_FINAL_REVIEW_MODEL`
- `CONTENT_COMMITTEE_MODEL`

## Safety Rules

- Only variables prefixed with `NEXT_PUBLIC_` are safe to reference from client components.
- Keep `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `OPENAI_API_KEY` out of browser bundles.
- Prefer `NEXT_PUBLIC_APP_URL`; keep `NEXT_PUBLIC_SITE_URL` until all legacy references are removed.
