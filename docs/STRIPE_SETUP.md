# Stripe Setup

Use Stripe test mode until every billing workflow passes.

## Required Prices

Create one recurring monthly Stripe Price for each exam track:

- EPPP: `$75/month` -> `STRIPE_PRICE_EPPP`
- BSW: `$50/month` -> `STRIPE_PRICE_BSW`
- LMSW/MSW: `$50/month` -> `STRIPE_PRICE_LMSW`
- LCSW: `$50/month` -> `STRIPE_PRICE_LCSW`
- NCE: `$75/month` -> `STRIPE_PRICE_NCE`
- CCM: `$50/month` -> `STRIPE_PRICE_CCM`
- NCLEX-RN: `$85/month` -> `STRIPE_PRICE_NCLEX_RN`
- NCLEX-PN: `$85/month` -> `STRIPE_PRICE_NCLEX_PN`

Do not send arbitrary price IDs from the browser. Checkout routes resolve approved Price IDs server-side from the selected exam track slug.

## Required Environment Variables

- `NEXT_PUBLIC_APP_URL`
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

Never expose `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` in browser code.

## Webhooks

Configure the Stripe webhook endpoint:

`POST /api/stripe/webhook`

Handled events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

Webhook events are verified with the raw request body and `STRIPE_WEBHOOK_SECRET`. Processed event IDs are stored in `stripe_processed_events` to prevent duplicate processing.

## Test-Mode Checklist

1. Successful card: use `4242 4242 4242 4242`, complete checkout, confirm webhook grants only the selected exam track.
2. Declined card: use `4000 0000 0000 0002`, confirm checkout fails and no access is granted.
3. Canceled checkout: start checkout, cancel, confirm no subscription or access row is activated.
4. Existing-user checkout: sign in, subscribe to one exam, confirm customer/subscription is created and access is exam-specific.
5. New-user checkout: create account from signup, complete checkout, confirm webhook grants access and post-payment sign-in works.
6. Webhook replay: replay the same Stripe event and confirm `stripe_processed_events` prevents duplicate processing.
7. Cancellation: cancel in Billing Portal, confirm `customer.subscription.updated` or `deleted` updates `subscriptions` and revokes access when Stripe status requires it.
8. Payment failure: simulate failed recurring payment, confirm `invoice.payment_failed` updates subscription status and revokes access.
9. Payment recovery/reactivation: pay/update subscription to `active`, confirm webhook restores access.
10. Billing portal: open portal from dashboard, update payment method, cancel, and return to PrepCzar.
