WITH official(title, weight_percent, scored_item_count, display_order) AS (
  VALUES
    ('Professional Practice and Ethics', 12.00::numeric, 19, 1),
    ('Intake, Assessment, and Diagnosis', 12.00::numeric, 19, 2),
    ('Areas of Clinical Focus', 29.00::numeric, 47, 3),
    ('Treatment Planning', 9.00::numeric, 14, 4),
    ('Counseling Skills and Interventions', 30.00::numeric, 48, 5),
    ('Core Counseling Attributes', 8.00::numeric, 13, 6)
)
UPDATE blueprint_domains domains
SET
  weight_percent = official.weight_percent,
  scored_item_count = official.scored_item_count,
  display_order = official.display_order,
  active = true,
  is_placeholder = false,
  updated_at = now()
FROM official
JOIN exam_tracks tracks ON tracks.slug = 'nce'
WHERE domains.exam_track_id = tracks.id
  AND domains.title = official.title;

WITH official(title) AS (
  VALUES
    ('Professional Practice and Ethics'),
    ('Intake, Assessment, and Diagnosis'),
    ('Areas of Clinical Focus'),
    ('Treatment Planning'),
    ('Counseling Skills and Interventions'),
    ('Core Counseling Attributes')
)
UPDATE blueprint_domains domains
SET
  scored_item_count = COALESCE(domains.scored_item_count, 0),
  active = false,
  is_placeholder = true,
  updated_at = now()
FROM exam_tracks tracks
WHERE domains.exam_track_id = tracks.id
  AND tracks.slug = 'nce'
  AND NOT EXISTS (
    SELECT 1
    FROM official
    WHERE official.title = domains.title
  );

UPDATE topics topics
SET
  display_order = domains.display_order,
  official_weight_percent = domains.weight_percent,
  official_blueprint_text = domains.official_blueprint_text
FROM blueprint_domains domains
JOIN exam_tracks tracks ON tracks.id = domains.exam_track_id AND tracks.slug = 'nce'
WHERE topics.exam_track_id = tracks.id
  AND topics.blueprint_domain_id = domains.id
  AND domains.active = true
  AND domains.is_placeholder = false;
