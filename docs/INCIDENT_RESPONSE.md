# Incident Response

## Severity Levels

- `SEV-1`: active data exposure, payment/security compromise, widespread outage.
- `SEV-2`: partial outage, broken subscription access, failed webhook processing.
- `SEV-3`: limited admin workflow issue, non-sensitive bug, degraded analytics.

## Initial Response

1. Triage scope and severity.
2. Preserve logs and avoid destructive cleanup.
3. Disable affected feature if needed.
4. Rotate exposed credentials if secrets may be compromised.
5. Notify responsible stakeholders.

## Data Exposure

If personal data may be exposed:

1. Identify affected tables, users, and time range.
2. Review Supabase logs, application logs, and audit logs.
3. Remove unauthorized access path.
4. Prepare user/regulatory notifications with counsel where required.

## Stripe Incidents

For billing/webhook failures:

1. Pause risky access changes if needed.
2. Replay Stripe test/live events after the fix.
3. Verify `stripe_processed_events`.
4. Reconcile `subscriptions` and `user_exam_access`.

## AI/Content Incidents

If incorrect or unsafe content is published:

1. Unpublish affected items.
2. Review integrity metadata and source batch.
3. Rerun review or mark for human review.
4. Document root cause.

## Postmortem

For SEV-1/SEV-2, document:

- timeline
- impact
- root cause
- detection gap
- corrective actions
- owner and due dates
