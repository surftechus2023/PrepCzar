# Setup

## Prerequisites

- Node.js 18 or newer
- npm
- Supabase project with migrations applied
- Stripe account with webhook access
- OpenAI API key

## Local Setup

1. Run `npm install`.
2. Copy `.env.example` to `.env`.
3. Fill in the values documented in `docs/ENVIRONMENT_VARIABLES.md`.
4. Start the app with `npm run dev`.
5. Open `http://localhost:3000`.

## Supabase Setup

Apply migrations from `supabase/migrations` in order. Do not rename or recreate production tables without a safe migration because existing users, subscriptions, generated content, and review metadata depend on current table names.

## Stripe Setup

Configure the webhook endpoint at `/api/stripe/webhook` and set `STRIPE_WEBHOOK_SECRET`. Checkout currently creates subscription prices from active `exam_tracks.monthly_price`, while price ID env vars remain documented for compatibility with future hosted-price flows.

## OpenAI Setup

Set `OPENAI_API_KEY` and model variables for generation, integrity review, improvement, import cleanup, translation, and case coaching. Keep API keys server-side only.

## Validation

Run these before deployment:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
