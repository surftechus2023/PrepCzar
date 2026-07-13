# Auto-Improvement

Auto-improvement rewrites weak MCQs before human review. It is not cosmetic paraphrasing; it must substantially improve the item while preserving the selected blueprint mapping.

## Inputs

The improver receives:

- Original question and answer options
- Correct rationale, distractor rationales, and test-taking tip
- Exact stored blueprint context used for generation/review
- Failed scores and reviewer explanations
- Quality, distractor, and bias flags
- Intended difficulty and intended cognitive level
- Exam-track rules and Social Work/ASWB guidance when applicable

## Rewrite Requirements

The improver must preserve:

- Exam track
- Domain / major content area
- Competency
- Applied knowledge statement
- Topic and learning objective

It may rewrite the stem, options, rationales, and tip to:

- Turn weak recall into application
- Turn generic application into reasoning
- Add a clinical or professional scenario
- Correct decision sequence
- Improve distractor plausibility
- Deepen rationales
- Remove answer clues
- Strengthen blueprint linkage

For LCSW/Clinical, weak or generic items should become case vignettes testing assessment priority, risk assessment, ethical decision-making, best next step, treatment planning, intervention choice, or differential diagnosis when that matches the selected blueprint statement.

## Attempts

Auto-improvement is limited to two attempts. After the second failed recheck, the item is marked `needs_human_review`, remains inactive, and manual edit remains available.

## Models

Models are configured through environment variables and validated against `OPENAI_ALLOWED_MODELS`.

- `CONTENT_GENERATION_MODEL`
- `CONTENT_INTEGRITY_MODEL`
- `CONTENT_IMPROVEMENT_MODEL`
- `CONTENT_REWRITE_MODEL`
- `CONTENT_FINAL_REVIEW_MODEL`
- `CONTENT_COMMITTEE_MODEL`

If a configured model is not allowlisted, the application falls back to a safe configured default instead of hardcoding a nonexistent model.

## Test Cases

Use these cases in admin review:

- Passing item: a medium or hard scenario aligned directly to the selected applied knowledge statement.
- Easy failing item: a recall stem such as “Which disorder is characterized by…” should fail and be rewritten.
- Off-blueprint item: a question testing a different competency should fail blueprint alignment.
- Auto-improvement item: a generic but related item should be rewritten into a stronger scenario and then rechecked.
