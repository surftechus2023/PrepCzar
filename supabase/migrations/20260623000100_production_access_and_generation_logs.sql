-- Production access controls, billing-derived access, and AI generation logs.

CREATE TABLE IF NOT EXISTS user_exam_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_track_id uuid NOT NULL REFERENCES exam_tracks(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT false,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (user_id, exam_track_id)
);

CREATE INDEX IF NOT EXISTS idx_user_exam_access_user_id ON user_exam_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_exam_access_exam_track_id ON user_exam_access(exam_track_id);
CREATE INDEX IF NOT EXISTS idx_user_exam_access_active ON user_exam_access(active);

ALTER TABLE user_exam_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own exam access" ON user_exam_access;
CREATE POLICY "Users can read own exam access"
  ON user_exam_access FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage exam access" ON user_exam_access;
CREATE POLICY "Admins can manage exam access"
  ON user_exam_access FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE IF NOT EXISTS generation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  exam_track_id uuid REFERENCES exam_tracks(id) ON DELETE SET NULL,
  topic_id uuid REFERENCES topics(id) ON DELETE SET NULL,
  content_type text NOT NULL CHECK (content_type IN ('mcq', 'flashcards', 'vignettes')),
  requested_count integer NOT NULL CHECK (requested_count > 0),
  generated_count integer NOT NULL DEFAULT 0,
  duplicate_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generation_logs_admin_user_id ON generation_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_generation_logs_exam_track_id ON generation_logs(exam_track_id);
CREATE INDEX IF NOT EXISTS idx_generation_logs_created_at ON generation_logs(created_at);

ALTER TABLE generation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read generation logs" ON generation_logs;
CREATE POLICY "Admins can read generation logs"
  ON generation_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can insert generation logs" ON generation_logs;
CREATE POLICY "Admins can insert generation logs"
  ON generation_logs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE OR REPLACE FUNCTION public.sync_user_exam_access_from_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  has_access boolean;
BEGIN
  IF NEW.exam_track_id IS NULL THEN
    RETURN NEW;
  END IF;

  has_access := NEW.status = 'active'
    AND NEW.stripe_subscription_id IS NOT NULL
    AND (NEW.expires_at IS NULL OR NEW.expires_at > now());

  INSERT INTO user_exam_access (
    user_id,
    exam_track_id,
    subscription_id,
    active,
    granted_at,
    revoked_at
  )
  VALUES (
    NEW.user_id,
    NEW.exam_track_id,
    NEW.id,
    has_access,
    now(),
    CASE WHEN has_access THEN NULL ELSE now() END
  )
  ON CONFLICT (user_id, exam_track_id)
  DO UPDATE SET
    subscription_id = EXCLUDED.subscription_id,
    active = EXCLUDED.active,
    granted_at = CASE
      WHEN EXCLUDED.active AND user_exam_access.active = false THEN now()
      ELSE user_exam_access.granted_at
    END,
    revoked_at = CASE WHEN EXCLUDED.active THEN NULL ELSE now() END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_user_exam_access_on_subscription ON subscriptions;
CREATE TRIGGER sync_user_exam_access_on_subscription
  AFTER INSERT OR UPDATE OF status, expires_at, stripe_subscription_id, exam_track_id
  ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_exam_access_from_subscription();

-- Remove the earlier migration's free blanket access. Legitimate access is recreated
-- below only for Stripe-backed active subscriptions.
DELETE FROM subscriptions
WHERE status = 'active'
  AND stripe_subscription_id IS NULL
  AND stripe_customer_id IS NULL;

INSERT INTO user_exam_access (user_id, exam_track_id, subscription_id, active, granted_at, revoked_at)
SELECT user_id, exam_track_id, id, true, COALESCE(started_at, now()), NULL
FROM subscriptions
WHERE status = 'active'
  AND stripe_subscription_id IS NOT NULL
  AND exam_track_id IS NOT NULL
  AND (expires_at IS NULL OR expires_at > now())
ON CONFLICT (user_id, exam_track_id)
DO UPDATE SET
  subscription_id = EXCLUDED.subscription_id,
  active = true,
  revoked_at = NULL;

DROP POLICY IF EXISTS "Anyone can read topics" ON topics;
CREATE POLICY "Users can read subscribed topics"
  ON topics FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM user_exam_access a
      WHERE a.user_id = auth.uid()
        AND a.exam_track_id = topics.exam_track_id
        AND a.active = true
    )
  );

DROP POLICY IF EXISTS "Subscribers can read active flashcards" ON flashcards;
CREATE POLICY "Subscribers can read active reviewed flashcards"
  ON flashcards FOR SELECT TO authenticated
  USING (
    active = true AND reviewed = true AND (
      EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
      OR EXISTS (
        SELECT 1 FROM user_exam_access a
        WHERE a.user_id = auth.uid()
          AND a.exam_track_id = flashcards.exam_track_id
          AND a.active = true
      )
    )
  );

DROP POLICY IF EXISTS "Subscribers can read active vignettes" ON case_vignettes;
CREATE POLICY "Subscribers can read active reviewed vignettes"
  ON case_vignettes FOR SELECT TO authenticated
  USING (
    active = true AND reviewed = true AND (
      EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
      OR EXISTS (
        SELECT 1 FROM user_exam_access a
        WHERE a.user_id = auth.uid()
          AND a.exam_track_id = case_vignettes.exam_track_id
          AND a.active = true
      )
    )
  );

DROP POLICY IF EXISTS "Subscribers can read active reviewed questions" ON questions;
CREATE POLICY "Subscribers can read active reviewed questions"
  ON questions FOR SELECT TO authenticated
  USING (
    active = true AND reviewed = true AND (
      EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
      OR EXISTS (
        SELECT 1 FROM user_exam_access a
        WHERE a.user_id = auth.uid()
          AND a.exam_track_id = questions.exam_track_id
          AND a.active = true
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert own sessions" ON practice_sessions;
CREATE POLICY "Users can insert own subscribed sessions"
  ON practice_sessions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM user_exam_access a
      WHERE a.user_id = auth.uid()
        AND a.exam_track_id = practice_sessions.exam_track_id
        AND a.active = true
    )
  );

DROP POLICY IF EXISTS "Users can update own sessions" ON practice_sessions;
CREATE POLICY "Users can update own sessions"
  ON practice_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own scores" ON scores;
CREATE POLICY "Users can insert own subscribed scores"
  ON scores FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM user_exam_access a
      WHERE a.user_id = auth.uid()
        AND a.exam_track_id = scores.exam_track_id
        AND a.active = true
    )
  );
