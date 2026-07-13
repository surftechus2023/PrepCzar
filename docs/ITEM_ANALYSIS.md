# Item Analysis

Item analytics are operational learning-platform statistics. They are not validated psychometrics unless the data volume, sampling, and validation process support that claim.

## Tracked Metrics

When response data exists, PrepCzar can derive:

- number of attempts
- percentage correct
- average response time
- distractor selection frequency
- preliminary item difficulty estimate
- preliminary item discrimination estimate foundation

When the sample size is too small, the UI displays:

`Insufficient response data for reliable item statistics.`

## Reliability Threshold

The current reporting layer treats fewer than 30 attempts as insufficient for reliable item-level interpretation. This threshold is a conservative product display rule, not a psychometric validation standard.

## Fairness and DIF Foundation

The migration `20260713000100_analytics_item_reporting.sql` creates foundation tables for item-analysis snapshots and fairness-analysis audits.

Rules:

- Do not infer sensitive demographic characteristics.
- Analyze demographic fields only when lawfully collected, voluntarily provided, sufficiently aggregated, and privacy protected.
- Do not claim AI-only bias review equals formal psychometric fairness validation.
- Treat DIF analysis as a future controlled workflow requiring governance and review.

## Admin Testing

1. Seed at least 30 responses for one question to see preliminary item statistics.
2. Seed fewer than 30 responses for another question and confirm the insufficient-data warning.
3. Confirm distractor counts match response selections.
4. Export `item_performance` CSV from `/admin/analytics`.
