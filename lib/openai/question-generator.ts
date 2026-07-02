import { z } from 'zod';
import { getOpenAIClient } from './client';

export const QUESTION_GENERATOR_MODEL = 'gpt-4o-mini';
export const QUESTION_PROMPT_VERSION = 'mcq-quality-v2-strict-integrity';

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
  cognitive_level: z.enum([
    'recall',
    'comprehension',
    'application',
    'analysis',
    'clinical judgment',
    'ethics',
    'safety',
    'prioritization',
  ]),
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

Strict alignment and quality rules:
- Do not copy official exam questions.
- Do not reproduce copyrighted test-bank content.
- Generate original educational practice questions only.
- Directly align every question to the selected exam_track_id, topic_id, subtopic, and learning objective.
- Target blueprint_alignment_score must be 90 or higher.
- Reject internally and regenerate any candidate that is weakly aligned, generic, or off-topic before returning it.
- Match the exact selected exam track scope and expected reasoning level.
- Do not mix BSW, MSW/LMSW, and LCSW levels.
- Do not mix NCLEX-RN and NCLEX-PN levels.
- Do not create generic healthcare, social work, psychology, nursing, or counseling questions.
- Target professional exam-level difficulty quality of 80 or higher.
- Avoid simple recall unless the selected cognitive level mix requires recall.
- Prefer application, analysis, clinical judgment, ethics, safety, prioritization, and scenario-based reasoning when appropriate.
- Each question must test one clear concept.
- Each question must have exactly four answer options.
- There must be one clear best answer only.
- Distractors must be plausible, exam-track appropriate, and not obviously wrong.
- Avoid "all of the above" and "none of the above."
- Do not use duplicate answer choices.
- Avoid absolute terms such as always, never, only, must, all, and none unless clinically or legally necessary.
- Avoid double negatives.
- Avoid vague wording.
- Avoid duplicate stems.
- Include detailed rationale for the correct answer.
- Include detailed explanation for each incorrect answer.
- Include a concise test-taking tip.
- Use the selected subtopic and learning objective explicitly in the reasoning, not as decorative metadata.
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
        content: 'You are a rigorous professional exam-prep item writer and quality-control reviewer. Internally reject weak, generic, off-topic, low-difficulty, or poorly aligned items before output. Output only valid JSON matching the requested schema.',
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
