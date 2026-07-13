# Analytics

PrepCzar analytics are derived from stored practice sessions, responses, scores, subscriptions, and reviewed content. Normal student analytics do not call AI.

## Student Analytics

The student progress endpoint returns:

- practice history
- score trend
- domain performance
- competency performance
- difficulty performance
- cognitive-level performance
- average response time
- weak areas
- strengths
- completion rate

Student-facing score language must remain diagnostic. Do not claim that PrepCzar scores predict official licensing-exam results with certainty.

## Admin Content Analytics

The admin analytics page shows:

- active and total questions per exam track
- reviewed versus pending counts
- integrity pass rate
- average blueprint alignment score
- average difficulty-quality score
- auto-improvement success rate
- rejected item count
- content coverage compared with stored blueprint weights

## CSV Reports

Admins can export:

- content inventory
- blueprint coverage
- question-quality report
- item-performance report
- subscription/revenue summary where authorized

CSV exports are served from `GET /api/admin/analytics?export=...`.

## Testing With Seeded Data

1. Create or use a student with active exam-track access.
2. Complete at least one MCQ session so `responses`, `practice_sessions`, and `scores` have rows.
3. Confirm `/dashboard/progress` shows domain, competency, difficulty, cognitive-level, timing, strengths, and weak areas.
4. As an admin, open `/admin/analytics`.
5. Confirm content coverage and item analytics render.
6. Click each CSV export and verify a CSV file is returned.
