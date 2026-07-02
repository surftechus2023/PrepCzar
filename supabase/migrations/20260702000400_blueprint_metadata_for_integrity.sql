-- Store official exam blueprint context used by generation and integrity scoring.

ALTER TABLE exam_tracks
  ADD COLUMN IF NOT EXISTS official_source_url text,
  ADD COLUMN IF NOT EXISTS official_exam_description text;

ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS official_blueprint_text text;

CREATE TABLE IF NOT EXISTS subtopics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  learning_objective text DEFAULT '',
  official_blueprint_text text DEFAULT '',
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subtopics_topic_id ON subtopics(topic_id);

ALTER TABLE subtopics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read subtopics" ON subtopics;
CREATE POLICY "Users can read subtopics"
  ON subtopics FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage subtopics" ON subtopics;
CREATE POLICY "Admins can manage subtopics"
  ON subtopics FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS subtopic_id uuid REFERENCES subtopics(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS blueprint_reference_text text;

CREATE INDEX IF NOT EXISTS idx_questions_subtopic_id ON questions(subtopic_id);

ALTER TABLE questions
  DROP CONSTRAINT IF EXISTS questions_integrity_status_check;

ALTER TABLE questions
  ADD CONSTRAINT questions_integrity_status_check
  CHECK (integrity_status IN ('pending', 'passed', 'needs_review', 'needs_improvement', 'needs_human_review', 'needs_metadata', 'failed'));
