# Question Integrity Review Pipeline

PrepCzar uses a pre-review integrity pipeline for AI-generated MCQ questions:

`Generate → Validate → Score → Flag → Human Review → Publish`

This pipeline is an automated quality-control layer. It does not replace professional psychometric validation, licensed subject-matter expert review, legal review, or formal high-stakes exam validation.

## Generation Flow

1. An admin generates MCQs for a selected exam track, topic, subtopic, and learning objective.
2. Generated questions are inserted with `reviewed=false` and `active=false`.
3. The integrity checker runs automatically after insert.
4. The checker writes integrity scores, status, flags, notes, and duplicate hash data back to the question record.
5. Admins review, edit, reject, rerun the integrity check, approve, or publish.
6. Students only receive questions that are reviewed, active, and integrity-passed unless an admin override is recorded.

## Database Fields

The `questions` table stores:

- `integrity_status`: `pending`, `passed`, `needs_review`, or `failed`
- `integrity_score`: overall 0–100 score
- `quality_flags`: item-writing quality issues
- `bias_flags`: fairness and bias issues
- `distractor_flags`: answer-option quality issues
- `blueprint_alignment_score`: 0–100 exam/topic alignment score
- `cognitive_level_detected`: detected cognitive demand
- `predicted_difficulty`: `easy`, `medium`, or `hard`
- `plagiarism_risk_score`: 0–100 originality risk estimate
- `integrity_review_notes`: generated review notes for admins
- `integrity_checked_at`: timestamp of the latest check
- `integrity_override`: admin override for publishing non-passed questions
- `integrity_override_reason`, `integrity_override_by`, `integrity_override_at`: override audit trail

## Scoring System

The integrity score is calculated from:

- Item-writing quality: 25 points
- Distractor quality: 20 points
- Blueprint alignment: 20 points
- Cognitive level match: 10 points
- Difficulty match: 10 points
- Bias and fairness: 10 points
- Originality and security: 5 points

Status rules:

- `passed`: score is 85 or higher
- `needs_review`: score is 70–84
- `failed`: score is below 70
- `failed`: plagiarism risk is greater than 70
- `failed`: blueprint alignment is below 70
- `needs_review`: bias flags exist, even if score otherwise passes

## Checks Performed

### Item-Writing Quality

The checker flags vague wording, excessive complexity, double negatives, absolute terms, unclear stems, missing rationales, missing learning objectives, and missing clinical or professional context where expected.

### Distractor Review

The checker flags duplicate answer choices, overly obvious distractors, distractors too similar to the correct answer, answer-length clues, and answer-position pattern risk.

### Blueprint Alignment

The checker compares the question text, options, rationales, subtopic, learning objective, source topic, selected topic, and exam track metadata. Low alignment is treated as a publishing blocker.

### Cognitive Level

The checker classifies each item as:

- `recall`
- `comprehension`
- `application`
- `analysis`
- `clinical judgment`
- `ethics`
- `safety`
- `prioritization`

It flags items that appear too low-level for a professional exam track or that do not match the intended cognitive level.

### Difficulty Prediction

The checker predicts `easy`, `medium`, or `hard` based on cognitive level, stem complexity, and rationale/detail level. Mismatches against intended difficulty reduce the integrity score.

### Bias and Fairness

The checker flags culturally specific idioms, stigmatizing terms, unnecessary demographic references, stereotypes, and language that may disadvantage candidates based on gender, race, religion, nationality, disability, age, region, or socioeconomic status.

### Security and Originality

The checker creates a duplicate hash from normalized question text and compares it against existing questions in the same exam track. It also estimates similarity risk to flag possible duplication or plagiarism risk.

The checker cannot prove that a question is original or that it does not overlap with official exam-bank content. It only reduces risk and routes suspicious items to human review.

## Admin Review

Admins can:

- Approve a question after review
- Reject a question and keep it inactive
- Edit item content and metadata
- Rerun the integrity check
- Publish only when allowed by integrity rules
- Record an override reason when publishing a non-passed question

Human SME review is still required before publishing high-stakes exam content.

## Publishing Rules

A question can be published only if:

- `reviewed=true`
- `active=true`
- `integrity_status='passed'`

Or:

- `reviewed=true`
- `active=true`
- `integrity_override=true`
- an override reason and audit metadata are recorded

## Student Access Rule

Student MCQ queries only return questions where:

- `reviewed=true`
- `active=true`
- `integrity_status='passed'`

Or:

- `reviewed=true`
- `active=true`
- `integrity_override=true`

This keeps generated, unchecked, failed, or review-only questions out of student practice sessions.
