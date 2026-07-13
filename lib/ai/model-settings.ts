import type { SupabaseClient } from '@supabase/supabase-js';
import { allowedOpenAIModels } from '@/lib/openai/model-config';

export type AIModelTask =
  | 'mcq_generation'
  | 'flashcard_generation'
  | 'case_vignette_generation'
  | 'integrity_review'
  | 'auto_improvement'
  | 'import_cleanup'
  | 'translation'
  | 'student_case_coaching';

export interface AIModelSetting {
  setting_key: AIModelTask;
  label: string;
  provider: 'openai';
  model_name: string;
  enabled: boolean;
  env_var: string;
  fallback_model: string;
  cost_category: 'low' | 'medium' | 'high';
  optional: boolean;
  notes?: string | null;
  updated_by?: string | null;
  updated_at?: string | null;
}

export const AI_MODEL_TASKS: Record<AIModelTask, Omit<AIModelSetting, 'provider' | 'model_name' | 'enabled'>> = {
  mcq_generation: {
    setting_key: 'mcq_generation',
    label: 'MCQ generation',
    env_var: 'CONTENT_GENERATION_MODEL',
    fallback_model: 'gpt-4.1-mini',
    cost_category: 'low',
    optional: false,
  },
  flashcard_generation: {
    setting_key: 'flashcard_generation',
    label: 'Flashcard generation',
    env_var: 'CONTENT_GENERATION_MODEL',
    fallback_model: 'gpt-4.1-mini',
    cost_category: 'low',
    optional: false,
  },
  case_vignette_generation: {
    setting_key: 'case_vignette_generation',
    label: 'Case-vignette generation',
    env_var: 'CONTENT_GENERATION_MODEL',
    fallback_model: 'gpt-4.1-mini',
    cost_category: 'low',
    optional: false,
  },
  integrity_review: {
    setting_key: 'integrity_review',
    label: 'Integrity review',
    env_var: 'CONTENT_INTEGRITY_MODEL',
    fallback_model: 'gpt-4.1',
    cost_category: 'medium',
    optional: false,
  },
  auto_improvement: {
    setting_key: 'auto_improvement',
    label: 'Auto-improvement',
    env_var: 'CONTENT_IMPROVEMENT_MODEL',
    fallback_model: 'gpt-4.1',
    cost_category: 'medium',
    optional: false,
  },
  import_cleanup: {
    setting_key: 'import_cleanup',
    label: 'Import cleanup',
    env_var: 'IMPORT_CLEANUP_MODEL',
    fallback_model: 'gpt-4.1-mini',
    cost_category: 'low',
    optional: true,
  },
  translation: {
    setting_key: 'translation',
    label: 'Translation',
    env_var: 'TRANSLATION_MODEL',
    fallback_model: 'gpt-4.1-mini',
    cost_category: 'low',
    optional: true,
  },
  student_case_coaching: {
    setting_key: 'student_case_coaching',
    label: 'Student case coaching',
    env_var: 'CASE_COACHING_MODEL',
    fallback_model: 'gpt-4.1-mini',
    cost_category: 'low',
    optional: true,
  },
};

const OPENAI_COST_PER_1K: Record<string, { input: number; output: number }> = {
  'gpt-4.1-mini': { input: 0.0004, output: 0.0016 },
  'gpt-4.1': { input: 0.002, output: 0.008 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4o': { input: 0.0025, output: 0.01 },
  o3: { input: 0.002, output: 0.008 },
  'o3-mini': { input: 0.0011, output: 0.0044 },
};

export function validateOpenAIModel(modelName: string) {
  return allowedOpenAIModels().includes(modelName);
}

export function estimateTokensForGeneration(quantity: number) {
  return {
    inputTokens: Math.max(1200, quantity * 900),
    outputTokens: Math.max(800, quantity * 650),
  };
}

export function estimateModelCost(modelName: string, inputTokens: number, outputTokens: number) {
  const rates = OPENAI_COST_PER_1K[modelName] || OPENAI_COST_PER_1K['gpt-4.1'];
  return Number((((inputTokens / 1000) * rates.input) + ((outputTokens / 1000) * rates.output)).toFixed(6));
}

export async function resolveAIModelSetting(
  supabaseAdmin: SupabaseClient,
  task: AIModelTask
): Promise<AIModelSetting> {
  const config = AI_MODEL_TASKS[task];
  const envModel = process.env[config.env_var]?.trim();
  const safeDefault = config.fallback_model;

  const { data, error } = await (supabaseAdmin as any)
    .from('ai_model_settings')
    .select('*')
    .eq('setting_key', task)
    .maybeSingle();

  if (error && !/schema cache|does not exist|could not find/i.test(error.message)) {
    throw new Error(error.message);
  }

  const modelName = String(data?.model_name || envModel || safeDefault).trim();
  if (!validateOpenAIModel(modelName)) {
    throw new Error(`Unsupported OpenAI model "${modelName}" for ${config.label}. Update Admin > AI Settings or OPENAI_ALLOWED_MODELS.`);
  }

  const enabled = data?.enabled ?? true;
  if (!enabled && !config.optional) {
    throw new Error(`${config.label} is required and cannot be disabled.`);
  }

  return {
    ...config,
    provider: 'openai',
    model_name: modelName,
    enabled,
    notes: data?.notes || null,
    updated_by: data?.updated_by || null,
    updated_at: data?.updated_at || null,
  };
}

export async function logAIUsage(
  supabaseAdmin: SupabaseClient,
  input: {
    actionType: AIModelTask | string;
    provider?: string;
    modelName: string;
    inputTokens?: number;
    outputTokens?: number;
    cachedTokens?: number;
    relatedBatchId?: string | null;
    relatedRecordId?: string | null;
    adminUserId?: string | null;
    userId?: string | null;
    success?: boolean;
    errorMessage?: string | null;
  }
) {
  const estimatedCost = estimateModelCost(input.modelName, input.inputTokens || 0, input.outputTokens || 0);
  await (supabaseAdmin as any).from('ai_usage_logs').insert({
    action_type: input.actionType,
    provider: input.provider || 'openai',
    model_name: input.modelName,
    input_tokens: input.inputTokens || 0,
    output_tokens: input.outputTokens || 0,
    cached_tokens: input.cachedTokens || 0,
    estimated_cost: estimatedCost,
    related_batch_id: input.relatedBatchId || null,
    related_record_id: input.relatedRecordId || null,
    admin_user_id: input.adminUserId || null,
    user_id: input.userId || null,
    success: input.success ?? true,
    error_message: input.errorMessage || null,
  });
}

export async function assertAdminGenerationWithinLimits(
  supabaseAdmin: SupabaseClient,
  adminUserId: string,
  requestedQuantity: number
) {
  const maxPerRequest = Number(process.env.MAX_AI_GENERATION_QUANTITY || 25);
  const dailyLimit = Number(process.env.DAILY_ADMIN_GENERATION_LIMIT || 200);
  if (requestedQuantity > maxPerRequest) {
    throw new Error(`Requested quantity exceeds the maximum generation quantity per request (${maxPerRequest}).`);
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { data, error } = await (supabaseAdmin as any)
    .from('ai_usage_logs')
    .select('output_tokens')
    .eq('admin_user_id', adminUserId)
    .in('action_type', ['mcq_generation', 'flashcard_generation', 'case_vignette_generation'])
    .gte('created_at', startOfDay.toISOString());

  if (error && !/schema cache|does not exist|could not find/i.test(error.message)) throw new Error(error.message);
  const approximateItemsToday = Math.ceil(((data || []) as Array<{ output_tokens: number }>).reduce((sum, row) => sum + (row.output_tokens || 0), 0) / 650);
  if (approximateItemsToday + requestedQuantity > dailyLimit) {
    throw new Error(`Daily admin generation limit exceeded. Limit: ${dailyLimit}; already estimated today: ${approximateItemsToday}.`);
  }
}
