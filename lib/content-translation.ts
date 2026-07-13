import { z } from 'zod';
import { getOpenAIClient } from '@/lib/openai/client';
import { resolveConfiguredModel } from '@/lib/openai/model-config';
import { temperatureOption } from '@/lib/openai/request-options';

export type LocalizedMcqFields = {
  question_en: string;
  option_a_en: string;
  option_b_en: string;
  option_c_en: string;
  option_d_en: string;
  rationale_en?: string | null;
  correct_rationale_en?: string | null;
};

export type McqTranslations = {
  question_es: string;
  question_fr: string;
  option_a_es: string;
  option_a_fr: string;
  option_b_es: string;
  option_b_fr: string;
  option_c_es: string;
  option_c_fr: string;
  option_d_es: string;
  option_d_fr: string;
  rationale_es: string;
  rationale_fr: string;
};

const mcqTranslationsSchema = z.object({
  question_es: z.string().min(1),
  question_fr: z.string().min(1),
  option_a_es: z.string().min(1),
  option_a_fr: z.string().min(1),
  option_b_es: z.string().min(1),
  option_b_fr: z.string().min(1),
  option_c_es: z.string().min(1),
  option_c_fr: z.string().min(1),
  option_d_es: z.string().min(1),
  option_d_fr: z.string().min(1),
  rationale_es: z.string().min(1),
  rationale_fr: z.string().min(1),
});

function emptyTranslations(): McqTranslations {
  return {
    question_es: '',
    question_fr: '',
    option_a_es: '',
    option_a_fr: '',
    option_b_es: '',
    option_b_fr: '',
    option_c_es: '',
    option_c_fr: '',
    option_d_es: '',
    option_d_fr: '',
    rationale_es: '',
    rationale_fr: '',
  };
}

export async function translateMcqFields(fields: LocalizedMcqFields): Promise<McqTranslations> {
  if (!process.env.OPENAI_API_KEY) return emptyTranslations();

  const model = resolveConfiguredModel('TRANSLATION_MODEL', 'gpt-4.1-mini');
  const rationale = fields.rationale_en || fields.correct_rationale_en || '';
  const prompt = `Translate this exam-prep MCQ from English into Spanish and French.

Rules:
- Preserve clinical, legal, and exam terminology accurately.
- Preserve option meaning and difficulty.
- Do not add explanations.
- Return JSON only with the requested keys.

English source:
Question: ${fields.question_en}
A: ${fields.option_a_en}
B: ${fields.option_b_en}
C: ${fields.option_c_en}
D: ${fields.option_d_en}
Rationale: ${rationale}

Return:
{
  "question_es": "string",
  "question_fr": "string",
  "option_a_es": "string",
  "option_a_fr": "string",
  "option_b_es": "string",
  "option_b_fr": "string",
  "option_c_es": "string",
  "option_c_fr": "string",
  "option_d_es": "string",
  "option_d_fr": "string",
  "rationale_es": "string",
  "rationale_fr": "string"
}`;

  const completion = await getOpenAIClient().chat.completions.create({
    model,
    ...temperatureOption(model, 0.2),
    messages: [
      {
        role: 'system',
        content: 'You are a precise multilingual exam-prep translator. Output only valid JSON.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) return emptyTranslations();

  try {
    return mcqTranslationsSchema.parse(JSON.parse(content));
  } catch (error) {
    console.error('MCQ translation failed validation:', error);
    return emptyTranslations();
  }
}
