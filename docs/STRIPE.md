# Stripe

Authenticated checkout uses `/api/stripe/checkout` and accepts only `examTrackId`.
Paid signup checkout uses `/api/stripe/signup-checkout` to create or reuse the Supabase auth user server-side before opening Stripe.

Security requirements:

- Authenticated checkout derives the user from the Supabase bearer token.
- The API derives price and track name from Supabase.
- The client never sends trusted payment or subscription status.
- The webhook verifies `STRIPE_WEBHOOK_SECRET`.
- Signup checkout creates or reuses the Supabase user server-side and never trusts client-provided subscription status.
- After `checkout.session.completed`, the webhook grants access and sends a Supabase magic sign-in link to the checkout email.

Webhook events to enable:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

Billing portal:

- `/api/stripe/portal` derives the Stripe customer from the authenticated user.
- Test payment method updates and cancellation before launch.
