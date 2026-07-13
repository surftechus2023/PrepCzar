CREATE TABLE IF NOT EXISTS content_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'manual',
  filename text,
  content_type text NOT NULL CHECK (content_type IN ('mcq', 'flashcards', 'vignettes')),
  exam_track_id uuid REFERENCES exam_tracks(id) ON DELETE SET NULL,
  topic_id uuid REFERENCES topics(id) ON DELETE SET NULL,
  subtopic_id uuid REFERENCES subtopics(id) ON DELETE SET NULL,
  social_work_blueprint_item_id uuid REFERENCES social_work_blueprint_items(id) ON DELETE SET NULL,
  quantity_detected integer NOT NULL DEFAULT 0,
  quantity_selected integer NOT NULL DEFAULT 0,
  quantity_inserted integer NOT NULL DEFAULT 0,
  quantity_rejected integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'previewed', 'importing', 'completed', 'failed')),
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_content_import_batches_admin ON content_import_batches(admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_import_batches_track ON content_import_batches(exam_track_id, created_at DESC);

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS import_batch_id uuid REFERENCES content_import_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_filename text,
  ADD COLUMN IF NOT EXISTS original_import_text text;

ALTER TABLE flashcards
  ADD COLUMN IF NOT EXISTS import_batch_id uuid REFERENCES content_import_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_filename text,
  ADD COLUMN IF NOT EXISTS original_import_text text;

ALTER TABLE case_vignettes
  ADD COLUMN IF NOT EXISTS import_batch_id uuid REFERENCES content_import_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_filename text,
  ADD COLUMN IF NOT EXISTS original_import_text text;

ALTER TABLE content_import_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage content import batches" ON content_import_batches;
CREATE POLICY "Admins can manage content import batches"
  ON content_import_batches FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));
