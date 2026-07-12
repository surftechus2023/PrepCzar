# Blueprint Engine

PrepCzar uses stored blueprint metadata as the source of truth for AI generation, integrity review, and admin review.

## Tables

- `exam_categories` — top-level groupings such as Psychology, Social Work, Counseling, Case Management, and Nursing.
- `exam_tracks` — purchasable and generatable tracks such as EPPP, BSW, LMSW/MSW, LCSW, NCE, CCM, NCLEX-RN, and NCLEX-PN.
- `blueprint_domains` — major content areas with official text, weights, active status, and placeholder flags.
- `blueprint_competencies` — competency sections under each domain.
- `blueprint_objectives` — applied knowledge statements and learning objectives under each competency.
- `topics` — legacy/content-facing topic records linked to `blueprint_domains`.
- `subtopics` — legacy/content-facing subtopic records linked to `blueprint_competencies` and, where possible, `blueprint_objectives`.
- `question_blueprint_guidelines` — track-level cognitive and style rules for generation/review.

## Migration

Run Supabase migrations in order:

`supabase db push`

The blueprint engine migration is:

`supabase/migrations/20260712000100_blueprint_engine.sql`

It is additive and idempotent:

- Adds `exam_tracks.exam_level` and `exam_tracks.updated_at`.
- Creates `blueprint_domains`, `blueprint_competencies`, and `blueprint_objectives`.
- Links `topics` and `subtopics` to blueprint records.
- Promotes existing Social Work blueprint items into the generic hierarchy.
- Seeds non-Social-Work hierarchy records from existing topic coverage and marks records as placeholders when official text still needs verification.

## Completeness Rule

Generation must not proceed when selected blueprint metadata is incomplete. A usable objective requires:

- active domain, competency, and objective
- non-placeholder domain, competency, and objective
- official blueprint text
- learning objective

The API returns:

`The selected blueprint objective is incomplete. Add official blueprint text and a learning objective before generating content.`

## Admin Verification

Use `Admin > Blueprints` to:

- select an exam track
- view domains and weights
- view competencies
- view applied knowledge statements
- edit official blueprint text and learning objectives
- activate/deactivate records
- mark placeholder records as verified after official metadata is entered
- review the completeness indicator

## Supabase Verification Queries

Check hierarchy counts:

```sql
select et.slug, count(distinct d.id) domains, count(distinct c.id) competencies, count(distinct o.id) objectives
from exam_tracks et
left join blueprint_domains d on d.exam_track_id = et.id
left join blueprint_competencies c on c.domain_id = d.id
left join blueprint_objectives o on o.competency_id = c.id
group by et.slug
order by et.slug;
```

Find incomplete objectives:

```sql
select et.slug, d.title domain, c.title competency, o.title objective
from blueprint_objectives o
join blueprint_competencies c on c.id = o.competency_id
join blueprint_domains d on d.id = c.domain_id
join exam_tracks et on et.id = d.exam_track_id
where o.active = false
   or o.is_placeholder = true
   or nullif(o.official_blueprint_text, '') is null
   or nullif(o.learning_objective, '') is null
order by et.slug, d.display_order, c.display_order, o.display_order;
```

## Legacy Mapping

Legacy `topics` are mapped to `blueprint_domains` by exam track and title. Legacy `subtopics` are mapped to matching `blueprint_competencies`; if a competency has multiple objectives, the subtopic points to the first objective until an admin selects or edits a more precise objective.
