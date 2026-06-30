
-- ============================================================
-- STEP 1: Drop NOT NULL constraints on exam_id (make nullable)
--         so new rows with only exam_track_id can be inserted
-- ============================================================
ALTER TABLE topics           ALTER COLUMN exam_id DROP NOT NULL;
ALTER TABLE questions        ALTER COLUMN exam_id DROP NOT NULL;
ALTER TABLE flashcards       ALTER COLUMN exam_id DROP NOT NULL;
ALTER TABLE case_vignettes   ALTER COLUMN exam_id DROP NOT NULL;
ALTER TABLE subscriptions    ALTER COLUMN exam_id DROP NOT NULL;
ALTER TABLE practice_sessions ALTER COLUMN exam_id DROP NOT NULL;
ALTER TABLE scores           ALTER COLUMN exam_id DROP NOT NULL;

-- ============================================================
-- STEP 2: EXAM CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS exam_categories (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  slug          text NOT NULL UNIQUE,
  description   text NOT NULL DEFAULT '',
  icon          text NOT NULL DEFAULT '',
  display_order int  NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE exam_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read exam_categories" ON exam_categories;
CREATE POLICY "Anyone can read exam_categories"
  ON exam_categories FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "Public can read exam_categories" ON exam_categories;
CREATE POLICY "Public can read exam_categories"
  ON exam_categories FOR SELECT
  TO anon USING (true);

DROP POLICY IF EXISTS "Admins can manage exam_categories" ON exam_categories;
CREATE POLICY "Admins can manage exam_categories"
  ON exam_categories FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- STEP 3: EXAM TRACKS
-- ============================================================
CREATE TABLE IF NOT EXISTS exam_tracks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id     uuid NOT NULL REFERENCES exam_categories(id) ON DELETE CASCADE,
  name            text NOT NULL,
  slug            text NOT NULL UNIQUE,
  monthly_price   numeric(10,2) NOT NULL,
  description     text NOT NULL DEFAULT '',
  full_name       text NOT NULL DEFAULT '',
  active          boolean NOT NULL DEFAULT true,
  display_order   int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE exam_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active exam_tracks" ON exam_tracks;
CREATE POLICY "Anyone can read active exam_tracks"
  ON exam_tracks FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "Public can read active exam_tracks" ON exam_tracks;
CREATE POLICY "Public can read active exam_tracks"
  ON exam_tracks FOR SELECT
  TO anon USING (active = true);

DROP POLICY IF EXISTS "Admins can manage exam_tracks" ON exam_tracks;
CREATE POLICY "Admins can manage exam_tracks"
  ON exam_tracks FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- STEP 4: SEED CATEGORIES
-- ============================================================
INSERT INTO exam_categories (name, slug, description, icon, display_order) VALUES
  ('Psychology',      'psychology',      'Licensing exams for psychologists',                'Brain',         1),
  ('Social Work',     'social-work',     'Licensing exams for social workers',               'Heart',         2),
  ('Counseling',      'counseling',      'Licensing exams for counselors',                   'MessageCircle', 3),
  ('Case Management', 'case-management', 'Certification exams for case managers',            'ClipboardList', 4),
  ('Nursing',         'nursing',         'Licensing exams for registered and practical nurses','Stethoscope',  5)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- STEP 5: SEED EXAM TRACKS
-- ============================================================
INSERT INTO exam_tracks (category_id, name, slug, monthly_price, description, full_name, display_order)
SELECT c.id, t.name, t.slug, t.monthly_price, t.description, t.full_name, t.display_order
FROM exam_categories c
JOIN (VALUES
  ('psychology',      'EPPP',     'eppp',     75.00, 'Examination for Professional Practice in Psychology', 'Examination for Professional Practice in Psychology', 1),
  ('social-work',     'BSW',      'bsw',      50.00, 'Bachelor of Social Work licensing exam',             'Bachelor of Social Work Exam',                        1),
  ('social-work',     'MSW/LMSW', 'msw-lmsw', 50.00, 'Masters/Licensed Masters Social Work exam',          'Masters/Licensed Masters Social Work Exam',           2),
  ('social-work',     'LCSW',     'lcsw',     50.00, 'Licensed Clinical Social Worker licensing exam',     'Licensed Clinical Social Worker Exam',                3),
  ('counseling',      'NCE',      'nce',      75.00, 'National Counselor Examination',                     'National Counselor Examination',                      1),
  ('case-management', 'CCM',      'ccm',      50.00, 'Certified Case Manager certification exam',          'Certified Case Manager Exam',                         1),
  ('nursing',         'NCLEX-RN', 'nclex-rn', 85.00, 'NCLEX for Registered Nurses',                       'NCLEX for Registered Nurses',                         1),
  ('nursing',         'NCLEX-PN', 'nclex-pn', 85.00, 'NCLEX for Practical Nurses',                        'NCLEX for Practical Nurses',                          2)
) AS t(cat_slug, name, slug, monthly_price, description, full_name, display_order)
ON (c.slug = t.cat_slug)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- STEP 6: ADD exam_track_id COLUMNS
-- ============================================================
ALTER TABLE topics            ADD COLUMN IF NOT EXISTS exam_track_id uuid REFERENCES exam_tracks(id);
ALTER TABLE questions         ADD COLUMN IF NOT EXISTS exam_track_id uuid REFERENCES exam_tracks(id);
ALTER TABLE flashcards        ADD COLUMN IF NOT EXISTS exam_track_id uuid REFERENCES exam_tracks(id);
ALTER TABLE case_vignettes    ADD COLUMN IF NOT EXISTS exam_track_id uuid REFERENCES exam_tracks(id);
ALTER TABLE subscriptions     ADD COLUMN IF NOT EXISTS exam_track_id uuid REFERENCES exam_tracks(id);
ALTER TABLE practice_sessions ADD COLUMN IF NOT EXISTS exam_track_id uuid REFERENCES exam_tracks(id);
ALTER TABLE scores            ADD COLUMN IF NOT EXISTS exam_track_id uuid REFERENCES exam_tracks(id);

-- Add extra columns
ALTER TABLE flashcards     ADD COLUMN IF NOT EXISTS reviewed boolean NOT NULL DEFAULT false;
ALTER TABLE case_vignettes ADD COLUMN IF NOT EXISTS reviewed boolean NOT NULL DEFAULT false;
ALTER TABLE topics         ADD COLUMN IF NOT EXISTS official_weight_percent numeric(5,2);

-- ============================================================
-- STEP 7: MIGRATE EXISTING DATA
-- ============================================================
UPDATE topics t
SET exam_track_id = et.id
FROM exams e, exam_tracks et
WHERE t.exam_id = e.id
  AND (
    (e.slug = 'eppp'         AND et.slug = 'eppp')     OR
    (e.slug = 'social-work'  AND et.slug = 'lcsw')     OR
    (e.slug = 'lcsw'         AND et.slug = 'lcsw')     OR
    (e.slug = 'nce'          AND et.slug = 'nce')      OR
    (e.slug = 'ccm'          AND et.slug = 'ccm')      OR
    (e.slug IN ('nclex','nclex-rn') AND et.slug = 'nclex-rn')
  );

UPDATE questions q
SET exam_track_id = et.id
FROM exams e, exam_tracks et
WHERE q.exam_id = e.id
  AND (
    (e.slug = 'eppp'         AND et.slug = 'eppp')     OR
    (e.slug = 'social-work'  AND et.slug = 'lcsw')     OR
    (e.slug = 'lcsw'         AND et.slug = 'lcsw')     OR
    (e.slug = 'nce'          AND et.slug = 'nce')      OR
    (e.slug = 'ccm'          AND et.slug = 'ccm')      OR
    (e.slug IN ('nclex','nclex-rn') AND et.slug = 'nclex-rn')
  );

UPDATE flashcards f
SET exam_track_id = et.id
FROM exams e, exam_tracks et
WHERE f.exam_id = e.id
  AND (
    (e.slug = 'eppp'         AND et.slug = 'eppp')     OR
    (e.slug = 'social-work'  AND et.slug = 'lcsw')     OR
    (e.slug = 'lcsw'         AND et.slug = 'lcsw')     OR
    (e.slug = 'nce'          AND et.slug = 'nce')      OR
    (e.slug = 'ccm'          AND et.slug = 'ccm')      OR
    (e.slug IN ('nclex','nclex-rn') AND et.slug = 'nclex-rn')
  );

UPDATE case_vignettes cv
SET exam_track_id = et.id
FROM exams e, exam_tracks et
WHERE cv.exam_id = e.id
  AND (
    (e.slug = 'eppp'         AND et.slug = 'eppp')     OR
    (e.slug = 'social-work'  AND et.slug = 'lcsw')     OR
    (e.slug = 'lcsw'         AND et.slug = 'lcsw')     OR
    (e.slug = 'nce'          AND et.slug = 'nce')      OR
    (e.slug = 'ccm'          AND et.slug = 'ccm')      OR
    (e.slug IN ('nclex','nclex-rn') AND et.slug = 'nclex-rn')
  );

UPDATE subscriptions s
SET exam_track_id = et.id
FROM exams e, exam_tracks et
WHERE s.exam_id = e.id
  AND (
    (e.slug = 'eppp'         AND et.slug = 'eppp')     OR
    (e.slug = 'social-work'  AND et.slug = 'lcsw')     OR
    (e.slug = 'lcsw'         AND et.slug = 'lcsw')     OR
    (e.slug = 'nce'          AND et.slug = 'nce')      OR
    (e.slug = 'ccm'          AND et.slug = 'ccm')      OR
    (e.slug IN ('nclex','nclex-rn') AND et.slug = 'nclex-rn')
  );

UPDATE practice_sessions ps
SET exam_track_id = et.id
FROM exams e, exam_tracks et
WHERE ps.exam_id = e.id
  AND (
    (e.slug = 'eppp'         AND et.slug = 'eppp')     OR
    (e.slug = 'social-work'  AND et.slug = 'lcsw')     OR
    (e.slug = 'lcsw'         AND et.slug = 'lcsw')     OR
    (e.slug = 'nce'          AND et.slug = 'nce')      OR
    (e.slug = 'ccm'          AND et.slug = 'ccm')      OR
    (e.slug IN ('nclex','nclex-rn') AND et.slug = 'nclex-rn')
  );

UPDATE scores sc
SET exam_track_id = et.id
FROM exams e, exam_tracks et
WHERE sc.exam_id = e.id
  AND (
    (e.slug = 'eppp'         AND et.slug = 'eppp')     OR
    (e.slug = 'social-work'  AND et.slug = 'lcsw')     OR
    (e.slug = 'lcsw'         AND et.slug = 'lcsw')     OR
    (e.slug = 'nce'          AND et.slug = 'nce')      OR
    (e.slug = 'ccm'          AND et.slug = 'ccm')      OR
    (e.slug IN ('nclex','nclex-rn') AND et.slug = 'nclex-rn')
  );

-- ============================================================
-- STEP 8: UPDATE RLS POLICIES
-- ============================================================

-- TOPICS
DROP POLICY IF EXISTS "Anyone can read topics" ON topics;
DROP POLICY IF EXISTS "Admins can manage topics" ON topics;
DROP POLICY IF EXISTS "Admins can update topics" ON topics;
DROP POLICY IF EXISTS "Admins can delete topics" ON topics;

CREATE POLICY "Anyone can read topics"
  ON topics FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage topics"
  ON topics FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update topics"
  ON topics FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete topics"
  ON topics FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- QUESTIONS
DROP POLICY IF EXISTS "Subscribers can read active reviewed questions" ON questions;
DROP POLICY IF EXISTS "Admins can read all questions" ON questions;
DROP POLICY IF EXISTS "Admins can insert questions" ON questions;
DROP POLICY IF EXISTS "Admins can update questions" ON questions;
DROP POLICY IF EXISTS "Admins can delete questions" ON questions;

CREATE POLICY "Subscribers can read active reviewed questions"
  ON questions FOR SELECT TO authenticated
  USING (
    active = true AND reviewed = true AND (
      EXISTS (
        SELECT 1 FROM subscriptions s
        WHERE s.user_id = auth.uid()
          AND s.exam_track_id = questions.exam_track_id
          AND s.status = 'active'
      )
      OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    )
  );

CREATE POLICY "Admins can read all questions"
  ON questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can insert questions"
  ON questions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update questions"
  ON questions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete questions"
  ON questions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- FLASHCARDS
DROP POLICY IF EXISTS "Subscribers can read active flashcards" ON flashcards;
DROP POLICY IF EXISTS "Admins can read all flashcards" ON flashcards;
DROP POLICY IF EXISTS "Admins can insert flashcards" ON flashcards;
DROP POLICY IF EXISTS "Admins can update flashcards" ON flashcards;
DROP POLICY IF EXISTS "Admins can delete flashcards" ON flashcards;

CREATE POLICY "Subscribers can read active flashcards"
  ON flashcards FOR SELECT TO authenticated
  USING (
    active = true AND (
      EXISTS (
        SELECT 1 FROM subscriptions s
        WHERE s.user_id = auth.uid()
          AND s.exam_track_id = flashcards.exam_track_id
          AND s.status = 'active'
      )
      OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    )
  );

CREATE POLICY "Admins can read all flashcards"
  ON flashcards FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can insert flashcards"
  ON flashcards FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update flashcards"
  ON flashcards FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete flashcards"
  ON flashcards FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- CASE VIGNETTES
DROP POLICY IF EXISTS "Subscribers can read active vignettes" ON case_vignettes;
DROP POLICY IF EXISTS "Admins can read all vignettes" ON case_vignettes;
DROP POLICY IF EXISTS "Admins can insert vignettes" ON case_vignettes;
DROP POLICY IF EXISTS "Admins can update vignettes" ON case_vignettes;
DROP POLICY IF EXISTS "Admins can delete vignettes" ON case_vignettes;

CREATE POLICY "Subscribers can read active vignettes"
  ON case_vignettes FOR SELECT TO authenticated
  USING (
    active = true AND (
      EXISTS (
        SELECT 1 FROM subscriptions s
        WHERE s.user_id = auth.uid()
          AND s.exam_track_id = case_vignettes.exam_track_id
          AND s.status = 'active'
      )
      OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    )
  );

CREATE POLICY "Admins can read all vignettes"
  ON case_vignettes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can insert vignettes"
  ON case_vignettes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update vignettes"
  ON case_vignettes FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete vignettes"
  ON case_vignettes FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- SUBSCRIPTIONS
DROP POLICY IF EXISTS "Users can read own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Admins can read all subscriptions" ON subscriptions;

CREATE POLICY "Users can read own subscriptions"
  ON subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
  ON subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON subscriptions FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all subscriptions"
  ON subscriptions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- PRACTICE_SESSIONS
DROP POLICY IF EXISTS "Users can read own sessions" ON practice_sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON practice_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON practice_sessions;

CREATE POLICY "Users can read own sessions"
  ON practice_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON practice_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON practice_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- SCORES
DROP POLICY IF EXISTS "Users can read own scores" ON scores;
DROP POLICY IF EXISTS "Users can insert own scores" ON scores;
DROP POLICY IF EXISTS "Admins can read all scores" ON scores;

CREATE POLICY "Users can read own scores"
  ON scores FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scores"
  ON scores FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all scores"
  ON scores FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- STEP 9: SEED COMPREHENSIVE TOPICS
-- ============================================================
INSERT INTO topics (exam_track_id, title, description, display_order, official_weight_percent)
SELECT et.id, t.title, t.description, t.display_order, t.weight
FROM exam_tracks et
JOIN (VALUES
  ('eppp', 'Biological Bases of Behavior',         'Neuroscience, psychopharmacology, genetics',           1, 12.0::numeric),
  ('eppp', 'Cognitive-Affective Bases',            'Learning, memory, emotion, motivation',                2, 13.0::numeric),
  ('eppp', 'Social & Cultural Bases',              'Group dynamics, cultural factors, social influence',   3, 12.0::numeric),
  ('eppp', 'Growth & Lifespan Development',        'Developmental psychology across the lifespan',         4, 12.0::numeric),
  ('eppp', 'Assessment & Diagnosis',               'Psychological testing, diagnosis, measurement',        5, 15.0::numeric),
  ('eppp', 'Treatment, Intervention & Prevention', 'Evidence-based therapies, prevention programs',        6, 15.0::numeric),
  ('eppp', 'Research Methods & Statistics',        'Experimental design, statistics, psychometrics',       7, 10.0::numeric),
  ('eppp', 'Ethical/Legal/Professional Practice',  'Ethics code, laws, professional standards',            8, 11.0::numeric),
  ('bsw',  'Human Behavior & Social Environment',  'Systems theory, development, diversity',               1, 20.0::numeric),
  ('bsw',  'Social Work Practice',                 'Generalist practice, engagement, assessment',          2, 25.0::numeric),
  ('bsw',  'Social Policy & Services',             'Policy analysis, advocacy, social welfare',            3, 15.0::numeric),
  ('bsw',  'Research & Statistics',                'Research methods, evidence-based practice',            4, 10.0::numeric),
  ('bsw',  'Professional Values & Ethics',         'NASW Code of Ethics, professional standards',          5, 30.0::numeric),
  ('msw-lmsw', 'Human Development & Behavior',     'Advanced human development, systems theory',           1, 28.0::numeric),
  ('msw-lmsw', 'Assessment & Intervention',        'Biopsychosocial assessment, treatment planning',       2, 24.0::numeric),
  ('msw-lmsw', 'Direct Practice',                  'Individual, family, group therapy techniques',         3, 22.0::numeric),
  ('msw-lmsw', 'Policy, Research & Administration','Policy analysis, program evaluation',                  4, 16.0::numeric),
  ('msw-lmsw', 'Professional Values & Ethics',     'NASW Code of Ethics, supervisory ethics',              5, 10.0::numeric),
  ('lcsw', 'Human Development',                    'Advanced lifespan development, psychopathology',       1, 15.0::numeric),
  ('lcsw', 'Psychopathology & Diagnosis',          'DSM-5-TR diagnoses, differential diagnosis',           2, 20.0::numeric),
  ('lcsw', 'Clinical Assessment',                  'Comprehensive biopsychosocial assessment',             3, 15.0::numeric),
  ('lcsw', 'Psychotherapy & Intervention',         'Evidence-based clinical interventions',                4, 25.0::numeric),
  ('lcsw', 'Case Management & Referral',           'Coordination of care, referral processes',             5, 10.0::numeric),
  ('lcsw', 'Professional Ethics & Law',            'Clinical ethics, mandatory reporting, supervision',    6, 15.0::numeric),
  ('nce',  'Human Development',                    'Theories of human development across lifespan',        1, 12.0::numeric),
  ('nce',  'Counseling Theory',                    'Major counseling theories and applications',           2, 16.0::numeric),
  ('nce',  'Group Work',                           'Group dynamics, leadership, types of groups',          3, 12.0::numeric),
  ('nce',  'Career Development',                   'Career theories, assessment, counseling',              4, 12.0::numeric),
  ('nce',  'Research & Program Evaluation',        'Research methodology, statistics, evaluation',         5, 10.0::numeric),
  ('nce',  'Assessment & Appraisal',               'Psychological testing, interpretation',                6, 14.0::numeric),
  ('nce',  'Social & Cultural Diversity',          'Multicultural counseling, cultural competence',        7, 12.0::numeric),
  ('nce',  'Professional Orientation & Ethics',    'ACA Code of Ethics, professional issues',              8, 12.0::numeric),
  ('ccm',  'Care Delivery & Reimbursement',        'Healthcare systems, insurance, reimbursement',         1, 18.0::numeric),
  ('ccm',  'Psychosocial Concepts & Support',      'Mental health, coping, social support',                2, 16.0::numeric),
  ('ccm',  'Quality & Outcomes Evaluation',        'Quality improvement, outcomes measurement',            3, 15.0::numeric),
  ('ccm',  'Rehabilitation Concepts',              'Disability, rehabilitation, return to work',           4, 13.0::numeric),
  ('ccm',  'Case Management Concepts',             'CM process, roles, standards of practice',             5, 20.0::numeric),
  ('ccm',  'Ethical, Legal & Practice Standards',  'Ethics, CCMC standards, professional practice',        6, 18.0::numeric),
  ('nclex-rn', 'Safe and Effective Care Environment', 'Management, safety, infection control',             1, 21.0::numeric),
  ('nclex-rn', 'Health Promotion & Maintenance',      'Prevention, growth & development, screening',       2,  9.0::numeric),
  ('nclex-rn', 'Psychosocial Integrity',               'Mental health, coping, therapeutic communication', 3,  9.0::numeric),
  ('nclex-rn', 'Physiological Integrity',              'Basic care, pharmacology, reduction of risk',       4, 61.0::numeric),
  ('nclex-pn', 'Safe and Effective Care Environment',  'Coordination, safety, infection control',           1, 18.0::numeric),
  ('nclex-pn', 'Health Promotion & Maintenance',       'Prevention, family planning, developmental stages', 2,  8.0::numeric),
  ('nclex-pn', 'Psychosocial Integrity',               'Emotional support, mental health, abuse',           3,  9.0::numeric),
  ('nclex-pn', 'Physiological Integrity',              'Basic nursing care, pharmacology, clinical skills',  4, 65.0::numeric)
) AS t(track_slug, title, description, display_order, weight)
ON (et.slug = t.track_slug)
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 10: ENSURE ALL USERS HAVE ACTIVE SUBSCRIPTIONS TO ALL TRACKS
-- ============================================================
INSERT INTO subscriptions (user_id, exam_track_id, status, started_at)
SELECT DISTINCT u.id, et.id, 'active', now()
FROM users u
CROSS JOIN exam_tracks et
WHERE NOT EXISTS (
  SELECT 1 FROM subscriptions s2
  WHERE s2.user_id = u.id AND s2.exam_track_id = et.id
);
