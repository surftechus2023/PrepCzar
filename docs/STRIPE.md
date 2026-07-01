# Stripe

Authenticated checkout uses `/api/stripe/checkout` and accepts only `examTrackId`.
Paid signup checkout uses `/api/stripe/signup-checkout` after Supabase creates the user.

Security requirements:

- The API derives the user from the Supabase bearer token.
- The API derives price and track name from Supabase.
- The client never sends trusted payment or subscription status.
- The webhook verifies `STRIPE_WEBHOOK_SECRET`.
- Signup checkout validates the Supabase user id and email server-side before creating a Stripe session.
- After `checkout.session.completed`, the webhook grants access and sends a Supabase magic sign-in link to the checkout email.

Webhook events to enable:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

Billing portal:

- `/api/stripe/portal` derives the Stripe customer from the authenticated user.
- Test payment method updates and cancellation before launch.
