CREATE INDEX IF NOT EXISTS idx_questions_practice_delivery
  ON questions(exam_track_id, active, reviewed, integrity_status, difficulty, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_questions_topic_delivery
  ON questions(topic_id, active, reviewed);

CREATE INDEX IF NOT EXISTS idx_questions_blueprint_objective
  ON questions(social_work_blueprint_item_id, active, reviewed);

CREATE INDEX IF NOT EXISTS idx_flashcards_practice_delivery
  ON flashcards(exam_track_id, active, reviewed, topic_id);

CREATE INDEX IF NOT EXISTS idx_case_vignettes_practice_delivery
  ON case_vignettes(exam_track_id, active, reviewed, topic_id);

CREATE INDEX IF NOT EXISTS idx_practice_sessions_user_track_mode_completed
  ON practice_sessions(user_id, exam_track_id, mode, completed, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_responses_session_created
  ON responses(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_responses_question
  ON responses(question_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_track_status
  ON subscriptions(user_id, exam_track_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_topics_track_order
  ON topics(exam_track_id, display_order);

CREATE INDEX IF NOT EXISTS idx_subtopics_topic_order
  ON subtopics(topic_id, display_order);

CREATE INDEX IF NOT EXISTS idx_blueprint_objectives_active_order
  ON blueprint_objectives(competency_id, active, display_order);
