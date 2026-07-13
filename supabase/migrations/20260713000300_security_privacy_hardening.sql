CREATE TABLE IF NOT EXISTS security_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text,
  resource_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_actor
  ON security_audit_logs(actor_user_id, created_at DESC);

ALTER TABLE security_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read security audit logs" ON security_audit_logs;
CREATE POLICY "Admins can read security audit logs"
  ON security_audit_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can read own subscriptions" ON subscriptions;
CREATE POLICY "Users can read own subscriptions"
  ON subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP POLICY IF EXISTS "Users can read own exam access" ON user_exam_access;
CREATE POLICY "Users can read own exam access"
  ON user_exam_access FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP POLICY IF EXISTS "Users can read own practice sessions" ON practice_sessions;
CREATE POLICY "Users can read own practice sessions"
  ON practice_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP POLICY IF EXISTS "Users can manage own practice sessions" ON practice_sessions;
CREATE POLICY "Users can manage own practice sessions"
  ON practice_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (user_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP POLICY IF EXISTS "Users can read own responses" ON responses;
CREATE POLICY "Users can read own responses"
  ON responses FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM practice_sessions
      WHERE practice_sessions.id = responses.session_id
        AND practice_sessions.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

DROP POLICY IF EXISTS "Users can manage own responses" ON responses;
CREATE POLICY "Users can manage own responses"
  ON responses FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM practice_sessions
      WHERE practice_sessions.id = responses.session_id
        AND practice_sessions.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM practice_sessions
      WHERE practice_sessions.id = responses.session_id
        AND practice_sessions.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

DROP POLICY IF EXISTS "Users can read own scores" ON scores;
CREATE POLICY "Users can read own scores"
  ON scores FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP POLICY IF EXISTS "Users can manage own bookmarks" ON bookmarks;
CREATE POLICY "Users can manage own bookmarks"
  ON bookmarks FOR ALL TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (user_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP POLICY IF EXISTS "Students can read published subscribed questions" ON questions;
CREATE POLICY "Students can read published subscribed questions"
  ON questions FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
    OR (
      active = true
      AND reviewed = true
      AND exam_track_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM user_exam_access
        WHERE user_exam_access.user_id = auth.uid()
          AND user_exam_access.exam_track_id = questions.exam_track_id
          AND user_exam_access.active = true
      )
    )
  );

DROP POLICY IF EXISTS "Students can read published subscribed flashcards" ON flashcards;
CREATE POLICY "Students can read published subscribed flashcards"
  ON flashcards FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
    OR (
      active = true
      AND reviewed = true
      AND exam_track_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM user_exam_access
        WHERE user_exam_access.user_id = auth.uid()
          AND user_exam_access.exam_track_id = flashcards.exam_track_id
          AND user_exam_access.active = true
      )
    )
  );

DROP POLICY IF EXISTS "Students can read published subscribed case vignettes" ON case_vignettes;
CREATE POLICY "Students can read published subscribed case vignettes"
  ON case_vignettes FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
    OR (
      active = true
      AND reviewed = true
      AND exam_track_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM user_exam_access
        WHERE user_exam_access.user_id = auth.uid()
          AND user_exam_access.exam_track_id = case_vignettes.exam_track_id
          AND user_exam_access.active = true
      )
    )
  );
