import { z } from 'zod';
import { getOpenAIClient } from '@/lib/openai/client';
import { resolveConfiguredModel } from '@/lib/openai/model-config';
import { temperatureOption } from '@/lib/openai/request-options';
import { formatGenerationBlueprintPrompt } from './blueprint-context';
import type { BlueprintContext } from '@/lib/blueprint/blueprint-context-builder';

export const VIGNETTE_GENERATOR_MODEL = resolveConfiguredModel('CONTENT_GENERATION_MODEL', 'gpt-4.1-mini');
export const VIGNETTE_PROMPT_VERSION = 'vignette-blueprint-v1';

export const generatedVignetteSchema = z.object({
  case_en: z.string().min(60),
  case_es: z.string().optional().default(''),
  case_fr: z.string().optional().default(''),
  prompt_en: z.string().min(20),
  prompt_es: z.string().optional().default(''),
  prompt_fr: z.string().optional().default(''),
  expected_answer_elements: z.array(z.string()).min(2),
  scoring_rubric: z.array(z.string()).min(2),
  ideal_answer_en: z.string().min(40),
  ideal_answer_es: z.string().optional().default(''),
  ideal_answer_fr: z.string().optional().default(''),
  coaching_feedback_en: z.string().min(20),
  coaching_feedback_es: z.string().optional().default(''),
  coaching_feedback_fr: z.string().optional().default(''),
  topic: z.string().min(1),
  subtopic: z.string().min(1),
  learning_objective: z.string().min(1),
  applied_knowledge_statement: z.string().min(1),
  difficulty: z.enum(['medium', 'hard']),
  cognitive_level: z.string().min(1),
  blueprint_reference: z.string().min(1),
});

const responseSchema = z.object({
  vignettes: z.array(generatedVignetteSchema),
});

export type GeneratedVignette = z.infer<typeof generatedVignetteSchema>;

function stringArray(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function normalizeResponse(raw: any, context: BlueprintContext) {
  const items = Array.isArray(raw?.vignettes)
    ? raw.vignettes
    : Array.isArray(raw?.case_vignettes)
      ? raw.case_vignettes
      : Array.isArray(raw?.cases)
        ? raw.cases
        : Array.isArray(raw)
          ? raw
          : [];

  return {
    vignettes: items.map((item: any) => ({
      case_en: item.case_en || item.case || item.scenario || item.vignette || '',
      case_es: item.case_es || '',
      case_fr: item.case_fr || '',
      prompt_en: item.prompt_en || item.prompt || item.question || '',
      prompt_es: item.prompt_es || '',
      prompt_fr: item.prompt_fr || '',
      expected_answer_elements: stringArray(item.expected_answer_elements || item.answer_elements),
      scoring_rubric: stringArray(item.scoring_rubric || item.rubric),
      ideal_answer_en: item.ideal_answer_en || item.ideal_answer || item.answer || '',
      ideal_answer_es: item.ideal_answer_es || '',
      ideal_answer_fr: item.ideal_answer_fr || '',
      coaching_feedback_en: item.coaching_feedback_en || item.coaching_feedback || item.feedback || '',
      coaching_feedback_es: item.coaching_feedback_es || '',
      coaching_feedback_fr: item.coaching_feedback_fr || '',
      topic: item.topic || context.majorContentArea,
      subtopic: item.subtopic || context.competencySection,
      learning_objective: item.learning_objective || context.learningObjective,
      applied_knowledge_statement: item.applied_knowledge_statement || context.appliedKnowledgeStatement,
      difficulty: item.difficulty === 'hard' ? 'hard' : 'medium',
      cognitive_level: item.cognitive_level || context.cognitiveLevelTarget,
      blueprint_reference: item.blueprint_reference || context.officialBlueprintText,
    })),
  };
}

export async function generateVignettesFromBlueprint(input: {
  context: BlueprintContext;
  quantity: number;
  language: 'en' | 'es' | 'fr' | 'all';
  model?: string;
}) {
  const openai = getOpenAIClient();
  const prompt = `${formatGenerationBlueprintPrompt(input.context)}

Generate ${input.quantity} case vignettes.
Generation language: ${input.language}.

Case vignette requirements:
- Scenario, prompt, expected answer elements, scoring rubric, ideal response, and stored coaching feedback.
- Include blueprint linkage, topic/subtopic, applied knowledge statement, difficulty, cognitive level, and blueprint reference.
- Use English fields always; include Spanish and French fields when language is "all", "es", or "fr".
- Save-ready content only; no markdown fences.

Return valid JSON:
{
  "vignettes": [
    {
      "case_en": "string",
      "case_es": "string",
      "case_fr": "string",
      "prompt_en": "string",
      "prompt_es": "string",
      "prompt_fr": "string",
      "expected_answer_elements": ["string"],
      "scoring_rubric": ["string"],
      "ideal_answer_en": "string",
      "ideal_answer_es": "string",
      "ideal_answer_fr": "string",
      "coaching_feedback_en": "string",
      "coaching_feedback_es": "string",
      "coaching_feedback_fr": "string",
      "topic": "string",
      "subtopic": "string",
      "learning_objective": "string",
      "applied_knowledge_statement": "string",
      "difficulty": "medium",
      "cognitive_level": "application",
      "blueprint_reference": "string"
    }
  ]
}`;

  const model = input.model || VIGNETTE_GENERATOR_MODEL;
  const completion = await openai.chat.completions.create({
    model,
    ...temperatureOption(model, 0.4),
    messages: [
      { role: 'system', content: 'You are a rigorous professional exam-prep case writer. Output only valid JSON.' },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned no vignette content.');

  const parsed = responseSchema.safeParse(normalizeResponse(JSON.parse(content), input.context));
  if (!parsed.success) throw new Error(`OpenAI vignette response failed validation: ${parsed.error.message}`);
  return parsed.data.vignettes;
}
