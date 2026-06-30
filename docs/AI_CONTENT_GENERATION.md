# AI Content Generation

PrepCzar generates AI exam-prep content through admin-only workflows. The model is used to create draft content once, the drafts are stored in Supabase as inactive and unreviewed, and students practice only against approved database content.

## How It Works

1. An admin opens `/admin/content-generation`.
2. The admin selects an exam category, exam track, topic, subtopic, learning objective, quantity, difficulty mix, and cognitive level mix.
3. `/api/admin/generate-questions` creates an `ai_generation_batches` row and calls OpenAI in chunks of up to 25 questions.
4. Each generated question is parsed with Zod, scored by `lib/content-quality/question-quality.ts`, and inserted only when its score is at least 80.
5. Inserted AI questions are saved with `reviewed = false`, `active = false`, and `generated_by_ai = true`.
6. An admin reviews the queue at `/admin/review-questions`, edits if needed, then approves or publishes.

## Admin-Only AI

AI generation is intentionally admin-only. Student practice should be fast, predictable, auditable, and limited to content that has been reviewed for accuracy and exam-track fit. Normal student practice never calls OpenAI.

## Quality Scoring

Generated questions start at 100 points. The quality gate subtracts points for problems such as short question text, missing answer options, duplicate options, invalid correct answers, missing rationales, poor topic match, missing difficulty, missing cognitive level, likely duplicate hashes, or high similarity to existing questions.

Only questions with `quality_score >= 80` are inserted. Rejected items are counted in the generation batch summary.

## Duplicate Prevention

Each generated question receives a `duplicate_hash` from normalized question text plus `exam_track_id`. The hash is checked against existing database rows and against earlier accepted questions in the same batch. The quality gate also compares significant question tokens to reject items that are too similar to existing questions.

## Admin Review

The review page shows AI-generated questions with `reviewed = false`. Admins can inspect the question, options, correct answer, rationales, test-taking tip, subtopic, learning objective, quality score, and review notes.

Actions:

- Approve sets `reviewed = true`.
- Publish sets `reviewed = true` and `active = true`.
- Edit updates question text, options, rationales, topic metadata, and answer key.
- Reject keeps the question inactive and appends an admin rejection note.

## Student Retrieval

Student practice retrieves questions from Supabase with:

- matching `exam_track_id`
- `reviewed = true`
- `active = true`

RLS also enforces active subscribed exam-track access, so unreviewed AI content is not visible through normal student queries.

## Recommended MVP Targets

- 100 MCQs per exam track
- 50 flashcards per exam track
- 20 case vignettes per exam track

## Local Verification

Run:

```bash
npx tsx scripts/verify-question-generation.ts
```

The script verifies that batch tracking exists, required question fields exist, duplicate hashes are present, active questions are reviewed, unreviewed questions are not student-visible, and a sample generation request validates.
