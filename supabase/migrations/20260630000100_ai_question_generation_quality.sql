-- AI question generation quality metadata and batch tracking.

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS subtopic text,
  ADD COLUMN IF NOT EXISTS learning_objective text,
  ADD COLUMN IF NOT EXISTS cognitive_level text,
  ADD COLUMN IF NOT EXISTS correct_rationale_en text,
  ADD COLUMN IF NOT EXISTS option_a_rationale_en text,
  ADD COLUMN IF NOT EXISTS option_b_rationale_en text,
  ADD COLUMN IF NOT EXISTS option_c_rationale_en text,
  ADD COLUMN IF NOT EXISTS option_d_rationale_en text,
  ADD COLUMN IF NOT EXISTS test_taking_tip_en text,
  ADD COLUMN IF NOT EXISTS source_topic text,
  ADD COLUMN IF NOT EXISTS duplicate_hash text,
  ADD COLUMN IF NOT EXISTS quality_score integer,
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS generation_batch_id uuid,
  ADD COLUMN IF NOT EXISTS generated_by_ai boolean DEFAULT true;

ALTER TABLE questions
  ALTER COLUMN generated_by_ai SET DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_duplicate_hash
  ON questions(duplicate_hash)
  WHERE duplicate_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_generation_batch_id
  ON questions(generation_batch_id);

CREATE INDEX IF NOT EXISTS idx_questions_student_visible
  ON questions(exam_track_id, active, reviewed);

CREATE TABLE IF NOT EXISTS ai_generation_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  exam_track_id uuid REFERENCES exam_tracks(id) ON DELETE SET NULL,
  topic_id uuid REFERENCES topics(id) ON DELETE SET NULL,
  content_type text NOT NULL,
  quantity_requested integer NOT NULL,
  quantity_generated integer NOT NULL DEFAULT 0,
  quantity_inserted integer NOT NULL DEFAULT 0,
  quantity_rejected integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  model_used text,
  prompt_version text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE questions
  ADD CONSTRAINT questions_generation_batch_id_fkey
  FOREIGN KEY (generation_batch_id)
  REFERENCES ai_generation_batches(id)
  ON DELETE SET NULL
  NOT VALID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_generation_batches_content_type_check'
  ) THEN
    ALTER TABLE ai_generation_batches
      ADD CONSTRAINT ai_generation_batches_content_type_check
      CHECK (content_type IN ('mcq', 'flashcards', 'vignettes'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_generation_batches_status_check'
  ) THEN
    ALTER TABLE ai_generation_batches
      ADD CONSTRAINT ai_generation_batches_status_check
      CHECK (status IN ('pending', 'running', 'completed', 'failed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_generation_batches_admin_user_id
  ON ai_generation_batches(admin_user_id);

CREATE INDEX IF NOT EXISTS idx_ai_generation_batches_exam_track_id
  ON ai_generation_batches(exam_track_id);

CREATE INDEX IF NOT EXISTS idx_ai_generation_batches_status
  ON ai_generation_batches(status);

ALTER TABLE ai_generation_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read ai generation batches" ON ai_generation_batches;
CREATE POLICY "Admins can read ai generation batches"
  ON ai_generation_batches FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can insert ai generation batches" ON ai_generation_batches;
CREATE POLICY "Admins can insert ai generation batches"
  ON ai_generation_batches FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can update ai generation batches" ON ai_generation_batches;
CREATE POLICY "Admins can update ai generation batches"
  ON ai_generation_batches FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
