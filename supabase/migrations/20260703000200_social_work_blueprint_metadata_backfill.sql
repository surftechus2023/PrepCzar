-- Backfill complete Social Work blueprint metadata for generation, review, and improvement.

ALTER TABLE exam_tracks
  ADD COLUMN IF NOT EXISTS aswb_exam_level text;

CREATE TABLE IF NOT EXISTS question_blueprint_guidelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_track_id uuid NOT NULL REFERENCES exam_tracks(id) ON DELETE CASCADE,
  cognitive_level text NOT NULL,
  question_style_guideline text NOT NULL DEFAULT '',
  allowed_question_types text[] NOT NULL DEFAULT ARRAY[]::text[],
  prohibited_question_types text[] NOT NULL DEFAULT ARRAY[]::text[],
  difficulty_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE (exam_track_id, cognitive_level)
);

ALTER TABLE question_blueprint_guidelines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read question blueprint guidelines" ON question_blueprint_guidelines;
CREATE POLICY "Users can read question blueprint guidelines"
  ON question_blueprint_guidelines FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage question blueprint guidelines" ON question_blueprint_guidelines;
CREATE POLICY "Admins can manage question blueprint guidelines"
  ON question_blueprint_guidelines FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

UPDATE exam_tracks
SET
  official_source_url = COALESCE(NULLIF(official_source_url, ''), 'https://www.aswb.org/exam/getting-ready-for-the-exam/exam-content-outlines/'),
  official_exam_description = CASE slug
    WHEN 'bsw' THEN 'ASWB Bachelors/Associate Social Work exam blueprint. Questions must test entry-level social work values, ethics, assessment, planning, intervention, service delivery, diversity, and social justice using stored blueprint metadata.'
    WHEN 'msw-lmsw' THEN 'ASWB Masters Social Work exam blueprint. Questions must test graduate-level social work ethics, assessment, planning, intervention, supervision, community practice, research, and professional judgment using stored blueprint metadata.'
    WHEN 'lcsw' THEN 'ASWB Clinical Social Work exam blueprint. Questions must test clinical social work ethics, assessment, DSM-informed diagnosis, risk assessment, treatment planning, intervention, supervision, and clinical judgment using stored blueprint metadata.'
    ELSE official_exam_description
  END,
  aswb_exam_level = CASE slug
    WHEN 'bsw' THEN 'bsw'
    WHEN 'msw-lmsw' THEN 'lmsw_msw'
    WHEN 'lcsw' THEN 'lcsw_clinical'
    ELSE aswb_exam_level
  END
WHERE slug IN ('bsw', 'msw-lmsw', 'lcsw');

WITH topic_source AS (
  SELECT
    exam_track_id,
    major_content_area AS title,
    major_content_area || ' official ASWB Social Work major content area.' AS description,
    MIN(display_order) AS display_order,
    MAX(percentage_weight) AS official_weight_percent,
    string_agg(DISTINCT competency_section || ' > ' || applied_knowledge_statement, E'\n' ORDER BY competency_section || ' > ' || applied_knowledge_statement) AS official_blueprint_text
  FROM social_work_blueprint_items
  WHERE exam_level IN ('bsw', 'lmsw_msw', 'lcsw_clinical')
  GROUP BY exam_track_id, major_content_area
),
updated_topics AS (
  UPDATE topics t
  SET
    description = topic_source.description,
    official_blueprint_text = topic_source.official_blueprint_text,
    official_weight_percent = topic_source.official_weight_percent,
    display_order = topic_source.display_order
  FROM topic_source
  WHERE t.exam_track_id = topic_source.exam_track_id
    AND t.title = topic_source.title
  RETURNING t.id
)
INSERT INTO topics (exam_track_id, title, description, display_order, official_weight_percent, official_blueprint_text)
SELECT
  topic_source.exam_track_id,
  topic_source.title,
  topic_source.description,
  topic_source.display_order,
  topic_source.official_weight_percent,
  topic_source.official_blueprint_text
FROM topic_source
WHERE NOT EXISTS (
  SELECT 1
  FROM topics existing
  WHERE existing.exam_track_id = topic_source.exam_track_id
    AND existing.title = topic_source.title
);

WITH subtopic_source AS (
  SELECT
    items.exam_track_id,
    topics.id AS topic_id,
    items.competency_section AS title,
    items.competency_section || ' official ASWB Social Work competency section.' AS description,
    string_agg(DISTINCT items.applied_knowledge_statement, E'\n' ORDER BY items.applied_knowledge_statement) AS learning_objective,
    string_agg(DISTINCT items.official_blueprint_text, E'\n' ORDER BY items.official_blueprint_text) AS official_blueprint_text,
    MIN(items.display_order) AS display_order
  FROM social_work_blueprint_items items
  JOIN topics ON topics.exam_track_id = items.exam_track_id
    AND topics.title = items.major_content_area
  WHERE items.exam_level IN ('bsw', 'lmsw_msw', 'lcsw_clinical')
  GROUP BY items.exam_track_id, topics.id, items.competency_section
),
updated_subtopics AS (
  UPDATE subtopics s
  SET
    description = subtopic_source.description,
    learning_objective = subtopic_source.learning_objective,
    official_blueprint_text = subtopic_source.official_blueprint_text,
    display_order = subtopic_source.display_order
  FROM subtopic_source
  WHERE s.topic_id = subtopic_source.topic_id
    AND s.title = subtopic_source.title
  RETURNING s.id
)
INSERT INTO subtopics (topic_id, title, description, learning_objective, official_blueprint_text, display_order)
SELECT
  subtopic_source.topic_id,
  subtopic_source.title,
  subtopic_source.description,
  subtopic_source.learning_objective,
  subtopic_source.official_blueprint_text,
  subtopic_source.display_order
FROM subtopic_source
WHERE NOT EXISTS (
  SELECT 1
  FROM subtopics existing
  WHERE existing.topic_id = subtopic_source.topic_id
    AND existing.title = subtopic_source.title
);

UPDATE social_work_blueprint_items items
SET
  topic_id = topics.id,
  subtopic_id = subtopics.id
FROM topics
JOIN subtopics ON subtopics.topic_id = topics.id
WHERE topics.exam_track_id = items.exam_track_id
  AND topics.title = items.major_content_area
  AND subtopics.title = items.competency_section;

WITH guidelines AS (
  SELECT
    et.id AS exam_track_id,
    levels.cognitive_level,
    CASE et.slug
      WHEN 'lcsw' THEN 'Use ASWB Clinical style. Prefer case vignettes, FIRST/NEXT/BEST/MOST decision tasks, clinical reasoning, assessment priority, risk assessment, differential diagnosis, ethics, treatment planning, intervention choice, and supervision/consultation reasoning. Keep the item inside social work scope.'
      WHEN 'msw-lmsw' THEN 'Use ASWB Masters style. Prefer graduate-level application and professional judgment in assessment, planning, intervention, ethics, supervision, community practice, and research contexts.'
      ELSE 'Use ASWB Bachelors/Associate style. Prefer clear social work practice scenarios using foundational values, ethics, assessment, planning, intervention, service delivery, diversity, and social justice.'
    END AS question_style_guideline,
    ARRAY['case vignette', 'application scenario', 'best next step', 'ethical judgment', 'risk assessment', 'intervention choice']::text[] AS allowed_question_types,
    ARRAY['easy recall', 'definition only', 'generic psychology', 'all of the above', 'none of the above', 'outside social work scope', 'prescribing medication']::text[] AS prohibited_question_types,
    jsonb_build_object(
      'easy_allowed', false,
      'medium', 'Requires application of stored blueprint knowledge to a practice scenario.',
      'hard', 'Requires reasoning, prioritization, risk assessment, ethical judgment, differential diagnosis, or best-next-step decision-making.',
      'minimum_blueprint_alignment_score', 85,
      'minimum_difficulty_quality_score', 80,
      'minimum_integrity_score', 85
    ) AS difficulty_rules
  FROM exam_tracks et
  CROSS JOIN (VALUES
    ('application'),
    ('analysis'),
    ('clinical judgment'),
    ('ethics'),
    ('safety'),
    ('prioritization')
  ) AS levels(cognitive_level)
  WHERE et.slug IN ('bsw', 'msw-lmsw', 'lcsw')
)
INSERT INTO question_blueprint_guidelines (
  exam_track_id,
  cognitive_level,
  question_style_guideline,
  allowed_question_types,
  prohibited_question_types,
  difficulty_rules
)
SELECT
  exam_track_id,
  cognitive_level,
  question_style_guideline,
  allowed_question_types,
  prohibited_question_types,
  difficulty_rules
FROM guidelines
ON CONFLICT (exam_track_id, cognitive_level)
DO UPDATE SET
  question_style_guideline = EXCLUDED.question_style_guideline,
  allowed_question_types = EXCLUDED.allowed_question_types,
  prohibited_question_types = EXCLUDED.prohibited_question_types,
  difficulty_rules = EXCLUDED.difficulty_rules;

WITH clinical_dsm_item AS (
  SELECT items.*
  FROM social_work_blueprint_items items
  JOIN exam_tracks et ON et.id = items.exam_track_id
  WHERE et.slug = 'lcsw'
    AND items.exam_level = 'lcsw_clinical'
    AND items.major_content_area = 'II. ASSESSMENT AND PLANNING'
    AND items.competency_section = 'IIB. ASSESSMENT METHODS AND TECHNIQUES'
    AND items.applied_knowledge_statement ILIKE 'Use of the Diagnostic and Statistical Manual of Mental Disorders%'
  LIMIT 1
)
UPDATE questions q
SET
  social_work_blueprint_item_id = clinical_dsm_item.id,
  topic_id = clinical_dsm_item.topic_id,
  subtopic_id = clinical_dsm_item.subtopic_id,
  blueprint_content_area = clinical_dsm_item.major_content_area,
  blueprint_competency_section = clinical_dsm_item.competency_section,
  applied_knowledge_statement = clinical_dsm_item.applied_knowledge_statement,
  question_writing_guideline = clinical_dsm_item.sample_style_guidance,
  intended_cognitive_level = COALESCE(q.intended_cognitive_level, q.cognitive_level, 'application'),
  difficulty = CASE WHEN q.difficulty = 'easy' THEN 'medium' ELSE q.difficulty END,
  blueprint_reference_text = 'Use of the DSM-5-TR in assessment, common indicators of mental health and brain-related conditions, differential diagnosis, co-occurring disorders, biopsychosocial assessment, risk assessment, and clinical decision-making within social work scope of practice.',
  active = false
FROM clinical_dsm_item
WHERE q.exam_track_id = clinical_dsm_item.exam_track_id
  AND (
    q.source_topic ILIKE '%Psychopathology & Diagnosis%'
    OR q.subtopic ILIKE '%Psychopathology & Diagnosis%'
    OR q.learning_objective ILIKE '%Psychopathology & Diagnosis%'
    OR q.blueprint_content_area ILIKE '%Psychopathology & Diagnosis%'
    OR q.blueprint_competency_section ILIKE '%Psychopathology & Diagnosis%'
  );
