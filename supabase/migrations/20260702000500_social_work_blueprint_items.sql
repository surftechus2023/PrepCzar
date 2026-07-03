-- ASWB-style Social Work blueprint source-of-truth records.
-- Populate this table from the uploaded official blueprint/handbook text before
-- generating strict BSW, LMSW/MSW, or LCSW/Clinical questions.

CREATE TABLE IF NOT EXISTS social_work_blueprint_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_track_id uuid NOT NULL REFERENCES exam_tracks(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES topics(id) ON DELETE SET NULL,
  subtopic_id uuid REFERENCES subtopics(id) ON DELETE SET NULL,
  exam_level text NOT NULL CHECK (exam_level IN ('bsw', 'lmsw_msw', 'lcsw_clinical')),
  major_content_area text NOT NULL,
  percentage_weight numeric(5,2),
  competency_section text NOT NULL,
  applied_knowledge_statement text NOT NULL,
  cognitive_level_guidance text,
  official_blueprint_text text NOT NULL DEFAULT '',
  sample_style_guidance text,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_work_blueprint_items_track
  ON social_work_blueprint_items(exam_track_id, display_order);

CREATE INDEX IF NOT EXISTS idx_social_work_blueprint_items_topic
  ON social_work_blueprint_items(topic_id, subtopic_id);

ALTER TABLE social_work_blueprint_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read social work blueprint items" ON social_work_blueprint_items;
CREATE POLICY "Users can read social work blueprint items"
  ON social_work_blueprint_items FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage social work blueprint items" ON social_work_blueprint_items;
CREATE POLICY "Admins can manage social work blueprint items"
  ON social_work_blueprint_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS social_work_blueprint_item_id uuid REFERENCES social_work_blueprint_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS blueprint_content_area text,
  ADD COLUMN IF NOT EXISTS blueprint_competency_section text,
  ADD COLUMN IF NOT EXISTS applied_knowledge_statement text,
  ADD COLUMN IF NOT EXISTS question_writing_guideline text,
  ADD COLUMN IF NOT EXISTS intended_cognitive_level text;

CREATE INDEX IF NOT EXISTS idx_questions_social_work_blueprint_item_id
  ON questions(social_work_blueprint_item_id);
