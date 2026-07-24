WITH source AS (
  SELECT
    id,
    lower(correct_option) AS current_letter,
    (ARRAY['a', 'b', 'c', 'd'])[floor(random() * 4)::int + 1] AS target_letter,
    jsonb_build_object(
      'a', option_a_en,
      'b', option_b_en,
      'c', option_c_en,
      'd', option_d_en
    ) AS option_en,
    jsonb_build_object(
      'a', option_a_es,
      'b', option_b_es,
      'c', option_c_es,
      'd', option_d_es
    ) AS option_es,
    jsonb_build_object(
      'a', option_a_fr,
      'b', option_b_fr,
      'c', option_c_fr,
      'd', option_d_fr
    ) AS option_fr,
    jsonb_build_object(
      'a', option_a_rationale_en,
      'b', option_b_rationale_en,
      'c', option_c_rationale_en,
      'd', option_d_rationale_en
    ) AS rationale_en
  FROM questions
  WHERE lower(correct_option) IN ('a', 'b', 'c', 'd')
),
mapped AS (
  SELECT
    *,
    CASE WHEN target_letter = 'a' THEN current_letter WHEN current_letter = 'a' THEN target_letter ELSE 'a' END AS source_a,
    CASE WHEN target_letter = 'b' THEN current_letter WHEN current_letter = 'b' THEN target_letter ELSE 'b' END AS source_b,
    CASE WHEN target_letter = 'c' THEN current_letter WHEN current_letter = 'c' THEN target_letter ELSE 'c' END AS source_c,
    CASE WHEN target_letter = 'd' THEN current_letter WHEN current_letter = 'd' THEN target_letter ELSE 'd' END AS source_d
  FROM source
)
UPDATE questions
SET
  option_a_en = mapped.option_en ->> mapped.source_a,
  option_a_es = mapped.option_es ->> mapped.source_a,
  option_a_fr = mapped.option_fr ->> mapped.source_a,
  option_b_en = mapped.option_en ->> mapped.source_b,
  option_b_es = mapped.option_es ->> mapped.source_b,
  option_b_fr = mapped.option_fr ->> mapped.source_b,
  option_c_en = mapped.option_en ->> mapped.source_c,
  option_c_es = mapped.option_es ->> mapped.source_c,
  option_c_fr = mapped.option_fr ->> mapped.source_c,
  option_d_en = mapped.option_en ->> mapped.source_d,
  option_d_es = mapped.option_es ->> mapped.source_d,
  option_d_fr = mapped.option_fr ->> mapped.source_d,
  option_a_rationale_en = mapped.rationale_en ->> mapped.source_a,
  option_b_rationale_en = mapped.rationale_en ->> mapped.source_b,
  option_c_rationale_en = mapped.rationale_en ->> mapped.source_c,
  option_d_rationale_en = mapped.rationale_en ->> mapped.source_d,
  correct_option = mapped.target_letter
FROM mapped
WHERE questions.id = mapped.id;
