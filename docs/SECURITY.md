# Security Hardening

## Authorization

Server APIs must enforce authorization. Do not rely on client-side route hiding or role checks.

Protected areas:

- admin routes
- content generation
- content import
- AI model settings
- review pages
- subscription management
- student sessions
- responses and scores

Central helpers:

- `lib/server-auth.ts`
- `lib/security/authorization.ts`
- `lib/access/server.ts`

## Service Role

`SUPABASE_SERVICE_ROLE_KEY` must only be used on the server. Never expose it in browser code, client components, or `NEXT_PUBLIC_*` variables.

## RLS

Students may only access their own:

- profile
- subscriptions
- exam access
- practice sessions
- responses
- scores
- bookmarks

Students may read published content only for subscribed exam tracks. Admins require role checks.

## Input Validation

Use Zod for request bodies and query parameters. Current protected examples include generation, import, AI settings, Stripe checkout, and review endpoints.

## Rate Limiting

Rate-limited areas:

- content generation
- integrity review
- auto-improvement
- content import preview/cleanup
- Stripe checkout and signup checkout

The current implementation is in-memory and suitable as an application-level guard. For multi-instance production, replace or back it with Redis/Upstash/Vercel KV.

## Logging

Use structured server logs. Do not log:

- passwords
- bearer tokens
- secret keys
- full payment details
- sensitive health information
- full uploaded copyrighted documents

## Monitoring Hooks

Prepared integration points:

- structured server logs
- `security_audit_logs`
- Stripe processed event logs
- AI usage logs
- migration history

## Production Security Checklist

- Verify all admin APIs call `requireAdmin` or centralized equivalents.
- Verify all student APIs use authenticated users and ownership checks.
- Verify RLS is enabled for user-owned tables.
- Verify Stripe webhook signatures with raw body.
- Verify duplicate Stripe events are ignored.
- Verify service-role key is server-only.
- Verify file upload extension, MIME type, and size checks.
- Verify no free-trial UI grants access.
- Verify all AI usage is admin-controlled or explicitly limited.
- Verify legal and disclaimer pages are linked before launch.
