# OpenAI

OpenAI is used only by admin generation at `/admin/generate`.

Rules:

- Admin API access is required.
- Generated items are saved with `reviewed = false` and `active = false`.
- Students only see reviewed and active content.
- Student practice pages do not call OpenAI.
- Duplicate checks compare normalized English prompt/front/case text before insert.

Rotate `OPENAI_API_KEY` before production if it was exposed during development.
