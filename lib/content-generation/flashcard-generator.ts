import { z } from 'zod';
import { getOpenAIClient } from '@/lib/openai/client';
import { resolveConfiguredModel } from '@/lib/openai/model-config';
import { temperatureOption } from '@/lib/openai/request-options';
import { formatGenerationBlueprintPrompt } from './blueprint-context';
import type { BlueprintContext } from '@/lib/blueprint/blueprint-context-builder';

export const FLASHCARD_GENERATOR_MODEL = resolveConfiguredModel('CONTENT_GENERATION_MODEL', 'gpt-4.1-mini');
export const FLASHCARD_PROMPT_VERSION = 'flashcard-blueprint-v1';

export const generatedFlashcardSchema = z.object({
  front_en: z.string().min(8),
  front_es: z.string().optional().default(''),
  front_fr: z.string().optional().default(''),
  back_en: z.string().min(20),
  back_es: z.string().optional().default(''),
  back_fr: z.string().optional().default(''),
  topic: z.string().min(1),
  subtopic: z.string().min(1),
  learning_objective: z.string().min(1),
  applied_knowledge_statement: z.string().min(1),
  difficulty: z.enum(['medium', 'hard']),
  cognitive_level: z.string().min(1),
  blueprint_reference: z.string().min(1),
});

const responseSchema = z.object({
  flashcards: z.array(generatedFlashcardSchema),
});

export type GeneratedFlashcard = z.infer<typeof generatedFlashcardSchema>;

function normalizeResponse(raw: any, context: BlueprintContext) {
  const items = Array.isArray(raw?.flashcards)
    ? raw.flashcards
    : Array.isArray(raw?.cards)
      ? raw.cards
      : Array.isArray(raw)
        ? raw
        : [];

  return {
    flashcards: items.map((item: any) => ({
      front_en: item.front_en || item.front || item.question || '',
      front_es: item.front_es || '',
      front_fr: item.front_fr || '',
      back_en: item.back_en || item.back || item.answer || item.explanation || '',
      back_es: item.back_es || '',
      back_fr: item.back_fr || '',
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

export async function generateFlashcardsFromBlueprint(input: {
  context: BlueprintContext;
  quantity: number;
  language: 'en' | 'es' | 'fr' | 'all';
}) {
  const openai = getOpenAIClient();
  const prompt = `${formatGenerationBlueprintPrompt(input.context)}

Generate ${input.quantity} flashcards.
Generation language: ${input.language}.

Flashcard requirements:
- Concise front.
- Complete back.
- Include blueprint linkage, topic/subtopic, applied knowledge statement, difficulty, cognitive level, and blueprint reference.
- Use English fields always; include Spanish and French fields when language is "all", "es", or "fr".
- Save-ready content only; no markdown fences.

Return valid JSON:
{
  "flashcards": [
    {
      "front_en": "string",
      "front_es": "string",
      "front_fr": "string",
      "back_en": "string",
      "back_es": "string",
      "back_fr": "string",
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

  const completion = await openai.chat.completions.create({
    model: FLASHCARD_GENERATOR_MODEL,
    ...temperatureOption(FLASHCARD_GENERATOR_MODEL, 0.4),
    messages: [
      { role: 'system', content: 'You are a rigorous professional exam-prep content writer. Output only valid JSON.' },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned no flashcard content.');

  const parsed = responseSchema.safeParse(normalizeResponse(JSON.parse(content), input.context));
  if (!parsed.success) throw new Error(`OpenAI flashcard response failed validation: ${parsed.error.message}`);
  return parsed.data.flashcards;
}
