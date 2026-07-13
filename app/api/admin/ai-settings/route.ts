import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AI_MODEL_TASKS, estimateModelCost, estimateTokensForGeneration, resolveAIModelSetting, validateOpenAIModel, type AIModelTask } from '@/lib/ai/model-settings';
import { getOpenAIClient } from '@/lib/openai/client';
import { getSupabaseAdmin, requireAdmin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  setting_key: z.enum([
    'mcq_generation',
    'flashcard_generation',
    'case_vignette_generation',
    'integrity_review',
    'auto_improvement',
    'import_cleanup',
    'translation',
    'student_case_coaching',
  ]),
  model_name: z.string().min(1),
  provider: z.enum(['openai']).default('openai'),
  enabled: z.boolean(),
  notes: z.string().optional().nullable(),
});

async function resolvedSettings() {
  const supabaseAdmin = getSupabaseAdmin();
  const settings = await Promise.all(
    (Object.keys(AI_MODEL_TASKS) as AIModelTask[]).map((task) => resolveAIModelSetting(supabaseAdmin, task))
  );
  const estimate = estimateTokensForGeneration(10);
  return settings.map((setting) => ({
    ...setting,
    fallback_model: AI_MODEL_TASKS[setting.setting_key].fallback_model,
    estimated_cost_for_10: estimateModelCost(setting.model_name, estimate.inputTokens, estimate.outputTokens),
  }));
}

export async function GET(req: NextRequest) {
  try {
    const adminUser = await requireAdmin(req);
    if (!adminUser) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    return NextResponse.json({
      settings: await resolvedSettings(),
      allowedModels: (await import('@/lib/openai/model-config')).allowedOpenAIModels(),
      maxGenerationQuantity: Number(process.env.MAX_AI_GENERATION_QUANTITY || 25),
      dailyAdminGenerationLimit: Number(process.env.DAILY_ADMIN_GENERATION_LIMIT || 200),
      monthlyBudgetWarning: Number(process.env.MONTHLY_AI_BUDGET_WARNING_USD || 0),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Could not load AI settings.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const adminUser = await requireAdmin(req);
    if (!adminUser) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid AI model setting.', details: parsed.error.flatten() }, { status: 400 });
    const setting = parsed.data;
    const config = AI_MODEL_TASKS[setting.setting_key];

    if (!config.optional && !setting.enabled) {
      return NextResponse.json({ error: `${config.label} is required and cannot be disabled.` }, { status: 400 });
    }
    if (!validateOpenAIModel(setting.model_name)) {
      return NextResponse.json({ error: `Unsupported OpenAI model "${setting.model_name}". Add it to OPENAI_ALLOWED_MODELS before saving.` }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await (supabaseAdmin as any)
      .from('ai_model_settings')
      .upsert({
        setting_key: setting.setting_key,
        provider: setting.provider,
        model_name: setting.model_name,
        enabled: setting.enabled,
        notes: setting.notes || null,
        updated_by: adminUser.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'setting_key' });

    if (error) throw new Error(error.message);
    return NextResponse.json({ settings: await resolvedSettings() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Could not save AI model setting.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminUser = await requireAdmin(req);
    if (!adminUser) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const body = await req.json();
    const action = String(body.action || '');
    const settingKey = String(body.setting_key || '') as AIModelTask;
    const config = AI_MODEL_TASKS[settingKey];
    if (!config) return NextResponse.json({ error: 'Unknown AI setting key.' }, { status: 400 });

    const supabaseAdmin = getSupabaseAdmin();
    if (action === 'reset') {
      const { error } = await (supabaseAdmin as any)
        .from('ai_model_settings')
        .upsert({
          setting_key: settingKey,
          provider: 'openai',
          model_name: config.fallback_model,
          enabled: !config.optional || settingKey !== 'student_case_coaching',
          notes: 'Reset to safe application default.',
          updated_by: adminUser.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'setting_key' });
      if (error) throw new Error(error.message);
      return NextResponse.json({ settings: await resolvedSettings() });
    }

    if (action === 'test') {
      const resolved = await resolveAIModelSetting(supabaseAdmin, settingKey);
      if (!resolved.enabled) return NextResponse.json({ error: `${resolved.label} is disabled.` }, { status: 400 });
      const openai = getOpenAIClient();
      await openai.chat.completions.create({
        model: resolved.model_name,
        messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
        max_tokens: 5,
      });
      return NextResponse.json({ ok: true, model: resolved.model_name });
    }

    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'AI setting action failed.' }, { status: 500 });
  }
}
