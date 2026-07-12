# Architecture

PrepCzar is a Next.js App Router application with Supabase-backed authentication, content data, subscriptions, and AI review workflows.

## Project Structure

- `app` — route segments, pages, layouts, and API route handlers.
- `components` — shared UI and feature components.
- `hooks` — client-side React hooks.
- `lib` — application services and integration helpers.
- `lib/supabase` — compatibility exports for Supabase browser and admin clients.
- `lib/auth` — compatibility exports for client and server auth helpers.
- `lib/access` — compatibility exports for subscription access helpers.
- `lib/stripe` — compatibility exports for Stripe helpers and webhook sync.
- `lib/openai` — OpenAI client and generation entry points.
- `lib/content-generation` — exam-track rules and generation support.
- `lib/content-integrity` — AI integrity review and improvement logic.
- `lib/content-import` — reserved location for import pipelines.
- `scripts` — operational scripts.
- `supabase/migrations` — database migrations and seed/backfill SQL.
- `docs` — setup, deployment, integration, and pipeline documentation.

## Routing

The app uses the Next.js App Router. Public pages live directly under `app`, authenticated student pages live under `app/dashboard`, admin pages live under `app/admin`, and server endpoints live under `app/api`.

## Authentication

Client layouts use Supabase session state to redirect unauthenticated users. Server API routes validate bearer tokens with Supabase Auth through `getAuthenticatedUser`. Admin API routes use `requireAdmin`, which checks the `users.role` field through the service-role client.

## Access Control

Student content APIs verify active `user_exam_access` rows before returning practice content. Published MCQs must be reviewed, active, and integrity-approved unless an admin override is present.

## Stripe

Stripe checkout, portal, and webhook handlers are server-side API routes. Webhooks synchronize subscription status into `subscriptions` and `user_exam_access`. Checkout currently uses active exam track database prices instead of hosted Stripe price IDs.

## OpenAI

OpenAI calls are server-side only. The AI question pipeline uses stored blueprint metadata, model env vars, generation prompts, integrity scoring, and auto-improvement before content is saved or published.

## Known Stabilization Notes

- There is no root `middleware.ts`; route protection currently relies on client layouts and API route guards.
- `next.config.js` ignores lint during production builds, so `npm run lint` must be run explicitly.
- The codebase still has legacy flat service files such as `lib/supabase.ts` and compatibility folders such as `lib/supabase`. Existing imports are preserved.
- `NEXT_PUBLIC_SITE_URL` remains supported as a legacy alias; new configuration should prefer `NEXT_PUBLIC_APP_URL`.
