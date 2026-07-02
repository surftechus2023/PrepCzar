# Question Generation and Integrity Workflow

PrepCzar uses a stricter generated-question workflow:

`Strict Generation → Pre-Save Validation → Auto-Fix Weak Items → Human Review → Publish`

This workflow is an automated pre-review quality-control layer. It does not replace professional psychometric validation or human subject-matter expert review.

## Strict Generation Rules

The AI question generator is instructed to create only original, exam-track-specific MCQs aligned to:

- selected `exam_track_id`
- selected `topic_id`
- selected subtopic
- selected learning objective
- selected difficulty expectations
- selected cognitive-level expectations

Generated items must not mix exam levels, such as BSW, MSW/LMSW, and LCSW, or NCLEX-RN and NCLEX-PN. Generic healthcare, social work, psychology, nursing, or counseling items are treated as weak items.

## Blueprint Alignment Threshold

Each question receives a `blueprint_alignment_score`.

- Target: `90+`
- Below `90`: `integrity_status='needs_improvement'`
- Student visibility requires `blueprint_alignment_score >= 90`

Alignment checks compare the question, answer choices, rationales, topic, subtopic, learning objective, source topic, and exam-track metadata.

## Difficulty Threshold

Each question receives a `difficulty_quality_score`.

- Target: `80+`
- Below `80`: `integrity_status='needs_improvement'`
- Student visibility requires `difficulty_quality_score >= 80`

The checker penalizes professional-exam items that are too recall-based, too short, too generic, or mismatched against intended difficulty.

## Integrity Scoring

Each question receives an `integrity_score`.

- Target: `85+`
- `85+` with threshold scores met: `passed`
- Below threshold: `needs_review` or `needs_improvement`
- High plagiarism risk: `failed`
- Bias/fairness flags route the item to review even if the numeric score is high

The score considers item-writing quality, distractor quality, blueprint alignment, cognitive match, difficulty match, fairness, and originality risk.

## Auto-Improvement Flow

During generation:

1. AI generates a candidate question.
2. The system runs pre-save integrity validation.
3. If `blueprint_alignment_score < 90`, the AI is asked to improve alignment.
4. If `difficulty_quality_score < 80`, the AI is asked to improve professional difficulty.
5. If `integrity_score < 85`, the AI is asked to improve the item once.
6. The improved candidate is saved with `reviewed=false` and `active=false`.

During admin review:

1. Admin clicks `Auto-Improve and Recheck`.
2. The current question and flags are sent to the AI improver.
3. The rewritten item replaces the stored draft.
4. `improvement_attempts` increments.
5. `auto_improved=true` is recorded.
6. Integrity is rerun automatically.
7. Before/after notes are stored in `improvement_notes`.

Auto-improvement is limited to 2 attempts per question. If the item still misses threshold after 2 attempts, it is marked `needs_human_review`.

## Rerun Integrity vs Auto-Improve

`Rerun Integrity Check` only rescans and rescores the current stored question. It does not rewrite content.

`Auto-Improve and Recheck` rewrites the question using AI, saves the improved draft, increments improvement metadata, and then reruns integrity scoring.

## Human Review Requirement

Human review remains required before publishing. Admins can:

- approve
- reject
- edit manually
- rerun integrity scoring
- auto-improve and recheck
- publish
- record an override reason when publishing a non-passed item

The automated workflow reduces review waste by improving weak items before review, but it does not certify professional, legal, clinical, or psychometric validity.

## Publishing Rules

Publishing requires:

- `reviewed=true`
- `active=true`
- `integrity_status='passed'`
- `blueprint_alignment_score >= 90`
- `difficulty_quality_score >= 80`

Or:

- `reviewed=true`
- `active=true`
- `integrity_override=true`
- an admin override reason and audit metadata are recorded

## Student Visibility

Students can only see MCQs where:

- `reviewed=true`
- `active=true`
- `integrity_status='passed'`
- `blueprint_alignment_score >= 90`
- `difficulty_quality_score >= 80`

Or:

- `integrity_override=true`

Generated, unchecked, weakly aligned, low-difficulty, or non-reviewed questions are kept out of student practice.
