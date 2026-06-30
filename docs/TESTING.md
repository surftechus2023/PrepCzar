# Testing

Before going live, test:

- New signup with a selected `track` query parameter.
- Email verification redirects to Stripe checkout.
- Successful payment creates `subscriptions` and `user_exam_access`.
- Canceled or past-due subscription removes access.
- Direct URL access to unsubscribed practice pages redirects.
- MCQ sessions save responses, score, and weak topics.
- Flashcard and vignette sessions save session records and scores.
- Admin-only generation rejects non-admin users.
- Generated content remains hidden until reviewed and active.
- Mobile layouts for landing, auth, pricing, dashboard, practice, and admin.
