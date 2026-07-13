# Operations Runbook

## Daily Checks

- Review Vercel deployment and runtime logs.
- Review Supabase API/database/auth logs.
- Review Stripe webhook delivery failures.
- Review AI usage logs and budget warnings.
- Confirm no unusual generation/import volume.

## Incident Response

1. Classify severity: security, payment, outage, data integrity, or content quality.
2. Preserve logs and timestamps.
3. Disable affected workflow if needed, such as generation, import, or publishing.
4. Communicate user-facing impact through support channels.
5. Apply fix, validate in staging/test mode, then deploy.
6. Document root cause and prevention.

## Rollback Procedure

1. In Vercel, redeploy the last known-good deployment.
2. If the issue is configuration-only, revert the affected environment variable and redeploy.
3. If the issue is database-related, do not blindly reverse migrations. Create a forward migration that safely restores behavior.
4. If Stripe access is affected, pause checkout links if needed and reconcile subscription/access rows from Stripe as source of truth.
5. If AI-generated content quality is affected, disable publishing and mark affected content inactive pending review.

## Supabase Recovery

- Use Supabase backups or point-in-time recovery according to the production plan.
- Export critical content and subscription access data before risky maintenance.
- Test restoration procedures outside production before relying on them in an incident.

## Stripe Operations

- Treat Stripe as the billing source of truth.
- Reconcile `subscriptions` and exam access after webhook outages.
- Replay webhook events from Stripe when processing fails.
- Never grant access from client redirects alone.

## OpenAI Operations

- Rotate `OPENAI_API_KEY` if exposure is suspected.
- Disable optional AI tasks if budget thresholds are exceeded.
- Prefer cheaper generation models and stronger review/improvement models.
- Keep all student retrieval paths backed by stored content, not live AI generation.

## Release Procedure

1. Run local validation.
2. Apply Supabase migrations.
3. Commit and push.
4. Verify Vercel deployment.
5. Run smoke test.
6. Monitor logs for at least one full test checkout and one student practice session.
