# Deployment

PrepCzar deploys to Vercel with Supabase, Stripe, and OpenAI. Production deployment should use Vercel environment variables and must not rely on local `.env` files.

## Predeployment Checks

Run locally before deploying:

```bash
npm run lint
npm run typecheck
npm run build
git status --short
```

Required result:

- Lint, typecheck, and build pass.
- Git working tree is clean after committed deployment changes.
- Supabase migrations have been applied with `supabase db push`.
- `.env`, `.env.local`, and provider secrets are not committed.
- `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_SITE_URL` point to the production HTTPS origin in Vercel.
- Required legal pages exist: privacy, terms, refund, contact/support, accessibility, and exam/AI disclaimers.

## Vercel Environment Variables

Set these in Vercel Project Settings → Environment Variables:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_EPPP`
- `STRIPE_PRICE_BSW`
- `STRIPE_PRICE_LMSW`
- `STRIPE_PRICE_LCSW`
- `STRIPE_PRICE_NCE`
- `STRIPE_PRICE_CCM`
- `STRIPE_PRICE_NCLEX_RN`
- `STRIPE_PRICE_NCLEX_PN`
- `OPENAI_API_KEY`
- `CONTENT_GENERATION_MODEL`
- `CONTENT_INTEGRITY_MODEL`
- `CONTENT_IMPROVEMENT_MODEL`
- `IMPORT_CLEANUP_MODEL`
- `TRANSLATION_MODEL`
- `CASE_COACHING_MODEL`
- `OPENAI_ALLOWED_MODELS`

Keep secret values server-side only. Never prefix private keys with `NEXT_PUBLIC_`.

## Supabase

Before production traffic:

- Confirm Supabase Auth site URL matches `NEXT_PUBLIC_APP_URL`.
- Add redirect URLs for login, email confirmation, password reset, and payment confirmation.
- Confirm migrations are applied and migration history is current.
- Confirm RLS policies protect student, admin, billing, content, import, and analytics data.
- Confirm indexes from performance migrations are present.
- Confirm profile creation trigger works for new auth users.
- Confirm storage buckets used for imports are private.
- Confirm backups and point-in-time recovery settings match the production plan.

## Stripe

Use test mode until the full smoke test passes.

Test-mode setup:

- Create test products and prices for every exam track.
- Set Vercel Stripe env vars to test-mode keys and test price IDs.
- Create a test webhook endpoint at `https://your-domain.com/api/stripe/webhook`.
- Enable required events listed in `docs/STRIPE_SETUP.md`.

Before live payments:

- Create live products and prices.
- Create a live webhook endpoint.
- Replace test keys and price IDs with live values in Vercel.
- Complete Stripe account requirements.
- Run a low-value live transaction and refund test when appropriate.

## OpenAI

- Store `OPENAI_API_KEY` only in Vercel server environment variables.
- Confirm generation, review, improvement, import cleanup, translation, and coaching models resolve through admin settings, environment variables, or safe defaults.
- Confirm admin-only routes protect AI usage.
- Confirm missing API keys return controlled errors.
- Confirm daily quantity limits and large-batch confirmations are enabled.

## Domain

- Add the custom domain in Vercel.
- Configure DNS records as Vercel instructs.
- Confirm HTTPS is active.
- Confirm canonical app URL, sitemap, robots file, and metadata render using the production domain.
- Confirm social preview metadata after the domain is live.

## Deploy

1. Commit and push the release branch.
2. Verify Vercel build succeeds.
3. Apply pending Supabase migrations before smoke testing.
4. Configure Stripe webhook endpoint to the deployed domain.
5. Run `docs/PRODUCTION_SMOKE_TEST.md`.
6. Keep test-mode Stripe enabled until all workflows pass.
