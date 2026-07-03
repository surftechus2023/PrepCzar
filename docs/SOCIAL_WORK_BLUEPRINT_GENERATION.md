# Social Work Blueprint Generation

PrepCzar uses stored Social Work blueprint metadata as the source of truth for BSW/Bachelors, LMSW/MSW/Masters, and LCSW/Clinical AI question generation.

## Stored Blueprint Model

Official blueprint content is stored in `social_work_blueprint_items`.

Each record maps one selectable blueprint item:

- `exam_track_id`: BSW, LMSW/MSW, or LCSW/Clinical track
- `major_content_area`: major ASWB-style content area
- `percentage_weight`: content area weight
- `competency_section`: competency/domain section
- `applied_knowledge_statement`: the specific applied knowledge statement tested
- `cognitive_level_guidance`: recall, application, reasoning, clinical judgment, ethics, safety, or prioritization guidance
- `official_blueprint_text`: official handbook/blueprint text copied from the uploaded source
- `sample_style_guidance`: ASWB-style item-writing guidance for that blueprint item

The actual official blueprint text must be populated from the uploaded blueprint/handbook. The app should not invent applied knowledge statements.

## Exam-Level Differences

- **BSW/Bachelors:** foundational social work knowledge; more recall and application are acceptable.
- **LMSW/MSW/Masters:** graduate-level application and reasoning; emphasizes assessment, planning, intervention, ethics, supervision, community practice, and professional judgment.
- **LCSW/Clinical:** vignette-based reasoning; emphasizes assessment, DSM-informed diagnosis, risk, treatment planning, clinical intervention, boundaries, confidentiality, mandated reporting, supervision, and ethical clinical judgment.

## Generation Flow

Admins select:

- exam track
- topic
- Social Work applied knowledge statement
- quantity
- intended cognitive level
- intended difficulty

The generator includes the selected blueprint item in the prompt and generates only questions aligned to that applied knowledge statement. Social Work questions must use simple wording, one clear best answer, plausible distractors, ASWB-style qualifiers such as BEST/FIRST/NEXT/MOST when appropriate, and detailed rationales.

The app stores the selected blueprint context on each generated question:

- `social_work_blueprint_item_id`
- `blueprint_content_area`
- `blueprint_competency_section`
- `applied_knowledge_statement`
- `question_writing_guideline`
- `intended_cognitive_level`
- `blueprint_reference_text`

## Integrity Scoring

The integrity checker compares each question against:

- selected exam track
- selected major content area
- selected competency section
- selected applied knowledge statement
- stored official blueprint text
- intended cognitive level
- intended difficulty

Blueprint alignment scoring:

- `90–100`: directly tests the selected applied knowledge statement
- `80–89`: aligned and acceptable but not specific enough for automatic pass
- `70–79`: related but weak or generic
- below `70`: off-topic or not clearly tied to the selected blueprint item

If required blueprint metadata is missing, the checker sets `integrity_status='needs_metadata'` instead of assigning a low alignment score.

## Auto-Improvement

When a generated question falls below threshold, the auto-improver rewrites it using the same selected blueprint item. It preserves exam track, topic, competency, applied knowledge statement, intended cognitive level, and intended difficulty.

Auto-improvement:

- increases blueprint alignment
- improves ASWB-style realism
- strengthens distractors and rationales
- makes LCSW/Clinical items more vignette-based when appropriate
- avoids shifting to another topic or scope of practice

Auto-improvement is limited to two attempts. If the item still fails, it becomes `needs_human_review`.

## Review UI

The AI Question Review page includes “Blueprint context used for generation and integrity check,” showing:

- exam track
- major content area
- weight
- competency section
- applied knowledge statement
- cognitive level target
- blueprint text used
- question-writing guideline used

This lets reviewers verify the metadata used for both generation and scoring.

## Publishing

Students can see only questions that are:

- `reviewed=true`
- `active=true`
- `integrity_status='passed'`
- `blueprint_alignment_score >= 90`
- `difficulty_quality_score >= 80`

An admin override can publish an exception, but the override reason is recorded.

## Human Review Requirement

This workflow is an automated pre-review quality-control layer. It does not replace professional psychometric validation or SME review. Human review remains required before publishing high-stakes exam content.
