import { z } from 'zod';
import { getOpenAIClient } from './client';

export const QUESTION_GENERATOR_MODEL = 'gpt-4o-mini';
export const QUESTION_PROMPT_VERSION = 'mcq-quality-v1';

const percentMixSchema = z.record(z.string(), z.number().int().min(0).max(100));

export const generatedQuestionSchema = z.object({
  question: z.string().min(40),
  option_a: z.string().min(1),
  option_b: z.string().min(1),
  option_c: z.string().min(1),
  option_d: z.string().min(1),
  correct_option: z.enum(['A', 'B', 'C', 'D']),
  correct_rationale: z.string().min(20),
  option_a_rationale: z.string().min(10),
  option_b_rationale: z.string().min(10),
  option_c_rationale: z.string().min(10),
  option_d_rationale: z.string().min(10),
  test_taking_tip: z.string().min(10),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  cognitive_level: z.enum(['recall', 'application', 'analysis']),
  topic: z.string().min(1),
  subtopic: z.string().min(1),
  learning_objective: z.string().min(1),
  source_topic: z.string().min(1),
});

const generatedQuestionResponseSchema = z.object({
  questions: z.array(generatedQuestionSchema),
});

export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;

export const questionGenerationInputSchema = z.object({
  examTrackId: z.string().uuid(),
  topicId: z.string().uuid(),
  examTrackName: z.string().min(1),
  topicTitle: z.string().min(1),
  subtopic: z.string().min(2),
  learningObjective: z.string().min(5),
  quantity: z.number().int().min(1).max(25),
  difficultyMix: percentMixSchema,
  cognitiveLevelMix: percentMixSchema,
});

export type QuestionGenerationInput = z.infer<typeof questionGenerationInputSchema>;

function formatMix(mix: Record<string, number>) {
  return Object.entries(mix)
    .map(([key, value]) => `${key}: ${value}%`)
    .join(', ');
}

export async function generateQuestions(input: QuestionGenerationInput): Promise<GeneratedQuestion[]> {
  const parsedInput = questionGenerationInputSchema.parse(input);
  const openai = getOpenAIClient();

  const prompt = `Generate ${parsedInput.quantity} original multiple-choice exam-prep questions.

Exam track:
- id: ${parsedInput.examTrackId}
- name: ${parsedInput.examTrackName}

Topic:
- id: ${parsedInput.topicId}
- title: ${parsedInput.topicTitle}
- subtopic: ${parsedInput.subtopic}
- learning objective: ${parsedInput.learningObjective}

Difficulty mix: ${formatMix(parsedInput.difficultyMix)}
Cognitive level mix: ${formatMix(parsedInput.cognitiveLevelMix)}

Rules:
- Do not copy official exam questions.
- Do not reproduce copyrighted test-bank content.
- Generate original educational practice questions only.
- Match the specific exam track.
- Do not mix BSW, MSW/LMSW, and LCSW content.
- Do not mix NCLEX-RN and NCLEX-PN content.
- Each question must test one clear concept.
- Each question must have exactly four answer options.
- Only one answer can be correct.
- Distractors must be plausible.
- Avoid "all of the above" and "none of the above."
- Avoid duplicate stems.
- Include detailed rationale for the correct answer.
- Include explanation for each wrong answer.
- Include a concise test-taking tip.
- Return valid JSON only.

Return exactly this JSON shape:
{
  "questions": [
    {
      "question": "string",
      "option_a": "string",
      "option_b": "string",
      "option_c": "string",
      "option_d": "string",
      "correct_option": "A",
      "correct_rationale": "string",
      "option_a_rationale": "string",
      "option_b_rationale": "string",
      "option_c_rationale": "string",
      "option_d_rationale": "string",
      "test_taking_tip": "string",
      "difficulty": "easy",
      "cognitive_level": "application",
      "topic": "string",
      "subtopic": "string",
      "learning_objective": "string",
      "source_topic": "string"
    }
  ]
}`;

  const completion = await openai.chat.completions.create({
    model: QUESTION_GENERATOR_MODEL,
    temperature: 0.4,
    messages: [
      {
        role: 'system',
        content: 'You are a rigorous exam-prep item writer. Output only valid JSON matching the requested schema.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI returned no question content.');
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch {
    throw new Error('OpenAI returned invalid JSON.');
  }

  const result = generatedQuestionResponseSchema.safeParse(parsedJson);
  if (!result.success) {
    throw new Error(`OpenAI response failed validation: ${result.error.message}`);
  }

  return result.data.questions;
}
