# Admin Guide

Use `/admin/generate` to create draft content.

Workflow:

1. Select category, exam track, topic, content type, and quantity.
2. Generate content.
3. Review each generated item in the matching admin manager.
4. Mark content reviewed.
5. Activate content when it is ready for students.

Publishing rule:

- Students can see an item only when both `reviewed` and `active` are true.

Audit trail:

- Each generation request writes a row to `generation_logs`.
