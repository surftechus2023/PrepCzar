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

## Exam-Track-Specific Rules

Generation uses `lib/content-generation/exam-track-rules.ts` to keep each track at the right reasoning level:

- BSW: foundational concepts, basic ethics, basic human development; recall can be used but should not dominate.
- MSW/LMSW: practice application, assessment, intervention planning, ethics, supervision, and community practice.
- LCSW: usually case-based; emphasizes differential diagnosis, assessment priority, intervention choice, ethics, risk, treatment planning, and clinical reasoning.
- NCLEX-RN: clinical judgment, safety, prioritization, delegation, pharmacology, nursing process, acute care, and Next Gen reasoning.
- NCLEX-PN: PN scope, safety, basic care, pharmacology basics, patient education, prioritization within PN scope, and reporting/escalation.
- EPPP: applied psychology, ethics, diagnosis, assessment, intervention, research methods, biological bases, social/multicultural, and lifespan development.
- NCE: counseling process, ethics, human growth, career development, assessment, group counseling, helping relationships, research/program evaluation.
- CCM: case management process, care coordination, utilization management, ethics, reimbursement, psychosocial aspects, rehabilitation, and professional practice.

LCSW questions must generally be case-based because the exam expects clinical reasoning, not simple disorder-definition recall. A weak LCSW item such as "Which disorder is characterized by inattention and hyperactivity-impulsivity?" is automatically targeted for rewrite into a vignette testing assessment priority, differential diagnosis, ethics, safety/risk, intervention planning, or best next step.

NCLEX questions should emphasize clinical judgment because nursing exams test safe prioritization and care decisions, not just memorized facts.

## Blueprint Alignment Threshold

Each question receives a `blueprint_alignment_score`.

- `90-100`: directly tests the selected blueprint objective
- `80-89`: aligned and acceptable
- `70-79`: related but needs review or improvement
- Below `70`: weak or off-topic
- Missing blueprint metadata: `integrity_status='needs_metadata'`
- Student visibility requires `blueprint_alignment_score >= 80`

The checker judges alignment only against stored blueprint metadata. It does not rely only on model memory or general knowledge of the exam.

If all blueprint metadata is missing, the checker sets `integrity_status='needs_metadata'` and asks admins to add topic/subtopic/reference metadata. Legacy questions can fall back to learning objective, topic description, topic title, subtopic, or source topic.

Admins can update topic/subtopic blueprint text or the question's blueprint reference text and rerun the integrity check.

## Difficulty Threshold

Each question receives a `difficulty_quality_score`.

- Target: track-specific minimum, usually `75-80`
- Below target: `integrity_status='needs_improvement'`

Difficulty quality is calibrated by intended vs predicted difficulty:

- Exact match: `90-100`
- One level higher: `75-90`
- One level lower: `60-75`
- Two levels off: below `60`

If intended difficulty is medium and predicted difficulty is hard, the item is not heavily penalized when it demonstrates appropriate clinical judgment or analysis.

## Cognitive Levels

Recall primarily asks for a memorized fact or definition.
Application asks the candidate to use knowledge in a professional situation.
Analysis asks the candidate to compare, prioritize, interpret, or differentiate.
Clinical judgment asks the candidate to decide what matters most in a case, often involving risk, assessment, ethics, or next-step intervention.

Advanced tracks such as LCSW, NCLEX-RN, and CCM should heavily favor application, analysis, prioritization, safety, ethics, and clinical judgment.

## Integrity Scoring

Each question receives an `integrity_score`.

- Target: `85+`
- `80+` with acceptable blueprint and difficulty: can pass if no blocking flags exist
- Below threshold: `needs_review` or `needs_improvement`
- Missing metadata: `needs_metadata`
- High plagiarism risk: `failed`
- Bias/fairness flags route the item to review even if the numeric score is high

The score considers item-writing quality, distractor quality, stored-blueprint alignment, cognitive match, difficulty match, fairness, and originality risk.

## Auto-Improvement Flow

During generation:

1. AI generates a candidate question using stored blueprint metadata and exam-track rules.
2. The system runs pre-save integrity validation.
3. If an advanced-track question is recall-only, the AI rewrites it before saving.
4. If `blueprint_alignment_score < 80`, the AI rewrites it before saving.
5. If `difficulty_quality_score` is below the track threshold, the AI rewrites it before saving.
6. If `integrity_score < 85`, the AI attempts one improvement before saving.
7. The improved candidate is saved with `reviewed=false` and `active=false`.

During admin review:

1. Admin clicks `Auto-Improve and Recheck`.
2. The current question, flags, stored blueprint metadata, and exam-track rules are sent to the AI improver.
3. The rewritten item replaces the stored draft.
4. `improvement_attempts` increments.
5. `auto_improved=true` is recorded.
6. Integrity is rerun automatically.
7. Before/after notes are stored in `improvement_notes`.

Auto-improvement is limited to 2 attempts per question. If the item still misses threshold after 2 attempts, it is marked `needs_human_review`.

When attempts are exhausted, manual edit remains available. Reviewers should revise the stem, answer choices, rationales, learning objective, or blueprint reference text, then click `Rerun Integrity Check`.

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

The AI Question Review page includes "Blueprint context used for integrity check" so reviewers can see exactly what metadata was used when scoring alignment.

## Publishing Rules

Publishing requires:

- `reviewed=true`
- `active=true`
- `integrity_status='passed'`

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
- `blueprint_alignment_score >= 80`
- `integrity_score >= 80`

Or:

- `integrity_override=true`

Generated, unchecked, weakly aligned, low-difficulty, missing-metadata, or non-reviewed questions are kept out of student practice.
