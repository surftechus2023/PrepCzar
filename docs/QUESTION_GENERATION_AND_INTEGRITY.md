# Question Generation and Integrity Workflow

PrepCzar uses this generated-question workflow:

`stored blueprint metadata -> generator prompt -> editorial review -> auto-rewrite -> final review -> committee review -> publish gate`

This is a pre-review quality-control layer. It does not replace human subject-matter review.

## Metadata Source

Generation and review must use stored metadata, not generic model memory:

- `exam_tracks.official_source_url`
- `exam_tracks.official_exam_description`
- `exam_tracks.aswb_exam_level`
- `topics.official_blueprint_text`
- `topics.official_weight_percent`
- `subtopics.description`
- `subtopics.learning_objective`
- `subtopics.official_blueprint_text`
- `social_work_blueprint_items.*`
- `question_blueprint_guidelines.*`
- question-level copied blueprint context

If Social Work metadata is missing, the checker returns `needs_metadata` and the admin review page shows a missing metadata warning.

## Difficulty Policy

Generated questions are medium or hard only.

- Easy questions are rejected.
- Medium questions must require application to a scenario.
- Hard questions must require reasoning, prioritization, differential diagnosis, risk, ethics, or best-next-step judgment.

Recall-only items such as definition stems are treated as weak. LCSW/Clinical recall stems should be rewritten into case vignettes.

## Social Work Rules

BSW/Bachelors items use foundational Social Work knowledge and clear practice scenarios.

LMSW/MSW/Masters items use graduate-level application and professional judgment.

LCSW/Clinical items should test clinical reasoning in social work scope: assessment, DSM-informed diagnosis, risk assessment, ethical judgment, treatment planning, intervention choice, supervision, consultation, boundaries, confidentiality, mandated reporting, transference, and countertransference.

Do not generate generic psychology questions. Do not require prescribing medication or out-of-scope medical decisions.

## Generator Inputs

The generator receives:

- exam track and ASWB exam level
- official source URL and exam description
- major content area and content weight
- competency section
- applied knowledge statement
- topic and subtopic blueprint text
- question-writing guideline
- cognitive target
- difficulty target

Social Work generation requires a selected stored applied knowledge statement.

## Integrity Scoring

The integrity checker compares the question only against supplied metadata:

- exam track
- ASWB exam level
- major content area
- competency section
- applied knowledge statement
- topic blueprint text
- subtopic blueprint text
- difficulty target
- cognitive target
- ASWB-style question-writing guideline

Blueprint alignment:

- `90-100`: directly tests the selected applied knowledge statement
- `80-89`: aligned and acceptable
- `70-79`: related but generic or weak
- below `70`: off-topic or not tied to the supplied blueprint

Legacy deterministic integrity passing requires:

- `blueprint_alignment_score >= 85`
- `difficulty_quality_score >= 80`
- `integrity_score >= 85`

The GPT editorial publish gate is stricter:

- `blueprint_alignment_score >= 90`
- `difficulty_quality_score >= 80`
- `integrity_score >= 85`
- `committee_status='approved'`

Statuses:

- `passed`: thresholds met and metadata present
- `needs_improvement`: aligned but too easy, too generic, or below threshold
- `needs_metadata`: required blueprint fields are missing
- `needs_human_review`: auto-improve exhausted without meeting thresholds
- `failed`: off-topic, highly duplicative, or otherwise not salvageable automatically

## GPT Editorial Pipeline

`/admin/review-questions` exposes staged GPT actions:

- `Run Editorial Review`: runs Blueprint SME, Difficulty/Cognitive, Distractor/Rationale, Psychometrician, Bias/Fairness, and Security/Originality reviewers against the same stored blueprint context used at generation time.
- `Auto Rewrite`: substantially rewrites failed items using failure reasons, scores, distractor/bias flags, rewrite recommendations, and blueprint context.
- `Run Final Review`: performs an independent GPT review with final blueprint, difficulty, distractor, psychometric, bias, security, and integrity scores.
- `Run Committee Review`: runs GPT Clinical SME, Psychometrician, and Exam Chair roles; publication requires committee approval.

## Auto-Improve And Auto-Rewrite

Auto-improve uses `CONTENT_IMPROVEMENT_MODEL`; the editorial auto-rewrite uses `CONTENT_REWRITE_MODEL`. Both receive:

- original question
- failed scores
- quality flags
- distractor flags
- blueprint context
- exam-track rules
- applied knowledge statement
- difficulty target
- cognitive target

The improver must rewrite substantially. For LCSW/Clinical, weak items become case vignettes testing differential diagnosis, assessment priority, risk assessment, ethical decision-making, best next step, treatment planning, or clinical intervention choice.

The improved question must preserve exam track, major content area, competency, applied knowledge statement, cognitive target, and difficulty target. It must improve distractors, rationales, and the test-taking tip.

Auto-improve is limited to two attempts. After that, the item is marked `needs_human_review` and manual Edit remains available.

## Admin Workflow

To fix missing metadata:

1. Update the exam track, topic, subtopic, or Social Work blueprint item.
2. Backfill legacy question context when possible.
3. Click `Rerun Integrity`.
4. Use `Auto-Improve and Recheck` for weak but metadata-complete questions.
5. Run editorial review, final review, and committee review.
6. Publish only when the final publication checklist passes.

Legacy `Psychopathology & Diagnosis` Social Work questions are backfilled to the LCSW/Clinical DSM-5-TR assessment blueprint item when possible.

## Model Configuration

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

See `docs/AI_EDITORIAL_PIPELINE.md` for the full staged workflow.
