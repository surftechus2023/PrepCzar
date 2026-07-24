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
  official_blueprint_text = COALESCE(NULLIF(domains.official_blueprint_text, ''), domains.description),
  updated_at = now()
FROM official
JOIN exam_tracks tracks ON tracks.slug = 'nce'
WHERE domains.exam_track_id = tracks.id
  AND domains.title = official.title;

UPDATE topics topic
SET
  blueprint_domain_id = domains.id,
  official_blueprint_text = domains.official_blueprint_text,
  official_weight_percent = domains.weight_percent,
  description = domains.description,
  display_order = domains.display_order
FROM blueprint_domains domains
JOIN exam_tracks tracks ON tracks.id = domains.exam_track_id AND tracks.slug = 'nce'
WHERE topic.exam_track_id = tracks.id
  AND topic.title = domains.title
  AND domains.active = true
  AND domains.is_placeholder = false;

UPDATE subtopics subtopic
SET
  blueprint_competency_id = competencies.id,
  blueprint_objective_id = objectives.id,
  learning_objective = objectives.learning_objective,
  official_blueprint_text = objectives.official_blueprint_text,
  description = objectives.description,
  display_order = objectives.display_order
FROM topics topic
JOIN blueprint_domains domains ON domains.id = topic.blueprint_domain_id
JOIN blueprint_competencies competencies ON competencies.domain_id = domains.id
JOIN blueprint_objectives objectives ON objectives.competency_id = competencies.id
WHERE subtopic.topic_id = topic.id
  AND topic.exam_track_id = domains.exam_track_id
  AND domains.active = true
  AND domains.is_placeholder = false
  AND subtopic.title = objectives.title;
