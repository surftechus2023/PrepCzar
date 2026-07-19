ALTER TABLE flashcards
  ADD COLUMN IF NOT EXISTS integrity_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS integrity_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blueprint_alignment_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS difficulty_quality_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS content_quality_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bias_score integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS ai_review_notes text,
  ADD COLUMN IF NOT EXISTS quality_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reviewed_by_ai boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_review_model text,
  ADD COLUMN IF NOT EXISTS ai_reviewed_at timestamptz;

ALTER TABLE case_vignettes
  ADD COLUMN IF NOT EXISTS integrity_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS integrity_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blueprint_alignment_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS difficulty_quality_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS content_quality_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bias_score integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS ai_review_notes text,
  ADD COLUMN IF NOT EXISTS quality_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reviewed_by_ai boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_review_model text,
  ADD COLUMN IF NOT EXISTS ai_reviewed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'flashcards_integrity_status_check'
  ) THEN
    ALTER TABLE flashcards
      ADD CONSTRAINT flashcards_integrity_status_check
      CHECK (integrity_status IN ('pending', 'passed', 'needs_improvement', 'needs_human_review', 'needs_metadata', 'failed', 'rejected'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'case_vignettes_integrity_status_check'
  ) THEN
    ALTER TABLE case_vignettes
      ADD CONSTRAINT case_vignettes_integrity_status_check
      CHECK (integrity_status IN ('pending', 'passed', 'needs_improvement', 'needs_human_review', 'needs_metadata', 'failed', 'rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_flashcards_integrity_review
  ON flashcards(exam_track_id, reviewed, active, integrity_status);

CREATE INDEX IF NOT EXISTS idx_case_vignettes_integrity_review
  ON case_vignettes(exam_track_id, reviewed, active, integrity_status);
