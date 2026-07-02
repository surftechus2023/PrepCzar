-- Automated pre-review integrity checks for generated MCQ content.

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS integrity_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS integrity_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quality_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS bias_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS distractor_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS blueprint_alignment_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cognitive_level_detected text,
  ADD COLUMN IF NOT EXISTS predicted_difficulty text,
  ADD COLUMN IF NOT EXISTS plagiarism_risk_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS integrity_review_notes text,
  ADD COLUMN IF NOT EXISTS integrity_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS integrity_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS integrity_override_reason text,
  ADD COLUMN IF NOT EXISTS integrity_override_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS integrity_override_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'questions_integrity_status_check'
  ) THEN
    ALTER TABLE questions
      ADD CONSTRAINT questions_integrity_status_check
      CHECK (integrity_status IN ('pending', 'passed', 'needs_review', 'failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'questions_integrity_score_check'
  ) THEN
    ALTER TABLE questions
      ADD CONSTRAINT questions_integrity_score_check
      CHECK (
        integrity_score BETWEEN 0 AND 100
        AND blueprint_alignment_score BETWEEN 0 AND 100
        AND plagiarism_risk_score BETWEEN 0 AND 100
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'questions_predicted_difficulty_check'
  ) THEN
    ALTER TABLE questions
      ADD CONSTRAINT questions_predicted_difficulty_check
      CHECK (predicted_difficulty IS NULL OR predicted_difficulty IN ('easy', 'medium', 'hard'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_questions_integrity_status
  ON questions(integrity_status);

CREATE INDEX IF NOT EXISTS idx_questions_integrity_student_visible
  ON questions(exam_track_id, active, reviewed, integrity_status, integrity_override);

DROP POLICY IF EXISTS "Subscribers can read active reviewed questions" ON questions;
CREATE POLICY "Subscribers can read active reviewed questions"
  ON questions FOR SELECT TO authenticated
  USING (
    active = true
    AND reviewed = true
    AND (integrity_status = 'passed' OR integrity_override = true)
    AND (
      EXISTS (
        SELECT 1 FROM user_exam_access a
        WHERE a.user_id = auth.uid()
          AND a.exam_track_id = questions.exam_track_id
          AND a.active = true
      )
      OR EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid()
          AND u.role = 'admin'
      )
    )
  );
