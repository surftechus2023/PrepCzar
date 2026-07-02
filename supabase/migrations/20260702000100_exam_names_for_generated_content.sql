-- Denormalized exam labels for easier admin inspection and auditing.

ALTER TABLE generation_logs ADD COLUMN IF NOT EXISTS exam_name text;
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS exam_name text;
ALTER TABLE case_vignettes ADD COLUMN IF NOT EXISTS exam_name text;

UPDATE generation_logs gl
SET exam_name = COALESCE(NULLIF(et.full_name, ''), et.name)
FROM exam_tracks et
WHERE gl.exam_track_id = et.id
  AND COALESCE(gl.exam_name, '') = '';

UPDATE flashcards f
SET exam_name = COALESCE(NULLIF(et.full_name, ''), et.name)
FROM exam_tracks et
WHERE f.exam_track_id = et.id
  AND COALESCE(f.exam_name, '') = '';

UPDATE case_vignettes cv
SET exam_name = COALESCE(NULLIF(et.full_name, ''), et.name)
FROM exam_tracks et
WHERE cv.exam_track_id = et.id
  AND COALESCE(cv.exam_name, '') = '';

UPDATE flashcards f
SET exam_name = e.name
FROM exams e
WHERE f.exam_id = e.id
  AND COALESCE(f.exam_name, '') = '';

UPDATE case_vignettes cv
SET exam_name = e.name
FROM exams e
WHERE cv.exam_id = e.id
  AND COALESCE(cv.exam_name, '') = '';

CREATE INDEX IF NOT EXISTS idx_generation_logs_exam_name ON generation_logs(exam_name);
CREATE INDEX IF NOT EXISTS idx_flashcards_exam_name ON flashcards(exam_name);
CREATE INDEX IF NOT EXISTS idx_case_vignettes_exam_name ON case_vignettes(exam_name);

CREATE OR REPLACE FUNCTION public.set_exam_name_from_track()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.exam_name, '') = '' AND NEW.exam_track_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(full_name, ''), name)
    INTO NEW.exam_name
    FROM exam_tracks
    WHERE id = NEW.exam_track_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_generation_logs_exam_name ON generation_logs;
CREATE TRIGGER set_generation_logs_exam_name
  BEFORE INSERT OR UPDATE OF exam_track_id, exam_name
  ON generation_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_exam_name_from_track();

DROP TRIGGER IF EXISTS set_flashcards_exam_name ON flashcards;
CREATE TRIGGER set_flashcards_exam_name
  BEFORE INSERT OR UPDATE OF exam_track_id, exam_name
  ON flashcards
  FOR EACH ROW EXECUTE FUNCTION public.set_exam_name_from_track();

DROP TRIGGER IF EXISTS set_case_vignettes_exam_name ON case_vignettes;
CREATE TRIGGER set_case_vignettes_exam_name
  BEFORE INSERT OR UPDATE OF exam_track_id, exam_name
  ON case_vignettes
  FOR EACH ROW EXECUTE FUNCTION public.set_exam_name_from_track();
