# Subscription Access

PrepCzar access is exam-track specific. A subscription to one track never unlocks another track.

## Access Source of Truth

Access is granted by Stripe webhook processing, not by client redirects.

Checkout success redirects can confirm payment status, but they do not directly create active access. The webhook sync writes:

- `subscriptions`
- `user_exam_access`
- `stripe_processed_events`

## Status Rules

Access allowed:

- `active`
- `trialing` only if Stripe reports it; PrepCzar does not intentionally offer free trials

Access blocked:

- `past_due`
- `unpaid`
- `canceled`
- `incomplete`
- `incomplete_expired`
- `inactive`

## Security Rules

- Do not trust client-supplied price IDs.
- Do not grant access from query parameters, redirect URLs, or client-side confirmation alone.
- Verify all Stripe webhook signatures.
- Store and check processed Stripe event IDs.
- Keep Stripe secrets server-side only.

## Reactivation

If a subscription moves back to `active` or `trialing` through Stripe, `customer.subscription.updated` or `invoice.payment_succeeded` sync restores `user_exam_access.active`.

## Production QA

Before live mode:

- Confirm all Stripe Price IDs match the required monthly amounts.
- Confirm every checkout route uses server-side price resolution.
- Confirm canceled, failed, unpaid, and incomplete subscriptions cannot access practice content.
- Confirm active access appears only for the subscribed exam track.
