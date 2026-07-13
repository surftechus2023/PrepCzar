# Responsive QA

Test core flows at 320 px, 375 px, 390 px, tablet, and desktop widths.

## Global

- No horizontal scrolling.
- Navigation remains reachable.
- Form controls keep readable labels.
- Buttons have touch-friendly spacing.
- Toasts and dialogs do not cover required actions.
- Safe-area spacing works on mobile browsers.

## Public Pages

- Home page hero text wraps cleanly.
- Pricing cards stack without clipped prices or CTAs.
- Privacy, terms, refund, accessibility, contact, and disclaimer pages remain readable.

## Student Dashboard

- Subscription status, progress, recent sessions, and weak areas stack cleanly.
- Weak areas show readable topic/domain names rather than raw IDs.
- Continue-session and recommended-practice actions remain visible.

## MCQ Practice

- Question stem and options fit at 320 px.
- Answer options are touch-friendly.
- Progress controls do not cover content.
- Review/rationale content wraps without clipping.
- Bookmark and voice controls remain usable.

## Flashcards

- Cards fit on 320 px screens.
- Front/back text scrolls or wraps without overflow.
- Known/learning buttons are reachable by touch and keyboard.
- Swipe gestures have accessible button fallbacks.

## Case Vignettes

- Scenario, prompt, rubric, ideal response, and feedback stack cleanly.
- Text entry areas remain usable on mobile keyboards.
- Optional AI feedback controls show limits and status clearly.

## Admin Dashboard

- Summary cards stack cleanly.
- Tables use horizontal scroll only inside their table container.
- Filters wrap and remain labeled.
- Bulk-action controls are reachable on touch devices.

## Admin Questions

- Question cards stack actions below text on mobile.
- Icon buttons are at least 40 px.
- The preview dialog scrolls vertically and option cards stack before `sm`.
- Load-more pagination works without jumping the page.

## Content Generation and Import

- Blueprint selectors, quantity, difficulty, cognitive level, and language controls stack.
- Upload and pasted-text inputs remain readable.
- Preview lists support edit/discard controls on mobile.
- Generation/import status messages wrap and remain visible.

## AI Settings and Billing

- Model setting rows stack or scroll within containers.
- Stripe checkout and billing actions remain reachable.
- Error and success messages are visible without relying on color alone.
