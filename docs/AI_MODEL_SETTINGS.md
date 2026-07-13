# AI Model Settings

PrepCzar resolves AI models by task so administrators can change models without source-code edits.

## Resolution Order

For each AI task, the app resolves:

1. `ai_model_settings` database row
2. Environment variable for that task
3. Safe application default

Unsupported models fail validation. The app does not silently fall back when an admin-entered model is not in `OPENAI_ALLOWED_MODELS`.

## Admin UI

Open `/admin/ai-settings`.

Admins can configure:

- MCQ generation
- Flashcard generation
- Case-vignette generation
- Integrity review
- Auto-improvement
- Import cleanup
- Translation
- Optional student case coaching

Each row shows provider, model, enabled status, fallback model, last update, and estimated relative cost.

## Switching Generation Without Integrity

To switch only generation:

1. Go to `/admin/ai-settings`.
2. Edit `MCQ generation`, `Flashcard generation`, or `Case-vignette generation`.
3. Leave `Integrity review` unchanged.
4. Save and test the generation model.

Integrity, final review, and committee review continue using the `Integrity review` setting.

## Allowlist

Set `OPENAI_ALLOWED_MODELS` to a comma-separated list, for example:

```env
OPENAI_ALLOWED_MODELS=gpt-4.1,gpt-4.1-mini,gpt-4o,gpt-4o-mini,o3,o3-mini
```

Add a new OpenAI model to this allowlist before saving it in the admin UI.

## Required Migration

Apply:

```bash
supabase db push
```

This creates `ai_model_settings` and `ai_usage_logs`.
