# Go-Live Checklist

Do not mark PrepCzar production-ready until every critical item passes.

## Readiness Result Template

- Result: `Ready`, `Ready with non-critical follow-ups`, or `Blocked`.
- Commit deployed:
- Vercel deployment URL:
- Production domain:
- Supabase project:
- Stripe mode: `test` or `live`
- Smoke-test date:
- Tester:

## Code and Build

- `npm run lint` passes.
- `npm run typecheck` passes.
- `npm run build` passes.
- Git repository is clean.
- No private secrets are committed.
- Production metadata does not emit localhost URLs.
- Production error and loading boundaries exist for public, admin, and dashboard routes.

## Environment Variables

- Supabase URL and anon key are configured.
- Supabase service role key is configured server-side only.
- Stripe publishable key, secret key, webhook secret, and price IDs are configured.
- OpenAI API key is configured server-side only.
- AI model variables are configured or intentionally resolved by admin settings.
- `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_SITE_URL` match the production HTTPS domain.

## Supabase

- Migrations are applied.
- RLS policies are enabled and verified.
- Required indexes exist.
- Auth site URL and redirect URLs are correct.
- New-user profile trigger works.
- Private storage policies are configured for imports.
- Backup and restoration approach is documented.

## Stripe

- Test checkout succeeds.
- Webhook receives and verifies events.
- Access is granted only after webhook-confirmed subscription state.
- Payment failure and cancellation remove or restrict access.
- Billing portal works.
- Live keys are not enabled until test-mode workflows pass.

## OpenAI

- API key is server-side only.
- Admin generation is protected.
- Normal student MCQ and flashcard practice does not call AI.
- Usage logs capture model and token data where available.
- Cost controls and large-batch confirmations are active.

## Legal and Trust

- Privacy Policy exists.
- Terms of Service exists.
- Refund Policy exists.
- Contact/Support page exists.
- Accessibility statement exists.
- Exam-prep disclaimer exists.
- AI content disclaimer exists.
- No page claims affiliation with official exam organizations unless authorization exists.

## Monitoring

- Vercel deployment logs are monitored.
- Runtime error monitoring is configured or scheduled as a launch follow-up.
- Uptime checks are configured for the production domain.
- Stripe webhook delivery alerts are monitored.
- Supabase logs are monitored.
- AI usage and budget alerts are monitored.

## Blockers

Treat these as release blockers:

- Build failure.
- Missing production environment variable for Supabase, Stripe, or OpenAI.
- Stripe webhook not verifying signatures.
- Subscription access granted without webhook-confirmed status.
- RLS permits cross-user student data access.
- Students can access unsubscribed exam tracks.
- Admin routes are reachable by non-admin users.
- Critical legal pages missing.
