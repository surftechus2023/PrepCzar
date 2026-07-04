# Social Work Blueprint Generation

PrepCzar treats stored ASWB/Social Work blueprint metadata as the source of truth for BSW/Bachelors, LMSW/MSW/Masters, and LCSW/Clinical question generation.

## Stored Metadata

Social Work generation requires populated metadata in:

- `exam_tracks`: `official_source_url`, `official_exam_description`, `aswb_exam_level`
- `topics`: major content area title, description, `official_blueprint_text`, `official_weight_percent`
- `subtopics`: competency section title, description, learning objective, `official_blueprint_text`, display order
- `social_work_blueprint_items`: exam level, major content area, weight, competency section, applied knowledge statement, cognitive guidance, official blueprint text, style guidance
- `question_blueprint_guidelines`: cognitive level, allowed question types, prohibited question types, and difficulty rules

The app must not invent Social Work blueprint statements. If required fields are missing, generation and review should stop with `needs_metadata`.

## Exam Levels

- **BSW/Bachelors:** foundational social work values, ethics, assessment, planning, intervention, service delivery, diversity, and social justice.
- **LMSW/MSW/Masters:** graduate-level application and professional reasoning across assessment, planning, intervention, ethics, supervision, community practice, and research.
- **LCSW/Clinical:** vignette-based clinical reasoning across ethics, assessment, DSM-informed diagnosis, risk, treatment planning, intervention, supervision, and clinical judgment.

## LCSW/Clinical Blueprint

The Clinical track uses these major content areas:

- `I. VALUES AND ETHICS` - 36%
- `II. ASSESSMENT AND PLANNING` - 32%
- `III. INTERVENTION AND PRACTICE` - 32%

Clinical blueprint detail includes confidentiality, ethical dilemmas, informed consent, boundaries, mandatory reporting, self-determination, diversity and social justice, trauma, mental and emotional illness, co-occurring disorders, biopsychosocial assessment, DSM-5-TR use, mental status examination, risk of harm, treatment planning, intervention modalities, trauma-informed care, crisis intervention, motivational interviewing, CBT, DBT, EMDR, mindfulness-based interventions, family/couples/group interventions, supervision, consultation, transference, and countertransference.

Legacy `Psychopathology & Diagnosis` content is mapped to:

- Major content area: `II. ASSESSMENT AND PLANNING`
- Competency: `IIB. ASSESSMENT METHODS AND TECHNIQUES`
- Applied knowledge statement: `Use of the Diagnostic and Statistical Manual of Mental Disorders in assessment and common indicators of mental health and brain-related conditions`

## Generation Rules

Admins must select a stored Social Work applied knowledge statement. The generator receives the exam track, ASWB exam level, exam description, major content area, weight, competency section, applied knowledge statement, topic blueprint text, subtopic blueprint text, question-writing guideline, cognitive target, and difficulty target.

Social Work questions are medium or hard only. Easy recall questions are rejected.

- Medium: requires applying blueprint knowledge to a practice scenario.
- Hard: requires reasoning, prioritization, risk assessment, ethical judgment, differential diagnosis, or best-next-step decision-making.

LCSW/Clinical questions should be case-vignette items using FIRST, NEXT, BEST, or MOST appropriate when helpful. They must stay within social work scope and must not require prescribing medication or other out-of-scope decisions.

## Integrity Review

The integrity checker uses the same stored metadata that the generator used. It compares the question against exam track, ASWB exam level, major content area, competency section, applied knowledge statement, topic blueprint text, subtopic blueprint text, difficulty target, cognitive target, and ASWB-style question-writing guidance.

Blueprint alignment:

- `90-100`: directly tests the selected applied knowledge statement
- `80-89`: aligned and acceptable
- `70-79`: related but generic or weak
- below `70`: off-topic or not tied to the supplied blueprint

The legacy integrity pass requires `blueprint_alignment_score >= 85`, `difficulty_quality_score >= 80`, and `integrity_score >= 85`. The GPT editorial publication gate is stricter: blueprint `>=90`, difficulty `>=85`, integrity `>=90`, and committee approval. Missing blueprint metadata returns `needs_metadata`. Easy questions return `needs_improvement`.

## Auto-Improve

Auto-improve receives the original question, failed scores, quality flags, distractor flags, blueprint context, exam-track rules, applied knowledge statement, difficulty target, and cognitive target.

For LCSW/Clinical, weak or generic items are rewritten into case vignettes testing differential diagnosis, assessment priority, risk assessment, ethical decision-making, best next step, treatment planning, or clinical intervention choice.

The rewrite must preserve exam track, major content area, competency, applied knowledge statement, and Social Work scope. After two failed attempts, the question is marked `needs_human_review`; manual Edit remains enabled.

## Admin Fixes

If review shows `Missing blueprint metadata - update topic/subtopic before generating or reviewing`, update the stored topic/subtopic or Social Work blueprint item first, then rerun integrity and the GPT editorial stages. Do not publish legacy Social Work questions until metadata exists, final scores pass, and committee review approves.
