ALTER TABLE practice_sessions
  ADD COLUMN IF NOT EXISTS content_item_ids uuid[] DEFAULT ARRAY[]::uuid[],
  ADD COLUMN IF NOT EXISTS current_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_items integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE responses
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'mcq',
  ADD COLUMN IF NOT EXISTS content_item_id uuid,
  ADD COLUMN IF NOT EXISTS time_spent_ms integer,
  ADD COLUMN IF NOT EXISTS domain_title text,
  ADD COLUMN IF NOT EXISTS competency_title text,
  ADD COLUMN IF NOT EXISTS cognitive_level text,
  ADD COLUMN IF NOT EXISTS difficulty text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'responses_session_question_unique'
  ) THEN
    DELETE FROM responses older
    USING responses newer
    WHERE older.ctid < newer.ctid
      AND older.session_id = newer.session_id
      AND older.question_id = newer.question_id;

    ALTER TABLE responses
      ADD CONSTRAINT responses_session_question_unique UNIQUE (session_id, question_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_track_id uuid REFERENCES exam_tracks(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('mcq', 'flashcards', 'vignettes')),
  content_item_id uuid NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, content_type, content_item_id)
);

CREATE TABLE IF NOT EXISTS flashcard_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_track_id uuid REFERENCES exam_tracks(id) ON DELETE CASCADE,
  flashcard_id uuid NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
  classification text NOT NULL CHECK (classification IN ('known', 'learning')),
  next_review_at timestamptz,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  review_count integer NOT NULL DEFAULT 1,
  UNIQUE (user_id, flashcard_id)
);

CREATE TABLE IF NOT EXISTS vignette_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_vignette_id uuid NOT NULL REFERENCES case_vignettes(id) ON DELETE CASCADE,
  response_text text NOT NULL DEFAULT '',
  self_score numeric(5,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, case_vignette_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_content
  ON bookmarks(user_id, content_type, content_item_id);

CREATE INDEX IF NOT EXISTS idx_flashcard_reviews_user_next
  ON flashcard_reviews(user_id, next_review_at);

CREATE INDEX IF NOT EXISTS idx_vignette_responses_session
  ON vignette_responses(session_id);

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcard_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE vignette_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own bookmarks" ON bookmarks;
CREATE POLICY "Users can manage own bookmarks"
  ON bookmarks FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own flashcard reviews" ON flashcard_reviews;
CREATE POLICY "Users can manage own flashcard reviews"
  ON flashcard_reviews FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own vignette responses" ON vignette_responses;
CREATE POLICY "Users can manage own vignette responses"
  ON vignette_responses FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
