-- Preserve legacy NCE placeholder topic rows but remove them from NCE generation
-- selectors. Official NCE domains/objectives remain linked to the NCE exam track.

WITH nce_track AS (
  SELECT id
  FROM exam_tracks
  WHERE slug = 'nce'
  LIMIT 1
),
legacy_placeholder_topics AS (
  SELECT topics.id
  FROM topics
  JOIN nce_track ON nce_track.id = topics.exam_track_id
  JOIN blueprint_domains domains ON domains.id = topics.blueprint_domain_id
  WHERE domains.exam_track_id = nce_track.id
    AND domains.active = false
    AND domains.is_placeholder = true
)
UPDATE topics
SET exam_track_id = NULL
WHERE id IN (SELECT id FROM legacy_placeholder_topics);
