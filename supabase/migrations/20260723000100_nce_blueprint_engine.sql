ALTER TABLE blueprint_domains
  ADD COLUMN IF NOT EXISTS scored_item_count integer;

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS cacrep_core_areas text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS blueprint_version text,
  ADD COLUMN IF NOT EXISTS blueprint_domain_id uuid REFERENCES blueprint_domains(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS blueprint_competency_id uuid REFERENCES blueprint_competencies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS blueprint_objective_id uuid REFERENCES blueprint_objectives(id) ON DELETE SET NULL;

ALTER TABLE flashcards
  ADD COLUMN IF NOT EXISTS cacrep_core_areas text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS blueprint_version text;

ALTER TABLE case_vignettes
  ADD COLUMN IF NOT EXISTS cacrep_core_areas text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS blueprint_version text;

CREATE TABLE IF NOT EXISTS cacrep_core_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text NOT NULL UNIQUE,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blueprint_objective_cacrep_mappings (
  objective_id uuid NOT NULL REFERENCES blueprint_objectives(id) ON DELETE CASCADE,
  cacrep_core_area_id uuid NOT NULL REFERENCES cacrep_core_areas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (objective_id, cacrep_core_area_id)
);

ALTER TABLE cacrep_core_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE blueprint_objective_cacrep_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read CACREP core areas" ON cacrep_core_areas;
CREATE POLICY "Users can read CACREP core areas"
  ON cacrep_core_areas FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage CACREP core areas" ON cacrep_core_areas;
CREATE POLICY "Admins can manage CACREP core areas"
  ON cacrep_core_areas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP POLICY IF EXISTS "Users can read blueprint objective CACREP mappings" ON blueprint_objective_cacrep_mappings;
CREATE POLICY "Users can read blueprint objective CACREP mappings"
  ON blueprint_objective_cacrep_mappings FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage blueprint objective CACREP mappings" ON blueprint_objective_cacrep_mappings;
CREATE POLICY "Admins can manage blueprint objective CACREP mappings"
  ON blueprint_objective_cacrep_mappings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

WITH source(code, title, display_order) AS (
  VALUES
    ('CACREP1', 'Professional counseling orientation and ethical practice', 1),
    ('CACREP2', 'Social and cultural diversity', 2),
    ('CACREP3', 'Human growth and development', 3),
    ('CACREP4', 'Career development', 4),
    ('CACREP5', 'Counseling and helping relationships', 5),
    ('CACREP6', 'Group counseling and group work', 6),
    ('CACREP7', 'Assessment and testing', 7),
    ('CACREP8', 'Research and program evaluation', 8)
)
INSERT INTO cacrep_core_areas (code, title, display_order)
SELECT code, title, display_order
FROM source
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

UPDATE exam_tracks
SET
  official_source_url = COALESCE(NULLIF(official_source_url, ''), 'https://www.nbcc.org/exams/nce'),
  official_exam_description = 'National Counselor Examination (NCE) blueprint for professional counseling practice. The NCE content outline contains six scored domains and aligns examination questions to the eight CACREP common core areas.',
  exam_level = COALESCE(NULLIF(exam_level, ''), 'national_counselor'),
  updated_at = now()
WHERE slug = 'nce';

WITH nce_domains(code, title, description, weight_percent, scored_item_count, display_order) AS (
  VALUES
    ('D1', 'Professional Practice and Ethics', 'This section encompasses counselors’ knowledge, skills, and abilities related to maintaining proper administrative and clinical protocols.', 12.00, 19, 1),
    ('D2', 'Intake, Assessment, and Diagnosis', 'This section encompasses counselors’ knowledge, skills, and abilities to effectively conduct client intake, assessment, and diagnosis.', 12.00, 19, 2),
    ('D3', 'Areas of Clinical Focus', 'This section encompasses counselors’ knowledge and skills related to areas of clients’ concern(s).', 29.00, 47, 3),
    ('D4', 'Treatment Planning', 'This section encompasses counselors’ knowledge, skills, and abilities to develop an effective course of treatment.', 9.00, 14, 4),
    ('D5', 'Counseling Skills and Interventions', 'This section encompasses counselors’ knowledge, skills, and abilities to conduct effective counseling.', 30.00, 48, 5),
    ('D6', 'Core Counseling Attributes', 'This section encompasses behaviors, traits, and dispositions of effective counselors.', 8.00, 13, 6)
)
INSERT INTO blueprint_domains (
  exam_track_id,
  code,
  title,
  description,
  official_blueprint_text,
  weight_percent,
  scored_item_count,
  display_order,
  active,
  is_placeholder
)
SELECT
  tracks.id,
  source.code,
  source.title,
  source.description,
  source.description || ' Weight: ' || source.weight_percent || '%. Scored items: ' || source.scored_item_count || '.',
  source.weight_percent,
  source.scored_item_count,
  source.display_order,
  true,
  false
FROM nce_domains source
JOIN exam_tracks tracks ON tracks.slug = 'nce'
ON CONFLICT (exam_track_id, title) DO UPDATE SET
  code = EXCLUDED.code,
  description = EXCLUDED.description,
  official_blueprint_text = EXCLUDED.official_blueprint_text,
  weight_percent = EXCLUDED.weight_percent,
  scored_item_count = EXCLUDED.scored_item_count,
  display_order = EXCLUDED.display_order,
  active = true,
  is_placeholder = false,
  updated_at = now();

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
  domains.id,
  'KST',
  'Knowledge, Skills, and Tasks',
  'Official NCE knowledge, skills, and tasks listed under this domain.',
  domains.official_blueprint_text,
  1,
  true,
  false
FROM blueprint_domains domains
JOIN exam_tracks tracks ON tracks.id = domains.exam_track_id
WHERE tracks.slug = 'nce'
ON CONFLICT (domain_id, title) DO UPDATE SET
  description = EXCLUDED.description,
  official_blueprint_text = EXCLUDED.official_blueprint_text,
  active = true,
  is_placeholder = false,
  updated_at = now();

WITH objective_source(domain_title, objective_code, objective_title, display_order) AS (
  VALUES
    ('Professional Practice and Ethics', 'A', 'Assess your (the counselor) competency to work with a specific client', 1),
    ('Professional Practice and Ethics', 'B', 'Understand statistical concepts and methods in research', 2),
    ('Professional Practice and Ethics', 'C', 'Practice legal and ethical counseling', 3),
    ('Professional Practice and Ethics', 'D', 'Clarify counselor–client roles', 4),
    ('Professional Practice and Ethics', 'E', 'Discuss client’s rights and responsibilities', 5),
    ('Professional Practice and Ethics', 'F', 'Discuss limits of confidentiality', 6),
    ('Professional Practice and Ethics', 'G', 'Explain counselor agency policies', 7),
    ('Professional Practice and Ethics', 'H', 'Review payment, fees, and insurance benefits', 8),
    ('Professional Practice and Ethics', 'I', 'Explain counseling processes, procedures, risks, and benefits', 9),
    ('Professional Practice and Ethics', 'J', 'Explain uses and limits of social media', 10),
    ('Professional Practice and Ethics', 'K', 'Inform clients about the legal aspects of counseling', 11),
    ('Professional Practice and Ethics', 'L', 'Obtain informed consent', 12),
    ('Professional Practice and Ethics', 'M', 'Discuss confidentiality as it applies to electronic communication', 13),
    ('Professional Practice and Ethics', 'N', 'Establish group rules, expectations, and termination criteria', 14),
    ('Professional Practice and Ethics', 'O', 'Assess competency to provide informed consent', 15),
    ('Professional Practice and Ethics', 'P', 'Monitor the therapeutic relationship and build trust as needed', 16),
    ('Professional Practice and Ethics', 'Q', 'Review client records', 17),
    ('Professional Practice and Ethics', 'R', 'Provide adequate accommodations for clients with disabilities', 18),
    ('Professional Practice and Ethics', 'S', 'Provide information to third parties', 19),
    ('Professional Practice and Ethics', 'T', 'Provide referral sources if counseling services are inadequate or inappropriate', 20),
    ('Professional Practice and Ethics', 'U', 'Advocate for professional and client issues', 21),
    ('Professional Practice and Ethics', 'V', 'Seek supervision or consultation', 22),
    ('Professional Practice and Ethics', 'W', 'Create and maintain documentation appropriate for each aspect of the counseling process', 23),
    ('Professional Practice and Ethics', 'X', 'Awareness and practice of self-care', 24),
    ('Intake, Assessment, and Diagnosis', 'A', 'Conduct a biopsychosocial interview', 1),
    ('Intake, Assessment, and Diagnosis', 'B', 'Conduct a diagnostic interview', 2),
    ('Intake, Assessment, and Diagnosis', 'C', 'Conduct cultural formulation interview', 3),
    ('Intake, Assessment, and Diagnosis', 'D', 'Conduct an initial interview', 4),
    ('Intake, Assessment, and Diagnosis', 'E', 'Determine diagnosis', 5),
    ('Intake, Assessment, and Diagnosis', 'F', 'Perform a Mental Status Exam (MSE)', 6),
    ('Intake, Assessment, and Diagnosis', 'G', 'Consider co-occurring diagnoses', 7),
    ('Intake, Assessment, and Diagnosis', 'H', 'Determine level of care needed', 8),
    ('Intake, Assessment, and Diagnosis', 'I', 'Determine the appropriate modality of treatment', 9),
    ('Intake, Assessment, and Diagnosis', 'J', 'Assess the presenting problem and level of distress', 10),
    ('Intake, Assessment, and Diagnosis', 'K', 'Evaluate an individual’s level of mental health functioning', 11),
    ('Intake, Assessment, and Diagnosis', 'L', 'Screen clients for appropriate services', 12),
    ('Intake, Assessment, and Diagnosis', 'M', 'Select, use, and interpret appropriate assessment instruments', 13),
    ('Intake, Assessment, and Diagnosis', 'N', 'Use formal and informal observations', 14),
    ('Intake, Assessment, and Diagnosis', 'O', 'Assess for trauma', 15),
    ('Intake, Assessment, and Diagnosis', 'P', 'Assess substance use', 16),
    ('Intake, Assessment, and Diagnosis', 'Q', 'Obtain client self-reports', 17),
    ('Intake, Assessment, and Diagnosis', 'R', 'Evaluate interactional dynamics', 18),
    ('Intake, Assessment, and Diagnosis', 'S', 'Conduct ongoing assessment for at-risk behaviors (i.e., suicide, homicide, self/other injury, and relationship violence)', 19),
    ('Intake, Assessment, and Diagnosis', 'T', 'Use pre-test and post-test measures to assess outcomes', 20),
    ('Intake, Assessment, and Diagnosis', 'U', 'Evaluate counseling effectiveness', 21),
    ('Areas of Clinical Focus', 'A', 'Adjustment related to physical loss/injury/medical condition', 1),
    ('Areas of Clinical Focus', 'B', 'Aging/geriatric concerns', 2),
    ('Areas of Clinical Focus', 'C', 'Behavioral problems', 3),
    ('Areas of Clinical Focus', 'D', 'Bullying', 4),
    ('Areas of Clinical Focus', 'E', 'Caregiving concerns', 5),
    ('Areas of Clinical Focus', 'F', 'Cultural adjustments', 6),
    ('Areas of Clinical Focus', 'G', 'End-of-life issues', 7),
    ('Areas of Clinical Focus', 'H', 'Fear and panic', 8),
    ('Areas of Clinical Focus', 'I', 'Financial issues', 9),
    ('Areas of Clinical Focus', 'J', 'Gender identity development', 10),
    ('Areas of Clinical Focus', 'K', 'Grief/loss', 11),
    ('Areas of Clinical Focus', 'L', 'Hopelessness/depression', 12),
    ('Areas of Clinical Focus', 'M', 'Loneliness/attachment', 13),
    ('Areas of Clinical Focus', 'N', 'Hyper/hypo mental focus', 14),
    ('Areas of Clinical Focus', 'O', 'Intellectual functioning issues', 15),
    ('Areas of Clinical Focus', 'P', 'Insomnia/sleep issues', 16),
    ('Areas of Clinical Focus', 'Q', 'Maladaptive eating behaviors', 17),
    ('Areas of Clinical Focus', 'R', 'Remarriage/recommitment', 18),
    ('Areas of Clinical Focus', 'S', 'Developmental processes/tasks/issues', 19),
    ('Areas of Clinical Focus', 'T', 'Obsessive thoughts/behaviors', 20),
    ('Areas of Clinical Focus', 'U', 'Occupation and career development', 21),
    ('Areas of Clinical Focus', 'V', 'Physical issues related to anxiety', 22),
    ('Areas of Clinical Focus', 'W', 'Physical issues related to depression', 23),
    ('Areas of Clinical Focus', 'X', 'Physical/emotional issues related to trauma', 24),
    ('Areas of Clinical Focus', 'Y', 'Process addictions (pornography, gambling)', 25),
    ('Areas of Clinical Focus', 'Z', 'Racism/discrimination/oppression', 26),
    ('Areas of Clinical Focus', 'AA', 'Religious values conflict', 27),
    ('Areas of Clinical Focus', 'AB', 'Retirement concerns', 28),
    ('Areas of Clinical Focus', 'AC', 'Ruminating and/or intrusive thoughts', 29),
    ('Areas of Clinical Focus', 'AD', 'Separation from primary care givers', 30),
    ('Areas of Clinical Focus', 'AE', 'Sexual functioning concerns', 31),
    ('Areas of Clinical Focus', 'AF', 'Sleeping habits', 32),
    ('Areas of Clinical Focus', 'AG', 'Spiritual/existential concerns', 33),
    ('Areas of Clinical Focus', 'AH', 'Stress management', 34),
    ('Areas of Clinical Focus', 'AI', 'Substance use/addiction issues', 35),
    ('Areas of Clinical Focus', 'AJ', 'Suicidal thoughts/behaviors', 36),
    ('Areas of Clinical Focus', 'AK', 'Terminal illness issues', 37),
    ('Areas of Clinical Focus', 'AL', 'Visual/auditory hallucinations', 38),
    ('Areas of Clinical Focus', 'AM', 'Worry and anxiety', 39),
    ('Areas of Clinical Focus', 'AN', 'Adoption issues', 40),
    ('Areas of Clinical Focus', 'AO', 'Blended family issues', 41),
    ('Areas of Clinical Focus', 'AP', 'Child abuse-related concerns', 42),
    ('Areas of Clinical Focus', 'AQ', 'Child development issues', 43),
    ('Areas of Clinical Focus', 'AR', 'Dating/relationship problems', 44),
    ('Areas of Clinical Focus', 'AS', 'Divorce', 45),
    ('Areas of Clinical Focus', 'AT', 'Family abuse/violence (e.g., physical, sexual, emotional)', 46),
    ('Areas of Clinical Focus', 'AU', 'Interpersonal partner violence concerns', 47),
    ('Areas of Clinical Focus', 'AV', 'Marital/partner communication problems', 48),
    ('Areas of Clinical Focus', 'AW', 'Parenting/co-parenting conflicts', 49),
    ('Areas of Clinical Focus', 'AX', 'Emotional dysregulation', 50),
    ('Treatment Planning', 'A', 'Collaborate with client to establish treatment goals and objectives', 1),
    ('Treatment Planning', 'B', 'Establish short- and long-term counseling goals consistent with clients’ diagnoses', 2),
    ('Treatment Planning', 'C', 'Identify barriers affecting client goal attainment', 3),
    ('Treatment Planning', 'D', 'Identify strengths that improve the likelihood of goal attainment', 4),
    ('Treatment Planning', 'E', 'Refer to different levels of treatment (e.g., outpatient, inpatient, residential, etc.)', 5),
    ('Treatment Planning', 'F', 'Refer to others for concurrent treatment', 6),
    ('Treatment Planning', 'G', 'Guide treatment planning', 7),
    ('Treatment Planning', 'H', 'Discuss termination process and issues', 8),
    ('Treatment Planning', 'I', 'Discuss transitions in group membership', 9),
    ('Treatment Planning', 'J', 'Follow-up after discharge', 10),
    ('Treatment Planning', 'K', 'Use assessment instrument results to facilitate client decision making', 11),
    ('Treatment Planning', 'L', 'Review and revise the treatment plan', 12),
    ('Treatment Planning', 'M', 'Engage clients in review of progress toward treatment goals', 13),
    ('Treatment Planning', 'N', 'Collaborate with other providers and client support systems (documentation and report writing)', 14),
    ('Treatment Planning', 'O', 'Discuss with clients the integration and maintenance of therapeutic progress', 15),
    ('Treatment Planning', 'P', 'Educate client to the value of treatment plan compliance', 16),
    ('Counseling Skills and Interventions', 'A', 'Align intervention with client’s developmental level', 1),
    ('Counseling Skills and Interventions', 'B', 'Align intervention with counseling modality (individual, couple, family, or group)', 2),
    ('Counseling Skills and Interventions', 'C', 'Align intervention with client population (e.g., veterans, minorities, disenfranchised, disabled)', 3),
    ('Counseling Skills and Interventions', 'D', 'Implement individual counseling in relation to a plan of treatment', 4),
    ('Counseling Skills and Interventions', 'E', 'Establish therapeutic alliance', 5),
    ('Counseling Skills and Interventions', 'F', 'Apply theory-based counseling intervention(s)', 6),
    ('Counseling Skills and Interventions', 'G', 'Address addiction issues', 7),
    ('Counseling Skills and Interventions', 'H', 'Address cultural considerations', 8),
    ('Counseling Skills and Interventions', 'I', 'Address family composition and cultural considerations', 9),
    ('Counseling Skills and Interventions', 'J', 'Evaluate and explain systemic patterns of interaction', 10),
    ('Counseling Skills and Interventions', 'K', 'Explore family member interaction', 11),
    ('Counseling Skills and Interventions', 'L', 'Explore religious and spiritual values', 12),
    ('Counseling Skills and Interventions', 'M', 'Guide clients in the development of skills or strategies for dealing with their problems', 13),
    ('Counseling Skills and Interventions', 'N', 'Help clients develop support systems', 14),
    ('Counseling Skills and Interventions', 'O', 'Help facilitate clients’ motivation to make the changes they desire', 15),
    ('Counseling Skills and Interventions', 'P', 'Improve interactional patterns', 16),
    ('Counseling Skills and Interventions', 'Q', 'Provide crisis intervention', 17),
    ('Counseling Skills and Interventions', 'R', 'Educate client about transference and defense mechanisms', 18),
    ('Counseling Skills and Interventions', 'S', 'Facilitate trust and safety', 19),
    ('Counseling Skills and Interventions', 'T', 'Build communication skills', 20),
    ('Counseling Skills and Interventions', 'U', 'Develop conflict resolution strategies', 21),
    ('Counseling Skills and Interventions', 'V', 'Develop safety plans', 22),
    ('Counseling Skills and Interventions', 'W', 'Facilitate systemic change', 23),
    ('Counseling Skills and Interventions', 'X', 'Provide distance counseling or telemental health', 24),
    ('Counseling Skills and Interventions', 'Y', 'Provide education resources (e.g., stress management, assertiveness training, divorce adjustment)', 25),
    ('Counseling Skills and Interventions', 'Z', 'Provide psychoeducation for client', 26),
    ('Counseling Skills and Interventions', 'AA', 'Summarize', 27),
    ('Counseling Skills and Interventions', 'AB', 'Reframe/redirect', 28),
    ('Counseling Skills and Interventions', 'AC', 'Facilitate empathic responses', 29),
    ('Counseling Skills and Interventions', 'AD', 'Use self-disclosure', 30),
    ('Counseling Skills and Interventions', 'AE', 'Use constructive confrontation', 31),
    ('Counseling Skills and Interventions', 'AF', 'Facilitate awareness of here-and-now interactions', 32),
    ('Counseling Skills and Interventions', 'AG', 'Facilitate resolution of interpersonal conflict', 33),
    ('Counseling Skills and Interventions', 'AH', 'Use linking and blocking in a group context', 34),
    ('Counseling Skills and Interventions', 'AI', 'Management of leader–member dynamics', 35),
    ('Counseling Skills and Interventions', 'AJ', 'Model giving and receiving of feedback', 36),
    ('Counseling Skills and Interventions', 'AK', 'Address impact of extended families', 37),
    ('Counseling Skills and Interventions', 'AL', 'Contain and manage intense feelings', 38),
    ('Counseling Skills and Interventions', 'AM', 'Explore the influence of family of origin patterns and themes', 39),
    ('Counseling Skills and Interventions', 'AN', 'Address the impact of social support network', 40),
    ('Counseling Skills and Interventions', 'AO', 'Use “structured” activities', 41),
    ('Counseling Skills and Interventions', 'AP', 'Promote and encourage interactions among group members', 42),
    ('Counseling Skills and Interventions', 'AQ', 'Promote and encourage interactions with the group leader', 43),
    ('Counseling Skills and Interventions', 'AR', 'Use psychoeducation as a part of the group process', 44),
    ('Counseling Skills and Interventions', 'AS', 'Explain phases in the group process', 45),
    ('Counseling Skills and Interventions', 'AT', 'Identify and discuss group themes and patterns', 46),
    ('Counseling Skills and Interventions', 'AU', 'Create intervention based on the stage of group development', 47),
    ('Counseling Skills and Interventions', 'AV', 'Challenge harmful group member behaviors', 48),
    ('Counseling Skills and Interventions', 'AW', 'Address the potential interaction of members outside of the group', 49),
    ('Core Counseling Attributes', 'A', 'Awareness of self and impact on clients', 1),
    ('Core Counseling Attributes', 'B', 'Genuineness', 2),
    ('Core Counseling Attributes', 'C', 'Congruence', 3),
    ('Core Counseling Attributes', 'D', 'Demonstrate knowledge of and sensitivity to gender orientation and gender issues', 4),
    ('Core Counseling Attributes', 'E', 'Demonstrate knowledge of and sensitivity to multicultural issues', 5),
    ('Core Counseling Attributes', 'F', 'Demonstrate conflict tolerance and resolution', 6),
    ('Core Counseling Attributes', 'G', 'Empathic attunement', 7),
    ('Core Counseling Attributes', 'H', 'Empathic responding', 8),
    ('Core Counseling Attributes', 'I', 'Foster the emergence of group therapeutic factors', 9),
    ('Core Counseling Attributes', 'J', 'Non-judgmental stance', 10),
    ('Core Counseling Attributes', 'K', 'Positive regard', 11),
    ('Core Counseling Attributes', 'L', 'Respect and acceptance for diversity', 12),
    ('Core Counseling Attributes', 'M', 'Use foundational listening, attending, and reflecting skills', 13)
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
  competencies.id,
  domains.code || objective_source.objective_code,
  objective_source.objective_title,
  objective_source.objective_title,
  domains.title || ' > ' || objective_source.objective_title,
  'Generate NCE items that measure applied counseling competence for: ' || objective_source.objective_title,
  objective_source.display_order,
  true,
  false
FROM objective_source
JOIN blueprint_domains domains ON domains.title = objective_source.domain_title
JOIN exam_tracks tracks ON tracks.id = domains.exam_track_id AND tracks.slug = 'nce'
JOIN blueprint_competencies competencies ON competencies.domain_id = domains.id AND competencies.title = 'Knowledge, Skills, and Tasks'
ON CONFLICT (competency_id, title) DO UPDATE SET
  code = EXCLUDED.code,
  description = EXCLUDED.description,
  official_blueprint_text = EXCLUDED.official_blueprint_text,
  learning_objective = EXCLUDED.learning_objective,
  display_order = EXCLUDED.display_order,
  active = true,
  is_placeholder = false,
  updated_at = now();

INSERT INTO blueprint_objective_cacrep_mappings (objective_id, cacrep_core_area_id)
SELECT objectives.id, core.id
FROM blueprint_objectives objectives
JOIN blueprint_competencies competencies ON competencies.id = objectives.competency_id
JOIN blueprint_domains domains ON domains.id = competencies.domain_id
JOIN exam_tracks tracks ON tracks.id = domains.exam_track_id AND tracks.slug = 'nce'
JOIN cacrep_core_areas core ON core.title = CASE
  WHEN domains.title = 'Professional Practice and Ethics' AND objectives.title ILIKE '%research%' THEN 'Research and program evaluation'
  WHEN domains.title = 'Professional Practice and Ethics' THEN 'Professional counseling orientation and ethical practice'
  WHEN domains.title = 'Intake, Assessment, and Diagnosis' THEN 'Assessment and testing'
  WHEN domains.title = 'Treatment Planning' THEN 'Counseling and helping relationships'
  WHEN domains.title = 'Counseling Skills and Interventions' AND objectives.title ILIKE '%group%' THEN 'Group counseling and group work'
  WHEN domains.title = 'Counseling Skills and Interventions' THEN 'Counseling and helping relationships'
  WHEN domains.title = 'Core Counseling Attributes' AND objectives.title ILIKE '%multicultural%' THEN 'Social and cultural diversity'
  WHEN domains.title = 'Core Counseling Attributes' THEN 'Counseling and helping relationships'
  WHEN domains.title = 'Areas of Clinical Focus' AND objectives.title ILIKE '%career%' THEN 'Career development'
  WHEN domains.title = 'Areas of Clinical Focus' AND (objectives.title ILIKE '%cultural%' OR objectives.title ILIKE '%racism%' OR objectives.title ILIKE '%oppression%' OR objectives.title ILIKE '%gender%') THEN 'Social and cultural diversity'
  ELSE 'Human growth and development'
END
ON CONFLICT DO NOTHING;

INSERT INTO topics (
  exam_id,
  exam_track_id,
  title,
  description,
  official_blueprint_text,
  official_weight_percent,
  blueprint_domain_id,
  display_order
)
SELECT
  exams.id,
  tracks.id,
  domains.title,
  domains.description,
  domains.official_blueprint_text,
  domains.weight_percent,
  domains.id,
  domains.display_order
FROM blueprint_domains domains
JOIN exam_tracks tracks ON tracks.id = domains.exam_track_id AND tracks.slug = 'nce'
LEFT JOIN exams ON exams.slug = 'nce'
WHERE NOT EXISTS (
  SELECT 1 FROM topics existing
  WHERE existing.exam_track_id = tracks.id
    AND existing.title = domains.title
);

UPDATE topics
SET
  description = domains.description,
  official_blueprint_text = domains.official_blueprint_text,
  official_weight_percent = domains.weight_percent,
  blueprint_domain_id = domains.id,
  display_order = domains.display_order
FROM blueprint_domains domains
JOIN exam_tracks tracks ON tracks.id = domains.exam_track_id AND tracks.slug = 'nce'
WHERE topics.exam_track_id = tracks.id
  AND topics.title = domains.title;

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
  objectives.title,
  objectives.description,
  objectives.learning_objective,
  objectives.official_blueprint_text,
  competencies.id,
  objectives.id,
  objectives.display_order
FROM blueprint_objectives objectives
JOIN blueprint_competencies competencies ON competencies.id = objectives.competency_id
JOIN blueprint_domains domains ON domains.id = competencies.domain_id
JOIN exam_tracks tracks ON tracks.id = domains.exam_track_id AND tracks.slug = 'nce'
JOIN topics ON topics.exam_track_id = tracks.id AND topics.blueprint_domain_id = domains.id
WHERE NOT EXISTS (
  SELECT 1 FROM subtopics existing
  WHERE existing.topic_id = topics.id
    AND existing.blueprint_objective_id = objectives.id
);

WITH guideline_source AS (
  SELECT
    tracks.id AS exam_track_id,
    levels.cognitive_level,
    'NCE style: use the stored NCE domain, knowledge/skill/task objective, learning objective, CACREP mapping, domain weight, and official NCE question style. Generate applied counseling-practice questions requiring clinical reasoning, professional judgment, assessment, treatment planning, ethics, intervention selection, or decision-making. Avoid simple memorization, definition recall, trivia, or recognition-only stems.' AS question_style_guideline,
    ARRAY['four-option multiple choice', 'case vignette', 'application scenario', 'best next step', 'ethical judgment', 'assessment decision', 'treatment planning', 'counseling intervention']::text[] AS allowed_question_types,
    ARRAY['easy recall for generated items', 'definition only', 'trivia', 'recognition only', 'all of the above', 'none of the above', 'A and B', 'trick question', 'outside professional counseling scope']::text[] AS prohibited_question_types,
    jsonb_build_object(
      'easy_allowed', false,
      'medium', 'Requires applying the official NCE blueprint objective to a counseling-practice scenario.',
      'hard', 'Requires clinical reasoning, prioritization, assessment judgment, treatment planning, ethics, or intervention decision-making.',
      'one_correct_answer_only', true,
      'answer_options', 4,
      'randomize_correct_option', true
    ) AS difficulty_rules
  FROM exam_tracks tracks
  CROSS JOIN (VALUES ('application'), ('reasoning'), ('clinical judgment'), ('ethics'), ('assessment'), ('treatment planning')) AS levels(cognitive_level)
  WHERE tracks.slug = 'nce'
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
ON CONFLICT (exam_track_id, cognitive_level) DO UPDATE SET
  question_style_guideline = EXCLUDED.question_style_guideline,
  allowed_question_types = EXCLUDED.allowed_question_types,
  prohibited_question_types = EXCLUDED.prohibited_question_types,
  difficulty_rules = EXCLUDED.difficulty_rules;

CREATE OR REPLACE VIEW nce_blueprint_coverage AS
SELECT
  domains.id AS domain_id,
  domains.title AS domain,
  domains.weight_percent,
  domains.scored_item_count,
  objectives.id AS objective_id,
  objectives.title AS objective,
  COUNT(questions.id) AS generated_questions,
  COUNT(questions.id) FILTER (WHERE questions.reviewed = true) AS approved_questions,
  COUNT(questions.id) FILTER (WHERE questions.active = true AND questions.reviewed = true AND questions.integrity_status = 'passed') AS published_questions,
  ROUND(
    COALESCE(
      (COUNT(questions.id) FILTER (WHERE questions.integrity_status = 'passed')::numeric / NULLIF(COUNT(questions.id), 0)) * 100,
      0
    ),
    2
  ) AS integrity_pass_rate
FROM blueprint_domains domains
JOIN exam_tracks tracks ON tracks.id = domains.exam_track_id AND tracks.slug = 'nce'
JOIN blueprint_competencies competencies ON competencies.domain_id = domains.id
JOIN blueprint_objectives objectives ON objectives.competency_id = competencies.id
LEFT JOIN questions ON questions.blueprint_objective_id = objectives.id
GROUP BY domains.id, domains.title, domains.weight_percent, domains.scored_item_count, objectives.id, objectives.title;
