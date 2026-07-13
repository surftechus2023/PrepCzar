# Admin Guide

Use `/admin/generate` to create draft content.

Workflow:

1. Select category, exam track, topic, content type, and quantity.
2. Generate content.
3. For Social Work MCQs, run editorial review, auto-rewrite if needed, final review, and committee review.
4. Review each generated item in the matching admin manager.
5. Publish content only after the publication checklist passes.

Publishing rule:

- Students can see non-MCQ content only when both `reviewed` and `active` are true.
- Students can see MCQs only when `reviewed=true`, `active=true`, `integrity_status='passed'`, `committee_status='approved'`, `blueprint_alignment_score >= 90`, `difficulty_quality_score >= 80`, and `integrity_score >= 85`.
- Admin overrides require a stored override reason, admin id, and timestamp.

Audit trail:

- Each generation request writes a row to `generation_logs`.
