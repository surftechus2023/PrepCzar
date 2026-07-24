# NCE Generation Rules

NCE generation is blueprint-grounded.

## Required Context

Before generation, the application retrieves:

- NCE exam track metadata
- Official source URL and exam description
- Domain, weight, and scored item count
- Knowledge/skill/task objective
- Topic and subtopic linkage
- Learning objective
- CACREP core area mapping
- Question-writing rules
- Difficulty and cognitive-level targets

## Style

Questions must measure applied counseling competence. Prefer scenarios requiring:

- Clinical reasoning
- Assessment judgment
- Ethical decision-making
- Treatment planning
- Counseling intervention selection
- Professional judgment

Avoid:

- Simple memorization
- Definition recall
- Trivia
- Recognition-only questions
- Generic counseling questions not tied to the selected objective

## Distribution

Weighted batches should follow stored domain weights. For 100 questions:

- Professional Practice and Ethics: 12
- Intake, Assessment, and Diagnosis: 12
- Areas of Clinical Focus: 29
- Treatment Planning: 9
- Counseling Skills and Interventions: 30
- Core Counseling Attributes: 8

For other quantities, multiply quantity by domain weight and distribute rounding remainders by largest remainder.
