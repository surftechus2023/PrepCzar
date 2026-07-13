# Question Integrity Review

PrepCzar reviews AI-generated MCQs before publication. Student practice uses only stored content; it never generates questions during practice.

## Workflow

1. Generate blueprint-grounded MCQs.
2. Run deterministic validation.
3. Run integrity review against the same stored blueprint context.
4. Auto-improve failed items when metadata exists.
5. Recheck after each improvement.
6. Send items that still fail after two attempts to human review.
7. Publish only after gates pass or an admin override reason is recorded.

## Blueprint Context Required

The reviewer uses stored metadata from `exam_tracks`, `topics`, `subtopics`, and `social_work_blueprint_items`:

- Exam track, exam level, official source URL, and official exam description
- Domain, domain weight, competency section, and applied knowledge statement
- Topic/subtopic descriptions, learning objective, and official blueprint text
- Question-writing guideline, intended difficulty, and intended cognitive level
- Complete question, answer options, correct answer, distractor rationales, and test-taking tip

If required metadata is missing, the item is marked `needs_metadata`. The checker does not treat missing metadata as a normal low-alignment failure.

## Passing Gates

MCQs must meet all required gates:

- `integrity_status = passed`
- `blueprint_alignment_score >= 90`
- `difficulty_quality_score >= 80`
- `integrity_score >= 85`
- Difficulty is not `easy`
- Duplicate/plagiarism risk is not high
- No unresolved critical bias flags

Difficulty quality means the item matches the intended professional level and cognitive demand. A medium item predicted as hard can still be acceptable. A predicted easy item fails because easy generated items are not allowed.

## Social Work Rules

Social Work review follows stored ASWB-style guidance:

- Clear wording and one correct answer
- No tricks, “all of the above,” “none of the above,” or combined answers
- Practice-relevant content within social work scope
- Appropriate sequencing for safety, self-determination, ethics, confidentiality, boundaries, and mandated reporting
- Plausible distractors and adequate rationales
- Medium LCSW application items are allowed; simple recall is not

## Admin Review

The admin review page shows the full question, options, rationales, blueprint context, intended/detected cognitive level, intended/predicted difficulty, scores, flags, improvement history, and model used.

Actions:

- `Rerun Integrity` scores only.
- `Auto-Improve and Recheck` rewrites and scores again.
- `Edit` keeps manual correction available.
- `Approve` marks admin review.
- `Publish` requires gates.
- `Admin Override` requires a reason, admin user ID, and timestamp.
