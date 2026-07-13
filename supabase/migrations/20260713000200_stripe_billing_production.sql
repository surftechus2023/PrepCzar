ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN (
    'active',
    'inactive',
    'canceled',
    'past_due',
    'trialing',
    'unpaid',
    'incomplete',
    'incomplete_expired'
  ));

CREATE TABLE IF NOT EXISTS stripe_processed_events (
  id text PRIMARY KEY,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  payload_created_at timestamptz,
  livemode boolean NOT NULL DEFAULT false
);

ALTER TABLE stripe_processed_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read stripe processed events" ON stripe_processed_events;
CREATE POLICY "Admins can read stripe processed events"
  ON stripe_processed_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

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

  has_access := NEW.status IN ('active', 'trialing')
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
