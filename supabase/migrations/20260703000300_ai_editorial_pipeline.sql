-- AI Editorial Pipeline schema for staged GPT review, rewrite, committee review, and publication approval.

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS psychometric_score numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bias_score numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS security_score numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS distractor_score numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rationale_score numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_blueprint_score numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_difficulty_score numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_distractor_score numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_psychometric_score numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_bias_score numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_security_score numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_integrity_score numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_review_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS final_review_notes text,
  ADD COLUMN IF NOT EXISTS committee_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS committee_average_score numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS committee_review_notes text,
  ADD COLUMN IF NOT EXISTS committee_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_reasons jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rewrite_recommendations jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS editorial_review jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS admin_override boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_override_reason text,
  ADD COLUMN IF NOT EXISTS admin_override_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_override_at timestamptz;

ALTER TABLE questions
  DROP CONSTRAINT IF EXISTS questions_integrity_status_check;

ALTER TABLE questions
  ADD CONSTRAINT questions_integrity_status_check
  CHECK (integrity_status IN ('pending', 'passed', 'needs_review', 'needs_improvement', 'needs_human_review', 'needs_metadata', 'failed', 'rejected'));

ALTER TABLE questions
  DROP CONSTRAINT IF EXISTS questions_final_review_status_check;

ALTER TABLE questions
  ADD CONSTRAINT questions_final_review_status_check
  CHECK (final_review_status IN ('pending', 'passed', 'needs_improvement', 'needs_human_review', 'needs_metadata', 'rejected'));

ALTER TABLE questions
  DROP CONSTRAINT IF EXISTS questions_committee_status_check;

ALTER TABLE questions
  ADD CONSTRAINT questions_committee_status_check
  CHECK (committee_status IN ('pending', 'approved', 'needs_revision', 'rejected'));

CREATE TABLE IF NOT EXISTS question_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  revision_number integer NOT NULL,
  revision_type text NOT NULL,
  previous_question jsonb NOT NULL DEFAULT '{}'::jsonb,
  revised_question jsonb NOT NULL DEFAULT '{}'::jsonb,
  failure_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  improvement_notes text,
  model_used text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (question_id, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_question_revisions_question_id
  ON question_revisions(question_id, revision_number);

ALTER TABLE question_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage question revisions" ON question_revisions;
CREATE POLICY "Admins can manage question revisions"
  ON question_revisions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

CREATE TABLE IF NOT EXISTS question_committee_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  reviewer_role text NOT NULL,
  model_used text,
  vote text NOT NULL CHECK (vote IN ('approve', 'revise', 'reject')),
  score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  reason text NOT NULL DEFAULT '',
  required_changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_question_committee_reviews_question_id
  ON question_committee_reviews(question_id, created_at);

ALTER TABLE question_committee_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage question committee reviews" ON question_committee_reviews;
CREATE POLICY "Admins can manage question committee reviews"
  ON question_committee_reviews FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

UPDATE questions
SET
  admin_override = COALESCE(admin_override, integrity_override),
  admin_override_reason = COALESCE(admin_override_reason, integrity_override_reason),
  admin_override_by = COALESCE(admin_override_by, integrity_override_by),
  admin_override_at = COALESCE(admin_override_at, integrity_override_at),
  committee_status = COALESCE(committee_status, 'pending'),
  failure_reasons = COALESCE(failure_reasons, '[]'::jsonb),
  rewrite_recommendations = COALESCE(rewrite_recommendations, '[]'::jsonb),
  editorial_review = COALESCE(editorial_review, '{}'::jsonb);
