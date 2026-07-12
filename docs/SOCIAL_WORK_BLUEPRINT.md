# Social Work Blueprint

Social Work uses separate stored blueprint metadata for BSW, LMSW/MSW, and LCSW/Clinical. Do not use one generic Social Work blueprint.

## Source Tables

- `social_work_blueprint_items` stores ASWB-style applied knowledge statements.
- `blueprint_domains` stores major content areas and weights.
- `blueprint_competencies` stores competency sections.
- `blueprint_objectives` stores applied knowledge statements and learning objectives.
- `question_blueprint_guidelines` stores Social Work question-writing rules by cognitive level.

The migration `20260712000100_blueprint_engine.sql` promotes existing `social_work_blueprint_items` into the generic blueprint hierarchy without deleting the original Social Work records.

## Exam-Level Rules

- BSW may include more foundational recall than LMSW or LCSW, but generated PrepCzar questions remain medium/hard only.
- LMSW/MSW emphasizes application, reasoning, ethics, assessment, planning, intervention, supervision, community practice, and professional judgment.
- LCSW/Clinical emphasizes application, reasoning, clinical judgment, risk, ethics, assessment, intervention, DSM-informed differential diagnosis, treatment planning, and best-next-step decisions.

## Question Style Rules

Stored Social Work guidelines require:

- three or four ASWB-style answer options may be represented, while PrepCzar stores exactly four choices
- one correct answer only
- no `all of the above`
- no `none of the above`
- no combined answers such as `A and B`
- clear wording
- no intentional trick questions
- practice-relevant content
- qualifiers such as BEST, FIRST, NEXT, and MOST when appropriate
- approximately tenth-grade readability except required professional terms

## Cognitive Levels

The stored cognitive levels are:

- `recall`
- `application`
- `reasoning`

Generation still rejects easy recall-only questions for this project. Recall guidance can support foundational context, but generated questions must require medium or hard application/reasoning.

## Missing Metadata

Social Work generation requires:

- official source URL
- exam description
- ASWB exam level
- major content area
- content weight
- competency section
- applied knowledge statement
- learning objective
- topic/domain blueprint text
- objective blueprint text
- question-writing guideline

If any required field is missing or marked placeholder, generation stops and admins must fix the record in `Admin > Blueprints`.

## Legacy Mapping

Existing legacy Social Work topics are mapped through the previous backfill. The generic engine keeps that mapping and additionally links topics/subtopics into the new domain/competency/objective hierarchy.

The legacy `Psychopathology & Diagnosis` mapping remains:

- Major content area: `II. ASSESSMENT AND PLANNING`
- Competency: `IIB. ASSESSMENT METHODS AND TECHNIQUES`
- Applied knowledge statement: DSM-5-TR use in assessment and common indicators of mental health and brain-related conditions

Legacy questions are not safe to publish until their blueprint metadata exists and integrity review passes.
