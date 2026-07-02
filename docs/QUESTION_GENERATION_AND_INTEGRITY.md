# Question Generation and Integrity Workflow

PrepCzar uses this generated-question workflow:

`Official handbook/blueprint -> stored topic table -> generator uses it -> checker uses it -> reviewer sees it`

This workflow is an automated pre-review quality-control layer. It does not replace professional psychometric validation or human subject-matter expert review.

## Strict Generation Rules

The AI question generator creates original, exam-track-specific MCQs aligned to:

- selected `exam_track_id`
- selected `topic_id`
- selected `subtopic_id` when available
- selected subtopic
- selected learning objective
- selected difficulty expectations
- selected cognitive-level expectations
- stored official blueprint text from `topics`, `subtopics`, and `questions.blueprint_reference_text`

The generator receives stored Supabase metadata: official source URL, exam description, topic description, topic official blueprint text, subtopic official blueprint text, learning objective, and blueprint reference text.

Generated items must not mix exam levels, such as BSW, MSW/LMSW, and LCSW, or NCLEX-RN and NCLEX-PN. Generic healthcare, social work, psychology, nursing, or counseling items are treated as weak items.

## Blueprint Alignment Threshold

Each question receives a `blueprint_alignment_score`.

- Target: `90+`
- Below `90`: `integrity_status='needs_improvement'`
- Missing blueprint metadata: `integrity_status='needs_metadata'`
- Student visibility requires `blueprint_alignment_score >= 90`

The checker judges alignment only against stored blueprint metadata. It does not rely only on model memory or general knowledge of the exam.

If `topic.official_blueprint_text`, `subtopic.official_blueprint_text`, and `question.blueprint_reference_text` are all missing, the checker does not force a low alignment score. It sets `integrity_status='needs_metadata'` and adds: “Blueprint metadata was missing, so alignment could not be reliably scored.”

Admins can update topic/subtopic blueprint text and rerun the integrity check.

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
- Missing metadata: `needs_metadata`
- High plagiarism risk: `failed`
- Bias/fairness flags route the item to review even if the numeric score is high

The score considers item-writing quality, distractor quality, stored-blueprint alignment, cognitive match, difficulty match, fairness, and originality risk.

## Auto-Improvement Flow

During generation:

1. AI generates a candidate question using stored blueprint metadata.
2. The system runs pre-save integrity validation.
3. If blueprint metadata exists and `blueprint_alignment_score < 90`, the AI is asked to improve alignment against the stored blueprint text.
4. If `difficulty_quality_score < 80`, the AI is asked to improve professional difficulty.
5. If `integrity_score < 85`, the AI is asked to improve the item once.
6. The improved candidate is saved with `reviewed=false` and `active=false`.

During admin review:

1. Admin clicks `Auto-Improve and Recheck`.
2. The current question, flags, and stored blueprint metadata are sent to the AI improver.
3. The rewritten item replaces the stored draft.
4. `improvement_attempts` increments.
5. `auto_improved=true` is recorded.
6. Integrity is rerun automatically.
7. Before/after notes are stored in `improvement_notes`.

Auto-improvement is limited to 2 attempts per question. If the item still misses threshold after 2 attempts, it is marked `needs_human_review`.

## Rerun Integrity vs Auto-Improve

`Rerun Integrity Check` only rescans and rescores the current stored question. It does not rewrite content.

`Auto-Improve and Recheck` rewrites the question using AI, saves the improved draft, increments improvement metadata, and then reruns integrity scoring.

## Blueprint Metadata Storage

Blueprint metadata is stored in:

- `exam_tracks.official_source_url`
- `exam_tracks.official_exam_description`
- `topics.official_blueprint_text`
- `topics.official_weight_percent`
- `subtopics.official_blueprint_text`
- `subtopics.learning_objective`
- `questions.subtopic_id`
- `questions.blueprint_reference_text`

The AI Question Review page includes “Blueprint context used for integrity check” so reviewers can see exactly what metadata was used when scoring alignment.

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

Generated, unchecked, weakly aligned, low-difficulty, missing-metadata, or non-reviewed questions are kept out of student practice.
