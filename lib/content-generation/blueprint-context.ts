import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildBlueprintContext,
  formatBlueprintContextForPrompt,
  type BlueprintContext,
} from '@/lib/blueprint/blueprint-context-builder';
import { formatExamTrackRulesForPrompt } from './exam-track-rules';

export interface GenerationBlueprintInput {
  examTrackId: string;
  topicId: string;
  subtopicId?: string | null;
  socialWorkBlueprintItemId?: string | null;
  intendedDifficulty?: 'medium' | 'hard' | null;
  intendedCognitiveLevel?: string | null;
}

export async function loadRequiredBlueprintContext(
  supabaseAdmin: SupabaseClient,
  input: GenerationBlueprintInput
): Promise<BlueprintContext> {
  const context = await buildBlueprintContext(supabaseAdmin, {
    examTrackId: input.examTrackId,
    topicId: input.topicId,
    subtopicId: input.subtopicId || null,
    socialWorkBlueprintItemId: input.socialWorkBlueprintItemId || null,
    difficultyTarget: input.intendedDifficulty || 'medium',
    cognitiveLevelTarget: input.intendedCognitiveLevel || 'application',
  });

  if (context.missingMetadata.length) {
    throw new Error(
      `The selected blueprint objective is incomplete. Add official blueprint text and a learning objective before generating content. Missing: ${context.missingMetadata.join(', ')}`
    );
  }

  return context;
}

export function formatGenerationBlueprintPrompt(context: BlueprintContext) {
  return [
    formatBlueprintContextForPrompt(context),
    '',
    'Exam-specific question-writing rules:',
    formatExamTrackRulesForPrompt(context.examTrack),
    '',
    'Strict generation boundaries:',
    '- Use only this stored blueprint context as the source of truth.',
    '- Do not mix exam tracks or exam levels.',
    '- Do not copy official questions or claim recalled licensing-exam content.',
    '- Generate medium or hard difficulty only.',
    '- Medium content must require application.',
    '- Hard content must require reasoning, prioritization, clinical judgment, ethical analysis, risk assessment, differential diagnosis, or complex decision-making when appropriate.',
  ].join('\n');
}

export function estimatedOpenAICost(itemCount: number) {
  return Number((itemCount * 0.002).toFixed(6));
}
