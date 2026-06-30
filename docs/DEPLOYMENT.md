# Deployment

Recommended target: Vercel.

1. Import the repository in Vercel.
2. Set production environment variables from `.env.example`.
3. Set `NEXT_PUBLIC_SITE_URL` to the production origin.
4. Configure Stripe webhook URL: `https://your-domain.com/api/stripe/webhook`.
5. Push Supabase migrations.
6. Run a production build.

Production checklist:

- `npm run build` passes.
- `/sitemap.xml` and `/robots.txt` render.
- Stripe checkout succeeds for each active exam track.
- Stripe cancellation removes `user_exam_access.active`.
- Admin generation saves draft content only.
- Mobile pages have no horizontal scrolling.
