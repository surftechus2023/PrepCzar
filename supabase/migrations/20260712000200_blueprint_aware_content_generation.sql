-- Store blueprint metadata for non-MCQ generated content and batch history.

INSERT INTO subtopics (
  topic_id,
  title,
  description,
  learning_objective,
  official_blueprint_text,
  blueprint_competency_id,
  blueprint_objective_id,
  display_order
)
SELECT
  topics.id,
  competencies.title,
  competencies.description,
  objectives.learning_objective,
  objectives.official_blueprint_text,
  competencies.id,
  objectives.id,
  competencies.display_order
FROM topics
JOIN blueprint_domains domains ON domains.id = topics.blueprint_domain_id
JOIN blueprint_competencies competencies ON competencies.domain_id = domains.id
JOIN blueprint_objectives objectives ON objectives.competency_id = competencies.id
WHERE NOT EXISTS (
  SELECT 1
  FROM subtopics existing
  WHERE existing.topic_id = topics.id
    AND existing.blueprint_competency_id = competencies.id
    AND existing.blueprint_objective_id = objectives.id
);

ALTER TABLE flashcards
  ADD COLUMN IF NOT EXISTS subtopic_id uuid REFERENCES subtopics(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS blueprint_domain_id uuid REFERENCES blueprint_domains(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS blueprint_competency_id uuid REFERENCES blueprint_competencies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS blueprint_objective_id uuid REFERENCES blueprint_objectives(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS blueprint_reference_text text,
  ADD COLUMN IF NOT EXISTS source_topic text,
  ADD COLUMN IF NOT EXISTS learning_objective text,
  ADD COLUMN IF NOT EXISTS difficulty text CHECK (difficulty IN ('medium', 'hard')),
  ADD COLUMN IF NOT EXISTS cognitive_level text,
  ADD COLUMN IF NOT EXISTS generation_batch_id uuid REFERENCES ai_generation_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS duplicate_hash text;

ALTER TABLE case_vignettes
  ADD COLUMN IF NOT EXISTS subtopic_id uuid REFERENCES subtopics(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS blueprint_domain_id uuid REFERENCES blueprint_domains(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS blueprint_competency_id uuid REFERENCES blueprint_competencies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS blueprint_objective_id uuid REFERENCES blueprint_objectives(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS blueprint_reference_text text,
  ADD COLUMN IF NOT EXISTS source_topic text,
  ADD COLUMN IF NOT EXISTS learning_objective text,
  ADD COLUMN IF NOT EXISTS difficulty text CHECK (difficulty IN ('medium', 'hard')),
  ADD COLUMN IF NOT EXISTS cognitive_level text,
  ADD COLUMN IF NOT EXISTS expected_answer_elements jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS scoring_rubric jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS generation_batch_id uuid REFERENCES ai_generation_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS duplicate_hash text;

ALTER TABLE generation_logs
  ADD COLUMN IF NOT EXISTS model_used text,
  ADD COLUMN IF NOT EXISTS estimated_cost numeric(10,6),
  ADD COLUMN IF NOT EXISTS rejected_reasons jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_flashcards_generation_batch_id ON flashcards(generation_batch_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_duplicate_hash ON flashcards(duplicate_hash);
CREATE INDEX IF NOT EXISTS idx_case_vignettes_generation_batch_id ON case_vignettes(generation_batch_id);
CREATE INDEX IF NOT EXISTS idx_case_vignettes_duplicate_hash ON case_vignettes(duplicate_hash);
