# Production Smoke Test

Run this against the deployed Vercel URL using Stripe test mode first.

## Public Site

- Landing page loads.
- Exam selection cards show correct exams and pricing.
- `/sitemap.xml` uses the production domain.
- `/robots.txt` uses the production domain and blocks private areas.
- Privacy, terms, refund, contact, accessibility, and disclaimer pages load.

## Authentication

- New user signup works.
- Email confirmation redirect works.
- Login works.
- Password reset redirect works.
- Logout works.

## Stripe Subscription

- Start checkout for one exam track.
- Complete Stripe test checkout with a successful test card.
- Confirm webhook `checkout.session.completed` is received.
- Confirm subscription row is created or updated.
- Confirm user exam access is created only for the purchased exam.
- Confirm billing portal opens.
- Cancel subscription from Stripe or portal.
- Confirm cancellation webhook updates access.
- Test declined card and confirm access is not granted.

## Student Access

- Login as subscribed student.
- Dashboard shows only subscribed exam access.
- Attempt direct URL/API access for another exam and confirm rejection.
- Start an MCQ session.
- Resume an incomplete MCQ session.
- Complete an MCQ session and view rationale/weak areas.
- Start flashcards and mark known/learning.
- Start case-vignette practice.
- Test voice controls or confirm graceful fallback when speech APIs are unavailable.
- Confirm no OpenAI requests occur during ordinary MCQ or flashcard retrieval.

## Admin

- Login as admin.
- Non-admin user cannot access admin routes.
- Open content generation page.
- Generate a small unpublished test batch.
- Run integrity review on a test item.
- Run auto-improve and recheck on a failing item.
- Import one small TXT file.
- Confirm imported items enter review unpublished.
- Confirm publish gating requires passed integrity or valid override.
- Open AI settings and verify model resolution.
- Open analytics and export a CSV report.

## Mobile

Test at 320 px, 375 px, 390 px, tablet, and desktop:

- Landing page has no horizontal scroll.
- Dashboard cards stack correctly.
- MCQ options are touch-friendly.
- Flashcards fit and controls are reachable.
- Case vignette text areas remain usable with mobile keyboard.
- Admin question dialogs scroll and option cards stack.
- Import and generation forms are usable.

## Pass Criteria

- No critical user flow fails.
- No unauthorized data or exam access is observed.
- Stripe access changes match webhook-confirmed status.
- Admin-generated/imported content remains inactive until approved.
- Critical errors are visible in logs and return controlled UI/API messages.
