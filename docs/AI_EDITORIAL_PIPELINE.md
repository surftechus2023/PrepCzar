# AI Editorial Pipeline

PrepCzar uses a GPT-only editorial workflow for generated Social Work MCQs:

`stored blueprint metadata -> generator -> editorial review -> auto-rewrite -> final review -> committee review -> publish gate`

## Stored Blueprint Context

Every stage uses `buildBlueprintContext` from stored Supabase metadata. The prompt context includes exam track, official source URL, exam description, ASWB level, major content area, weight, competency, applied knowledge statement, topic/subtopic blueprint text, learning objective, cognitive target, difficulty target, and question-writing guideline.

If required fields are missing, the stage sets or returns `needs_metadata`. Admins must update the topic/subtopic/blueprint item before generating, reviewing, or publishing.

## GPT Reviewers

The staged reviewers are:

- Blueprint SME: verifies exam track, content area, competency, applied knowledge statement, and learning objective alignment.
- Difficulty/Cognitive: rejects easy recall and verifies application, analysis, prioritization, risk, ethics, or best-next-step reasoning.
- Distractor/Rationale: checks plausible distractors, one correct answer, answer cueing, and rationale quality.
- Psychometrician: checks construct validity, discrimination, ambiguity, and candidate reasoning.
- Bias/Fairness: checks cultural, demographic, disability, socioeconomic, and unnecessary-stereotype bias.
- Security/Originality: checks duplicate, copyright, and over-similarity risk.

Passing editorial thresholds are blueprint `>=90`, difficulty `>=85`, distractor/rationale `>=85`, psychometric `>=85`, bias `>=90`, security `>=90`, and composite integrity `>=90`.

## Rewrite Rules

Auto-rewrite receives the original question, failed scores, failure reasons, rewrite recommendations, distractor/bias flags, blueprint context, applied knowledge statement, difficulty target, and cognitive target.

The rewrite must substantially fix the item. For LCSW/Clinical, weak or generic items are rewritten into case vignettes testing differential diagnosis, assessment priority, risk assessment, ethical decision-making, best next step, treatment planning, or clinical intervention choice. Easy recall remains disabled.

After two failed rewrite attempts, the item is marked `needs_human_review` and remains editable.

## Final And Committee Review

Final review is independent and does not rely on prior scores. Committee review runs three GPT roles: Clinical SME, Psychometrician, and Exam Chair. Committee approval requires at least two approve votes, no reject votes, and an average score of `>=85`.

## Publish Gate

Student-visible MCQs require:

- `reviewed=true`
- `active=true`
- `integrity_status='passed'`
- `committee_status='approved'`
- `blueprint_alignment_score >= 90`
- `difficulty_quality_score >= 80`
- `integrity_score >= 85`

Admin overrides require `admin_override=true`, `admin_override_reason`, `admin_override_by`, and `admin_override_at`.

## Model Environment

Defaults:

- `CONTENT_GENERATION_MODEL=gpt-4.1-mini`
- `CONTENT_INTEGRITY_MODEL=gpt-4.1`
- `CONTENT_IMPROVEMENT_MODEL=gpt-4.1`
- `CONTENT_BLUEPRINT_REVIEW_MODEL=gpt-4.1`
- `CONTENT_DIFFICULTY_MODEL=gpt-4.1`
- `CONTENT_DISTRACTOR_MODEL=gpt-4.1`
- `CONTENT_PSYCHOMETRIC_MODEL=gpt-4.1`
- `CONTENT_BIAS_MODEL=gpt-4.1`
- `CONTENT_SECURITY_MODEL=gpt-4.1`
- `CONTENT_REWRITE_MODEL=gpt-4.1`
- `CONTENT_FINAL_REVIEW_MODEL=gpt-4.1`
- `CONTENT_COMMITTEE_MODEL=gpt-4.1`

## Admin Test Flow

1. Generate Social Work questions from a stored applied knowledge statement.
2. Open `/admin/review-questions`.
3. Confirm no blueprint field displays `Not provided`.
4. Run `Run Editorial Review`.
5. If weak, run `Auto Rewrite`.
6. Run `Run Final Review`.
7. Run `Run Committee Review`.
8. Publish only after the checklist passes, or record a specific admin override reason.
