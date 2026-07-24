# NCE Blueprint Engine

PrepCzar stores the uploaded National Counselor Examination (NCE) blueprint as structured database metadata. Future NCE content generation must use stored blueprint records rather than generic counseling knowledge.

## Stored Hierarchy

- Exam track: `NCE`
- Blueprint domains: six official NCE domains with weight percent and scored item count.
- Competency: `Knowledge, Skills, and Tasks` under each domain.
- Objectives: every official bullet under the domain.
- Topics: one topic per NCE domain, linked to `blueprint_domains`.
- Subtopics: one subtopic per NCE objective, linked to `blueprint_objectives`.
- CACREP mappings: objectives map to one or more CACREP common core areas.

## Official Domains

- Professional Practice and Ethics — 12%, 19 scored items
- Intake, Assessment, and Diagnosis — 12%, 19 scored items
- Areas of Clinical Focus — 29%, 47 scored items
- Treatment Planning — 9%, 14 scored items
- Counseling Skills and Interventions — 30%, 48 scored items
- Core Counseling Attributes — 8%, 13 scored items

## CACREP Core Areas

The engine stores all eight CACREP common core areas and links objectives through `blueprint_objective_cacrep_mappings`.

## Coverage

The `nce_blueprint_coverage` view reports generated, approved, published, and passed-integrity counts by domain and objective. Use this view to identify underrepresented objectives.
