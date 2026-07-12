-- Additive exam blueprint engine.
-- Creates a generic hierarchy while preserving existing topics, subtopics, and
-- Social Work blueprint item records.

ALTER TABLE exam_tracks
  ADD COLUMN IF NOT EXISTS exam_level text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE exam_tracks
SET exam_level = CASE slug
  WHEN 'eppp' THEN 'professional_psychology'
  WHEN 'bsw' THEN 'bsw'
  WHEN 'msw-lmsw' THEN 'lmsw_msw'
  WHEN 'lcsw' THEN 'lcsw_clinical'
  WHEN 'nce' THEN 'national_counselor'
  WHEN 'ccm' THEN 'certified_case_manager'
  WHEN 'nclex-rn' THEN 'registered_nurse'
  WHEN 'nclex-pn' THEN 'practical_nurse'
  ELSE COALESCE(exam_level, slug)
END
WHERE exam_level IS NULL OR exam_level = '';

UPDATE exam_tracks
SET
  official_source_url = COALESCE(NULLIF(official_source_url, ''), CASE slug
    WHEN 'eppp' THEN 'https://www.asppb.net/page/EPPPPart1'
    WHEN 'bsw' THEN 'https://www.aswb.org/exam/getting-ready-for-the-exam/exam-content-outlines/'
    WHEN 'msw-lmsw' THEN 'https://www.aswb.org/exam/getting-ready-for-the-exam/exam-content-outlines/'
    WHEN 'lcsw' THEN 'https://www.aswb.org/exam/getting-ready-for-the-exam/exam-content-outlines/'
    WHEN 'nce' THEN 'https://www.nbcc.org/exams/nce'
    WHEN 'ccm' THEN 'https://ccmcertification.org/get-certified/exam/exam-guide/'
    WHEN 'nclex-rn' THEN 'https://www.nclex.com/test-plans.page'
    WHEN 'nclex-pn' THEN 'https://www.nclex.com/test-plans.page'
    ELSE official_source_url
  END),
  official_exam_description = COALESCE(NULLIF(official_exam_description, ''), CASE slug
    WHEN 'eppp' THEN 'EPPP exam track blueprint metadata for professional psychology knowledge, assessment, intervention, research, ethics, and professional practice.'
    WHEN 'nce' THEN 'NCE exam track blueprint metadata for professional counseling knowledge, helping relationships, groups, career, assessment, research, diversity, ethics, and professional practice.'
    WHEN 'ccm' THEN 'CCM exam track blueprint metadata for case management concepts, care delivery, reimbursement, psychosocial support, rehabilitation, quality, outcomes, ethics, law, and practice standards.'
    WHEN 'nclex-rn' THEN 'NCLEX-RN exam track blueprint metadata for registered nursing judgment across safe care, health promotion, psychosocial integrity, and physiological integrity.'
    WHEN 'nclex-pn' THEN 'NCLEX-PN exam track blueprint metadata for practical nursing judgment across coordinated care, health promotion, psychosocial integrity, and physiological integrity.'
    ELSE official_exam_description
  END),
  updated_at = now()
WHERE slug IN ('eppp', 'bsw', 'msw-lmsw', 'lcsw', 'nce', 'ccm', 'nclex-rn', 'nclex-pn');

CREATE TABLE IF NOT EXISTS blueprint_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_track_id uuid NOT NULL REFERENCES exam_tracks(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  official_blueprint_text text NOT NULL DEFAULT '',
  weight_percent numeric(5,2),
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  is_placeholder boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_track_id, code),
  UNIQUE (exam_track_id, title)
);

CREATE TABLE IF NOT EXISTS blueprint_competencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES blueprint_domains(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  official_blueprint_text text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  is_placeholder boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain_id, code),
  UNIQUE (domain_id, title)
);

CREATE TABLE IF NOT EXISTS blueprint_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_id uuid NOT NULL REFERENCES blueprint_competencies(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  official_blueprint_text text NOT NULL DEFAULT '',
  learning_objective text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  is_placeholder boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competency_id, code),
  UNIQUE (competency_id, title)
);

CREATE INDEX IF NOT EXISTS idx_blueprint_domains_track
  ON blueprint_domains(exam_track_id, display_order);

CREATE INDEX IF NOT EXISTS idx_blueprint_competencies_domain
  ON blueprint_competencies(domain_id, display_order);

CREATE INDEX IF NOT EXISTS idx_blueprint_objectives_competency
  ON blueprint_objectives(competency_id, display_order);

ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS blueprint_domain_id uuid REFERENCES blueprint_domains(id) ON DELETE SET NULL;

ALTER TABLE subtopics
  ADD COLUMN IF NOT EXISTS blueprint_competency_id uuid REFERENCES blueprint_competencies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS blueprint_objective_id uuid REFERENCES blueprint_objectives(id) ON DELETE SET NULL;

ALTER TABLE blueprint_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE blueprint_competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE blueprint_objectives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read blueprint domains" ON blueprint_domains;
CREATE POLICY "Users can read blueprint domains"
  ON blueprint_domains FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage blueprint domains" ON blueprint_domains;
CREATE POLICY "Admins can manage blueprint domains"
  ON blueprint_domains FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP POLICY IF EXISTS "Users can read blueprint competencies" ON blueprint_competencies;
CREATE POLICY "Users can read blueprint competencies"
  ON blueprint_competencies FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage blueprint competencies" ON blueprint_competencies;
CREATE POLICY "Admins can manage blueprint competencies"
  ON blueprint_competencies FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP POLICY IF EXISTS "Users can read blueprint objectives" ON blueprint_objectives;
CREATE POLICY "Users can read blueprint objectives"
  ON blueprint_objectives FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage blueprint objectives" ON blueprint_objectives;
CREATE POLICY "Admins can manage blueprint objectives"
  ON blueprint_objectives FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

WITH social_work_domains AS (
  SELECT
    exam_track_id,
    regexp_replace(split_part(major_content_area, ' ', 1), '[^A-Z0-9]', '', 'g') AS code,
    major_content_area AS title,
    major_content_area || ' official ASWB major content area.' AS description,
    string_agg(DISTINCT official_blueprint_text, E'\n' ORDER BY official_blueprint_text) AS official_blueprint_text,
    MAX(percentage_weight) AS weight_percent,
    MIN(display_order) AS display_order
  FROM social_work_blueprint_items
  GROUP BY exam_track_id, major_content_area
)
INSERT INTO blueprint_domains (
  exam_track_id,
  code,
  title,
  description,
  official_blueprint_text,
  weight_percent,
  display_order,
  active,
  is_placeholder
)
SELECT
  exam_track_id,
  NULLIF(code, '') AS code,
  title,
  description,
  official_blueprint_text,
  weight_percent,
  display_order,
  true,
  false
FROM social_work_domains
ON CONFLICT (exam_track_id, title) DO UPDATE SET
  code = EXCLUDED.code,
  description = EXCLUDED.description,
  official_blueprint_text = EXCLUDED.official_blueprint_text,
  weight_percent = EXCLUDED.weight_percent,
  display_order = EXCLUDED.display_order,
  is_placeholder = false,
  updated_at = now();

WITH social_work_competencies AS (
  SELECT
    domains.id AS domain_id,
    regexp_replace(split_part(items.competency_section, ' ', 1), '[^A-Z0-9]', '', 'g') AS code,
    items.competency_section AS title,
    items.competency_section || ' official ASWB competency section.' AS description,
    string_agg(DISTINCT items.official_blueprint_text, E'\n' ORDER BY items.official_blueprint_text) AS official_blueprint_text,
    MIN(items.display_order) AS display_order
  FROM social_work_blueprint_items items
  JOIN blueprint_domains domains
    ON domains.exam_track_id = items.exam_track_id
   AND domains.title = items.major_content_area
  GROUP BY domains.id, items.competency_section
)
INSERT INTO blueprint_competencies (
  domain_id,
  code,
  title,
  description,
  official_blueprint_text,
  display_order,
  active,
  is_placeholder
)
SELECT
  domain_id,
  NULLIF(code, '') AS code,
  title,
  description,
  official_blueprint_text,
  display_order,
  true,
  false
FROM social_work_competencies
ON CONFLICT (domain_id, title) DO UPDATE SET
  code = EXCLUDED.code,
  description = EXCLUDED.description,
  official_blueprint_text = EXCLUDED.official_blueprint_text,
  display_order = EXCLUDED.display_order,
  is_placeholder = false,
  updated_at = now();

WITH social_work_objectives AS (
  SELECT
    competencies.id AS competency_id,
    'O' || lpad(items.display_order::text, 3, '0') AS code,
    items.applied_knowledge_statement AS title,
    items.applied_knowledge_statement AS description,
    items.official_blueprint_text,
    items.applied_knowledge_statement AS learning_objective,
    items.display_order
  FROM social_work_blueprint_items items
  JOIN blueprint_domains domains
    ON domains.exam_track_id = items.exam_track_id
   AND domains.title = items.major_content_area
  JOIN blueprint_competencies competencies
    ON competencies.domain_id = domains.id
   AND competencies.title = items.competency_section
)
INSERT INTO blueprint_objectives (
  competency_id,
  code,
  title,
  description,
  official_blueprint_text,
  learning_objective,
  display_order,
  active,
  is_placeholder
)
SELECT
  competency_id,
  code,
  title,
  description,
  official_blueprint_text,
  learning_objective,
  display_order,
  true,
  false
FROM social_work_objectives
ON CONFLICT (competency_id, title) DO UPDATE SET
  code = EXCLUDED.code,
  description = EXCLUDED.description,
  official_blueprint_text = EXCLUDED.official_blueprint_text,
  learning_objective = EXCLUDED.learning_objective,
  display_order = EXCLUDED.display_order,
  is_placeholder = false,
  updated_at = now();

WITH generic_domains AS (
  SELECT
    topics.exam_track_id,
    'D' || lpad(COALESCE(NULLIF(topics.display_order, 0), row_number() OVER (PARTITION BY topics.exam_track_id ORDER BY topics.display_order, topics.title))::text, 2, '0') AS code,
    topics.title,
    topics.description,
    COALESCE(NULLIF(topics.official_blueprint_text, ''), topics.title || ': ' || COALESCE(NULLIF(topics.description, ''), 'Blueprint metadata requires official source verification.')) AS official_blueprint_text,
    topics.official_weight_percent AS weight_percent,
    topics.display_order,
    (NULLIF(topics.official_blueprint_text, '') IS NULL) AS is_placeholder
  FROM topics
  JOIN exam_tracks ON exam_tracks.id = topics.exam_track_id
  WHERE exam_tracks.slug NOT IN ('bsw', 'msw-lmsw', 'lcsw')
    AND topics.exam_track_id IS NOT NULL
)
INSERT INTO blueprint_domains (
  exam_track_id,
  code,
  title,
  description,
  official_blueprint_text,
  weight_percent,
  display_order,
  active,
  is_placeholder
)
SELECT
  exam_track_id,
  code,
  title,
  description,
  official_blueprint_text,
  weight_percent,
  display_order,
  true,
  is_placeholder
FROM generic_domains
ON CONFLICT (exam_track_id, title) DO UPDATE SET
  description = EXCLUDED.description,
  official_blueprint_text = EXCLUDED.official_blueprint_text,
  weight_percent = EXCLUDED.weight_percent,
  display_order = EXCLUDED.display_order,
  is_placeholder = EXCLUDED.is_placeholder,
  updated_at = now();

WITH generic_competencies AS (
  SELECT
    domains.id AS domain_id,
    'C01' AS code,
    'Core Knowledge and Practice Applications' AS title,
    'Competency section for exam-level application of the domain blueprint.' AS description,
    domains.official_blueprint_text,
    1 AS display_order,
    domains.is_placeholder
  FROM blueprint_domains domains
  JOIN exam_tracks tracks ON tracks.id = domains.exam_track_id
  WHERE tracks.slug NOT IN ('bsw', 'msw-lmsw', 'lcsw')
)
INSERT INTO blueprint_competencies (
  domain_id,
  code,
  title,
  description,
  official_blueprint_text,
  display_order,
  active,
  is_placeholder
)
SELECT domain_id, code, title, description, official_blueprint_text, display_order, true, is_placeholder
FROM generic_competencies
ON CONFLICT (domain_id, title) DO UPDATE SET
  official_blueprint_text = EXCLUDED.official_blueprint_text,
  is_placeholder = EXCLUDED.is_placeholder,
  updated_at = now();

WITH generic_objectives AS (
  SELECT
    competencies.id AS competency_id,
    'O01' AS code,
    domains.title || ' application objective' AS title,
    'Apply stored blueprint guidance for ' || domains.title || ' to an exam-relevant practice scenario.' AS description,
    competencies.official_blueprint_text,
    'Apply stored blueprint guidance for ' || domains.title || ' to an exam-relevant practice scenario.' AS learning_objective,
    1 AS display_order,
    competencies.is_placeholder
  FROM blueprint_competencies competencies
  JOIN blueprint_domains domains ON domains.id = competencies.domain_id
  JOIN exam_tracks tracks ON tracks.id = domains.exam_track_id
  WHERE tracks.slug NOT IN ('bsw', 'msw-lmsw', 'lcsw')
)
INSERT INTO blueprint_objectives (
  competency_id,
  code,
  title,
  description,
  official_blueprint_text,
  learning_objective,
  display_order,
  active,
  is_placeholder
)
SELECT
  competency_id,
  code,
  title,
  description,
  official_blueprint_text,
  learning_objective,
  display_order,
  true,
  is_placeholder
FROM generic_objectives
ON CONFLICT (competency_id, title) DO UPDATE SET
  official_blueprint_text = EXCLUDED.official_blueprint_text,
  learning_objective = EXCLUDED.learning_objective,
  is_placeholder = EXCLUDED.is_placeholder,
  updated_at = now();

UPDATE topics
SET blueprint_domain_id = domains.id
FROM blueprint_domains domains
WHERE domains.exam_track_id = topics.exam_track_id
  AND domains.title = topics.title;

UPDATE subtopics
SET blueprint_competency_id = competencies.id
FROM topics
JOIN blueprint_domains domains ON domains.id = topics.blueprint_domain_id
JOIN blueprint_competencies competencies ON competencies.domain_id = domains.id
WHERE subtopics.topic_id = topics.id
  AND competencies.title = subtopics.title;

UPDATE subtopics
SET blueprint_objective_id = objectives.id
FROM blueprint_competencies competencies
JOIN blueprint_objectives objectives ON objectives.competency_id = competencies.id
WHERE subtopics.blueprint_competency_id = competencies.id
  AND subtopics.blueprint_objective_id IS NULL
  AND objectives.display_order = (
    SELECT MIN(inner_objectives.display_order)
    FROM blueprint_objectives inner_objectives
    WHERE inner_objectives.competency_id = competencies.id
  );

WITH guideline_source AS (
  SELECT
    tracks.id AS exam_track_id,
    levels.cognitive_level,
    CASE
      WHEN tracks.slug = 'bsw' THEN 'ASWB BSW style: clear foundational social work scenarios; more recall may appear, but medium and hard generated questions still require application or reasoning.'
      WHEN tracks.slug = 'msw-lmsw' THEN 'ASWB LMSW/MSW style: emphasize graduate-level application, reasoning, ethics, assessment, planning, intervention, supervision, and professional judgment.'
      WHEN tracks.slug = 'lcsw' THEN 'ASWB LCSW/Clinical style: emphasize clinical vignettes, risk, ethics, assessment, intervention, DSM-informed differential diagnosis, treatment planning, and best-next-step judgment.'
      ELSE 'Use the stored blueprint hierarchy as source of truth. Generate clear professional exam items with one correct answer, plausible distractors, no trick wording, no all/none-of-the-above, and medium or hard difficulty only.'
    END AS question_style_guideline,
    CASE
      WHEN tracks.slug IN ('bsw', 'msw-lmsw', 'lcsw') THEN ARRAY['three-option ASWB style', 'four-option ASWB style', 'case vignette', 'application scenario', 'best next step', 'ethical judgment', 'risk assessment', 'intervention choice']::text[]
      ELSE ARRAY['four-option multiple choice', 'case vignette', 'application scenario', 'best next step', 'reasoning item']::text[]
    END AS allowed_question_types,
    ARRAY['easy recall for generated items', 'definition only', 'all of the above', 'none of the above', 'A and B', 'trick question', 'outside exam scope']::text[] AS prohibited_question_types,
    jsonb_build_object(
      'easy_allowed', false,
      'medium', 'Requires application of stored blueprint knowledge to a practice scenario.',
      'hard', 'Requires reasoning, prioritization, risk assessment, ethical judgment, differential diagnosis, or best-next-step decision-making.',
      'readability', 'Approximately tenth-grade readability except required professional terms.',
      'one_correct_answer_only', true
    ) AS difficulty_rules
  FROM exam_tracks tracks
  CROSS JOIN (VALUES ('recall'), ('application'), ('reasoning')) AS levels(cognitive_level)
  WHERE tracks.slug IN ('eppp', 'bsw', 'msw-lmsw', 'lcsw', 'nce', 'ccm', 'nclex-rn', 'nclex-pn')
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
FROM guideline_source
ON CONFLICT (exam_track_id, cognitive_level)
DO UPDATE SET
  question_style_guideline = EXCLUDED.question_style_guideline,
  allowed_question_types = EXCLUDED.allowed_question_types,
  prohibited_question_types = EXCLUDED.prohibited_question_types,
  difficulty_rules = EXCLUDED.difficulty_rules;
