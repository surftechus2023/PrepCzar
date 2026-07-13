# AI Usage and Costs

PrepCzar uses AI only for admin workflows such as generation, integrity/editorial review, auto-improvement, and optional import cleanup.

Normal student MCQ and flashcard retrieval uses stored Supabase content and does not call OpenAI.

## Usage Logs

AI usage is recorded in `ai_usage_logs`:

- action type
- provider
- model
- input tokens
- output tokens
- cached tokens when available
- estimated cost
- related batch or record
- admin/user
- success or failure
- timestamp

Secret API keys are never stored in usage logs.

## Cost Estimates

Generation pages show an estimate before execution:

- requested quantity
- selected model
- estimated token volume
- estimated cost range

Actual cost can differ because provider tokenization and output length vary.

## Cost Controls

Configured controls:

- `MAX_AI_GENERATION_QUANTITY` limits items per generation request.
- `DAILY_ADMIN_GENERATION_LIMIT` limits estimated daily admin generation volume.
- `MONTHLY_AI_BUDGET_WARNING_USD` displays a monthly warning threshold in admin settings.
- Stronger models can be reserved for failed-item improvement.
- Cheaper models can be used for initial generation.

Recommended defaults:

```env
MAX_AI_GENERATION_QUANTITY=25
DAILY_ADMIN_GENERATION_LIMIT=200
MONTHLY_AI_BUDGET_WARNING_USD=100
```

## Recommended Model Split

- Initial generation: cheaper model such as `gpt-4.1-mini`
- Integrity/final/committee review: stronger model such as `gpt-4.1`
- Auto-improvement: stronger model such as `gpt-4.1`
- Import cleanup: cheaper model unless substantive cleanup is needed

This keeps high-cost models focused on failed or high-risk items.
