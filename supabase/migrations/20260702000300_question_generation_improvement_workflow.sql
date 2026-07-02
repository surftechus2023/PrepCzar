-- Stricter generated-question integrity workflow and auto-improvement metadata.

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS difficulty_quality_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS improvement_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_improved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS improvement_notes text;

ALTER TABLE questions
  DROP CONSTRAINT IF EXISTS questions_integrity_status_check;

ALTER TABLE questions
  ADD CONSTRAINT questions_integrity_status_check
  CHECK (integrity_status IN ('pending', 'passed', 'needs_review', 'needs_improvement', 'needs_human_review', 'failed'));

ALTER TABLE questions
  DROP CONSTRAINT IF EXISTS questions_integrity_score_check;

ALTER TABLE questions
  ADD CONSTRAINT questions_integrity_score_check
  CHECK (
    integrity_score BETWEEN 0 AND 100
    AND blueprint_alignment_score BETWEEN 0 AND 100
    AND difficulty_quality_score BETWEEN 0 AND 100
    AND plagiarism_risk_score BETWEEN 0 AND 100
  );

DROP POLICY IF EXISTS "Subscribers can read active reviewed questions" ON questions;
CREATE POLICY "Subscribers can read active reviewed questions"
  ON questions FOR SELECT TO authenticated
  USING (
    active = true
    AND reviewed = true
    AND (
      (
        integrity_status = 'passed'
        AND blueprint_alignment_score >= 90
        AND difficulty_quality_score >= 80
      )
      OR integrity_override = true
    )
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
