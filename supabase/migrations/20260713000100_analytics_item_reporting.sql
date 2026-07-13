CREATE TABLE IF NOT EXISTS item_analysis_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  exam_track_id uuid REFERENCES exam_tracks(id) ON DELETE SET NULL,
  attempts integer NOT NULL DEFAULT 0,
  percent_correct numeric(5,2),
  average_response_time_ms integer,
  distractor_selection_frequency jsonb NOT NULL DEFAULT '{}'::jsonb,
  item_difficulty_estimate numeric(5,2),
  item_discrimination_estimate numeric(5,2),
  reliability_note text NOT NULL DEFAULT 'Insufficient response data for reliable item statistics.',
  sample_size_sufficient boolean NOT NULL DEFAULT false,
  calculated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_item_analysis_snapshots_question
  ON item_analysis_snapshots(question_id, calculated_at DESC);

CREATE TABLE IF NOT EXISTS fairness_analysis_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_track_id uuid REFERENCES exam_tracks(id) ON DELETE SET NULL,
  analysis_scope text NOT NULL DEFAULT 'DIF foundation',
  aggregation_rules jsonb NOT NULL DEFAULT jsonb_build_object(
    'sensitive_demographics_inferred', false,
    'requires_voluntary_lawful_collection', true,
    'requires_sufficient_aggregation', true,
    'requires_privacy_protection', true,
    'ai_bias_review_is_not_formal_psychometric_validation', true
  ),
  notes text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE item_analysis_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE fairness_analysis_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read item analysis snapshots" ON item_analysis_snapshots;
CREATE POLICY "Admins can read item analysis snapshots"
  ON item_analysis_snapshots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage fairness analysis audits" ON fairness_analysis_audits;
CREATE POLICY "Admins can manage fairness analysis audits"
  ON fairness_analysis_audits FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));
