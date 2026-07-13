# Accessibility

PrepCzar should follow WCAG-aligned good practices for keyboard, screen-reader, motion, contrast, and touch accessibility.

## Baseline Standards

- Use semantic headings in logical order.
- Provide visible focus states for links, buttons, inputs, and custom controls.
- Use labels or accessible names for all form controls.
- Use ARIA only when native HTML cannot express the interaction.
- Preserve sufficient contrast in light and dark themes.
- Support reduced motion through `prefers-reduced-motion`.
- Use `role="status"` for loading states and `role="alert"` for blocking errors.

## Interaction Requirements

- All admin and student workflows must be keyboard reachable.
- Dialogs must keep content scrollable on mobile.
- Touch targets should be approximately 40 px or larger.
- MCQ options, flashcard controls, and voice-mode controls must be reachable without hover.
- Do not position voice mode as safe for active driving.

## Content Accessibility

- Avoid using color alone to indicate correctness, status, or errors.
- Pair icons with text or accessible titles when the meaning is not obvious.
- Keep question and rationale text readable at mobile widths.
- Keep professional terms intact; do not oversimplify required exam vocabulary.

## QA Checklist

- Tab through public pages, dashboard, practice, admin review, import, and settings.
- Confirm focus order matches visual order.
- Confirm dialogs can be opened, read, and closed by keyboard.
- Confirm loading and error states are announced by screen readers.
- Test reduced-motion mode and verify animations do not distract or block use.
- Test zoom at 200% without horizontal scrolling on core pages.
