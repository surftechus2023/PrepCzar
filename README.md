# PrepCzar

PrepCzar is a Next.js/Supabase/Stripe/OpenAI exam-prep SaaS app for track-specific professional exam subscriptions.

## Local Development

1. Install dependencies: `npm install`
2. Copy env values: `cp .env.example .env`
3. Start the app: `npm run dev`
4. Build for production: `npm run build`

## Production Requirements

- Supabase migrations pushed, including `user_exam_access` and `generation_logs`.
- Stripe webhook configured for `/api/stripe/webhook`.
- Stripe checkout and billing portal tested with real test-mode events.
- OpenAI key configured only for admin generation.
- Secrets rotated before launch if they were ever committed, pasted, or shared.

## Validation

Run `npm run lint`, `npm run typecheck`, and `npm run build` before deploying.

See `docs/` for setup, Supabase, Stripe, OpenAI, deployment, testing, and admin guidance.
