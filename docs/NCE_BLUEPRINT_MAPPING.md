# NCE Blueprint Mapping

## Database Records

Migration `20260723000100_nce_blueprint_engine.sql` seeds:

- `blueprint_domains`
- `blueprint_competencies`
- `blueprint_objectives`
- `topics`
- `subtopics`
- `cacrep_core_areas`
- `blueprint_objective_cacrep_mappings`
- `question_blueprint_guidelines`

## Content Storage

Generated NCE MCQs, flashcards, and case vignettes store:

- `exam_track_id`
- `topic_id`
- `subtopic_id`
- `blueprint_domain_id`
- `blueprint_competency_id`
- `blueprint_objective_id`
- `blueprint_reference_text`
- `cacrep_core_areas`
- `blueprint_version`
- `difficulty`
- `cognitive_level`
- `generation_batch_id`

## Integrity Review

The integrity engine receives the stored blueprint objective and CACREP mapping. Blueprint alignment should fail when content measures a different counseling competency than the selected NCE objective.

## Admin Verification

Admins can verify NCE records in Admin → Blueprint Engine by selecting the NCE exam track. Domains show official weight and scored item count. Objectives should be complete and not placeholders.
