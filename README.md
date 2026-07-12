# PrepCzar

PrepCzar is a production-oriented exam-preparation SaaS application built with Next.js, TypeScript, Tailwind CSS, Supabase, Stripe, and OpenAI. It supports admin-authored and AI-assisted exam prep content for multiple professional tracks, including English, Spanish, and French content fields.

## Core Stack

- Next.js App Router with TypeScript and Tailwind CSS
- Supabase PostgreSQL, Authentication, and service-role API routes
- Stripe subscription checkout, portal, and webhook synchronization
- OpenAI-powered content generation, integrity review, and improvement workflows
- Vercel deployment target

## Local Development

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`.
3. Fill in Supabase, Stripe, OpenAI, and model environment variables.
4. Run `npm run dev`.
5. Open `http://localhost:3000`.

## Validation

- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Documentation

- `docs/SETUP.md` — local setup and validation steps
- `docs/ENVIRONMENT_VARIABLES.md` — required public and server-side environment variables
- `docs/ARCHITECTURE.md` — project structure and integration boundaries
- `docs/SUPABASE.md` — database and migration notes
- `docs/STRIPE.md` — subscription integration notes
- `docs/OPENAI.md` — OpenAI integration notes
- `docs/QUESTION_GENERATION_AND_INTEGRITY.md` — AI question pipeline

Do not expose `.env` values in client code or commit real secrets.
