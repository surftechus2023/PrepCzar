# AI Content Generation

PrepCzar generates content once in the admin area, stores it in Supabase, and serves only stored, reviewed, active content to students. Student practice routes do not call OpenAI.

## Supported Content

- MCQs
- Flashcards
- Case vignettes

## Supported Tracks

- EPPP
- BSW
- LMSW/MSW
- LCSW/Clinical
- NCE
- CCM
- NCLEX-RN
- NCLEX-PN

## Required Admin Inputs

Use `Admin > Generate Content` and select:

- exam category
- exam track
- blueprint domain/topic
- competency section / applied knowledge objective
- content type
- quantity
- intended difficulty
- intended cognitive level
- generation language

The API loads the complete selected blueprint context from Supabase before calling OpenAI.

## Blueprint Grounding

Generation includes:

- exam-track name
- exam level
- official exam description
- domain and weight
- competency
- applied knowledge statement
- topic and subtopic descriptions
- learning objective
- official blueprint text
- exam-specific writing rules
- intended cognitive level
- intended difficulty

If required metadata is missing, generation stops with:

`The selected blueprint objective is incomplete. Add official blueprint text and a learning objective before generating content.`

## Difficulty Policy

Generated content is medium or hard only.

- Medium requires application.
- Hard requires reasoning, prioritization, clinical judgment, ethical analysis, risk assessment, differential diagnosis, or complex decision-making when appropriate.

Easy generated items are not allowed.

## Workflow

1. Create an `ai_generation_batches` row.
2. Fetch complete blueprint metadata.
3. Generate content in chunks of up to 25.
4. Validate the model response with Zod.
5. Run deterministic prechecks.
6. Create duplicate hashes.
7. Insert accepted items as `reviewed = false` and `active = false`.
8. Insert MCQs with `integrity_status = pending`.
9. Log rejected items and reasons.
10. Update batch counts and status.

## MCQs

Stored MCQs include:

- question stem
- four stored answer options
- one correct option
- correct-answer rationale
- rationale for each distractor
- test-taking guidance
- applied knowledge statement
- cognitive level
- intended difficulty
- blueprint reference
- source metadata
- language fields where present

MCQs are also passed through the integrity checker after insertion.

## Flashcards

Stored flashcards include:

- concise front
- complete back
- blueprint reference
- topic/subtopic metadata
- learning objective
- difficulty
- cognitive level
- language fields

## Case Vignettes

Stored vignettes include:

- scenario
- prompt
- expected answer elements
- scoring rubric
- ideal response
- coaching feedback
- blueprint reference
- topic/subtopic metadata
- difficulty
- cognitive level
- language fields

## Test Batch: Five MCQs

1. Go to `Admin > Generate Content`.
2. Select the exam category.
3. Select the exam track.
4. Select a blueprint domain/topic.
5. Select a competency/applied knowledge objective.
6. Set `Content Type` to `MCQ Questions`.
7. Set `Quantity` to `5`.
8. Set `Difficulty` to `Medium` or `Hard`.
9. Set `Cognitive Level` to `Application` or `Reasoning`.
10. Click `Generate`.

The five questions are saved as inactive drafts:

- `reviewed = false`
- `active = false`
- `integrity_status = pending`

They will not appear in student practice until an admin reviews and publishes them.
