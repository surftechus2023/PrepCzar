CREATE TABLE IF NOT EXISTS ai_model_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  provider text NOT NULL DEFAULT 'openai',
  model_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  notes text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL,
  provider text NOT NULL DEFAULT 'openai',
  model_name text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cached_tokens integer NOT NULL DEFAULT 0,
  estimated_cost numeric(12,6) NOT NULL DEFAULT 0,
  related_batch_id uuid,
  related_record_id uuid,
  admin_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  success boolean NOT NULL DEFAULT true,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_action_created
  ON ai_usage_logs(action_type, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_admin_created
  ON ai_usage_logs(admin_user_id, created_at);

ALTER TABLE ai_model_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage ai model settings" ON ai_model_settings;
CREATE POLICY "Admins can manage ai model settings"
  ON ai_model_settings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP POLICY IF EXISTS "Admins can read ai usage logs" ON ai_usage_logs;
CREATE POLICY "Admins can read ai usage logs"
  ON ai_usage_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP POLICY IF EXISTS "Admins can insert ai usage logs" ON ai_usage_logs;
CREATE POLICY "Admins can insert ai usage logs"
  ON ai_usage_logs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

WITH defaults(setting_key, provider, model_name, enabled, notes) AS (
  VALUES
    ('mcq_generation', 'openai', 'gpt-4.1-mini', true, 'MCQ generation uses the cheaper configured generation model by default.'),
    ('flashcard_generation', 'openai', 'gpt-4.1-mini', true, 'Flashcard generation model.'),
    ('case_vignette_generation', 'openai', 'gpt-4.1-mini', true, 'Case-vignette generation model.'),
    ('integrity_review', 'openai', 'gpt-4.1', true, 'AI integrity/editorial review model.'),
    ('auto_improvement', 'openai', 'gpt-4.1', true, 'Stronger model for failed item improvement.'),
    ('import_cleanup', 'openai', 'gpt-4.1-mini', true, 'Optional import cleanup model.'),
    ('translation', 'openai', 'gpt-4.1-mini', true, 'Translation model.'),
    ('student_case_coaching', 'openai', 'gpt-4.1-mini', false, 'Optional student-facing case coaching; disabled by default.')
)
INSERT INTO ai_model_settings (setting_key, provider, model_name, enabled, notes)
SELECT setting_key, provider, model_name, enabled, notes
FROM defaults
ON CONFLICT (setting_key) DO NOTHING;
