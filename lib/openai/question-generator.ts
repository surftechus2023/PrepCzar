import { z } from 'zod';
import { formatExamTrackRulesForPrompt } from '@/lib/content-generation/exam-track-rules';
import { getOpenAIClient } from './client';
import { resolveConfiguredModel } from './model-config';
import { temperatureOption } from './request-options';

export const QUESTION_GENERATOR_MODEL = resolveConfiguredModel('CONTENT_GENERATION_MODEL', 'gpt-4.1-mini');
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
  difficulty: z.enum(['medium', 'hard']),
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
  subtopicId: z.string().uuid().optional().nullable(),
  examTrackName: z.string().min(1),
  officialSourceUrl: z.string().optional().nullable(),
  officialExamDescription: z.string().optional().nullable(),
  topicTitle: z.string().min(1),
  topicDescription: z.string().optional().nullable(),
  topicOfficialBlueprintText: z.string().optional().nullable(),
  topicWeightPercent: z.number().optional().nullable(),
  subtopic: z.string().min(2),
  subtopicDescription: z.string().optional().nullable(),
  subtopicOfficialBlueprintText: z.string().optional().nullable(),
  learningObjective: z.string().min(5),
  blueprintReferenceText: z.string().optional().nullable(),
  socialWorkBlueprintItemId: z.string().uuid().optional().nullable(),
  socialWorkExamLevel: z.enum(['bsw', 'lmsw_msw', 'lcsw_clinical']).optional().nullable(),
  majorContentArea: z.string().optional().nullable(),
  percentageWeight: z.number().optional().nullable(),
  competencySection: z.string().optional().nullable(),
  appliedKnowledgeStatement: z.string().optional().nullable(),
  cognitiveLevelGuidance: z.string().optional().nullable(),
  sampleStyleGuidance: z.string().optional().nullable(),
  intendedCognitiveLevel: z.string().optional().nullable(),
  intendedDifficulty: z.enum(['medium', 'hard']).optional().nullable(),
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

function textValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function normalizeCorrectOption(value: unknown): GeneratedQuestion['correct_option'] {
  const option = String(value || '').trim().toUpperCase();
  return option === 'B' || option === 'C' || option === 'D' ? option : 'A';
}

function normalizeCognitiveLevel(value: unknown): GeneratedQuestion['cognitive_level'] {
  const normalized = String(value || '').trim().toLowerCase();
  if (
    normalized === 'recall'
    || normalized === 'comprehension'
    || normalized === 'application'
    || normalized === 'analysis'
    || normalized === 'clinical judgment'
    || normalized === 'ethics'
    || normalized === 'safety'
    || normalized === 'prioritization'
  ) {
    return normalized;
  }
  return 'application';
}

function normalizeGeneratedQuestion(raw: any, fallback: QuestionGenerationInput): GeneratedQuestion {
  const correctOption = normalizeCorrectOption(raw?.correct_option ?? raw?.answer ?? raw?.correctAnswer);
  const correctRationale = textValue(raw?.correct_rationale, raw?.rationale, raw?.rationale_en, raw?.explanation);
  const optionA = textValue(raw?.option_a, raw?.option_a_en, raw?.options?.a, raw?.options?.A);
  const optionB = textValue(raw?.option_b, raw?.option_b_en, raw?.options?.b, raw?.options?.B);
  const optionC = textValue(raw?.option_c, raw?.option_c_en, raw?.options?.c, raw?.options?.C);
  const optionD = textValue(raw?.option_d, raw?.option_d_en, raw?.options?.d, raw?.options?.D);
  const rationales = raw?.option_rationales || raw?.rationales || {};

  return {
    question: textValue(raw?.question, raw?.question_en, raw?.stem),
    option_a: optionA,
    option_b: optionB,
    option_c: optionC,
    option_d: optionD,
    correct_option: correctOption,
    correct_rationale: correctRationale,
    option_a_rationale: textValue(raw?.option_a_rationale, raw?.option_a_rationale_en, rationales.a, rationales.A, correctOption === 'A' ? correctRationale : `Option A is less appropriate because ${optionA} does not best address the scenario.`),
    option_b_rationale: textValue(raw?.option_b_rationale, raw?.option_b_rationale_en, rationales.b, rationales.B, correctOption === 'B' ? correctRationale : `Option B is less appropriate because ${optionB} does not best address the scenario.`),
    option_c_rationale: textValue(raw?.option_c_rationale, raw?.option_c_rationale_en, rationales.c, rationales.C, correctOption === 'C' ? correctRationale : `Option C is less appropriate because ${optionC} does not best address the scenario.`),
    option_d_rationale: textValue(raw?.option_d_rationale, raw?.option_d_rationale_en, rationales.d, rationales.D, correctOption === 'D' ? correctRationale : `Option D is less appropriate because ${optionD} does not best address the scenario.`),
    test_taking_tip: textValue(raw?.test_taking_tip, raw?.test_taking_tip_en, raw?.tip, 'Identify the best answer by matching the scenario to the stored blueprint objective and eliminating plausible but less direct options.'),
    difficulty: raw?.difficulty === 'hard' ? 'hard' : 'medium',
    cognitive_level: normalizeCognitiveLevel(raw?.cognitive_level ?? raw?.cognitiveLevel ?? fallback.intendedCognitiveLevel),
    topic: textValue(raw?.topic, fallback.topicTitle),
    subtopic: textValue(raw?.subtopic, fallback.subtopic),
    learning_objective: textValue(raw?.learning_objective, raw?.learningObjective, fallback.learningObjective),
    source_topic: textValue(raw?.source_topic, raw?.sourceTopic, raw?.topic, fallback.topicTitle),
  };
}

function normalizeGeneratedResponse(parsedJson: unknown, fallback: QuestionGenerationInput) {
  const raw = parsedJson as any;
  const questions = Array.isArray(raw?.questions)
    ? raw.questions
    : Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.items)
        ? raw.items
        : [];

  return {
    questions: questions.map((question: any) => normalizeGeneratedQuestion(question, fallback)),
  };
}

export async function generateQuestions(input: QuestionGenerationInput): Promise<GeneratedQuestion[]> {
  const parsedInput = questionGenerationInputSchema.parse(input);
  const openai = getOpenAIClient();

  const prompt = `Generate ${parsedInput.quantity} original multiple-choice exam-prep questions.

Exam track:
- id: ${parsedInput.examTrackId}
- name: ${parsedInput.examTrackName}
- official source URL: ${parsedInput.officialSourceUrl || 'Not provided'}
- official exam description: ${parsedInput.officialExamDescription || 'Not provided'}

Topic:
- id: ${parsedInput.topicId}
- title: ${parsedInput.topicTitle}
- description: ${parsedInput.topicDescription || 'Not provided'}
- official blueprint text: ${parsedInput.topicOfficialBlueprintText || 'Not provided'}
- official weight percent: ${parsedInput.topicWeightPercent ?? 'Not provided'}
- subtopic id: ${parsedInput.subtopicId || 'Not provided'}
- subtopic: ${parsedInput.subtopic}
- subtopic description: ${parsedInput.subtopicDescription || 'Not provided'}
- subtopic official blueprint text: ${parsedInput.subtopicOfficialBlueprintText || 'Not provided'}
- learning objective: ${parsedInput.learningObjective}
- blueprint reference text: ${parsedInput.blueprintReferenceText || parsedInput.subtopicOfficialBlueprintText || parsedInput.topicOfficialBlueprintText || 'Not provided'}

Social Work blueprint item, if selected:
- blueprint item id: ${parsedInput.socialWorkBlueprintItemId || 'Not provided'}
- ASWB exam level: ${parsedInput.socialWorkExamLevel || 'Not provided'}
- major content area: ${parsedInput.majorContentArea || 'Not provided'}
- content weight: ${parsedInput.percentageWeight ?? parsedInput.topicWeightPercent ?? 'Not provided'}
- competency section: ${parsedInput.competencySection || 'Not provided'}
- applied knowledge statement: ${parsedInput.appliedKnowledgeStatement || 'Not provided'}
- cognitive level guidance: ${parsedInput.cognitiveLevelGuidance || 'Not provided'}
- sample style guidance: ${parsedInput.sampleStyleGuidance || 'Not provided'}
- intended cognitive level: ${parsedInput.intendedCognitiveLevel || 'Use cognitive mix'}
- intended difficulty: ${parsedInput.intendedDifficulty || 'Use difficulty mix'}

Difficulty mix: ${formatMix(parsedInput.difficultyMix)}
Cognitive level mix: ${formatMix(parsedInput.cognitiveLevelMix)}

Exam-track-specific generation rules:
${formatExamTrackRulesForPrompt(parsedInput.examTrackName)}

ASWB-style Social Work rules when a Social Work blueprint item is provided:
- Treat the selected applied knowledge statement as the source of truth.
- Every Social Work question must directly map to that one applied knowledge statement.
- Use the selected ASWB exam level, major content area, competency section, percentage weight, topic blueprint text, subtopic blueprint text, cognitive guidance, and official blueprint text.
- If any Social Work blueprint field says "Not provided", do not invent missing metadata; return no weak placeholder item.
- Questions may use 3 or 4 answer options in ASWB style, but this application stores four options, so return exactly four high-quality options.
- Use simple wording, one clear best answer, and no trick wording.
- Use qualifiers like BEST, FIRST, NEXT, and MOST where appropriate.
- Never use "all of the above," "none of the above," or "both A and B."
- Questions must be medium or hard only. Do not generate easy questions.
- Medium questions must require application of blueprint knowledge to a practice scenario.
- Hard questions must require reasoning, prioritization, risk assessment, ethical judgment, differential diagnosis, or best-next-step decision-making.
- BSW/Bachelors items should use foundational social work knowledge with more recall and application.
- LMSW/MSW/Masters items should use graduate-level application, reasoning, assessment, planning, intervention, ethics, supervision, community practice, and professional judgment.
- LCSW/Clinical items should emphasize vignette-based reasoning, clinical judgment, assessment, DSM-informed diagnosis, risk assessment, treatment planning, intervention, therapeutic relationship, boundaries, confidentiality, mandated reporting, supervision, and ethical clinical judgment.
- For LCSW/Clinical, rewrite "What is", "Define", or "Which disorder" stems into clinical scenarios. Recall-only items are disabled for this project.
- Do not create generic psychology questions. Keep every LCSW/Clinical question within social work scope and never require prescribing medication or decisions outside social work scope.
- Rationale style must explain why the correct answer is best and why each distractor is less appropriate.
- Distractors must be plausible at the selected Social Work exam level and must not shift to another scope of practice.

Strict alignment and quality rules:
- Do not copy official exam questions.
- Do not reproduce copyrighted test-bank content.
- Generate original educational practice questions only.
- Directly align every question to the selected exam_track_id, topic_id, subtopic, and learning objective.
- Use the provided official blueprint text and blueprint reference text as the source of truth.
- Do not rely on general model memory for blueprint alignment.
- Do not penalize or broaden the item to cover the entire exam domain; focus on the selected topic/subtopic/objective metadata.
- Target blueprint_alignment_score must be 90 or higher.
- Reject internally and regenerate any candidate that is weakly aligned, generic, or off-topic before returning it.
- Match the exact selected exam track scope and expected reasoning level.
- Generate medium or hard questions only. Easy questions are not allowed.
- Do not mix BSW, MSW/LMSW, and LCSW levels.
- Do not mix NCLEX-RN and NCLEX-PN levels.
- Do not create generic healthcare, social work, psychology, nursing, or counseling questions.
- Target professional exam-level difficulty quality of 80 or higher.
- Avoid simple recall. Recall-only stems are disabled for this project.
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
      "difficulty": "medium",
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
    ...temperatureOption(QUESTION_GENERATOR_MODEL, 0.4),
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

  const result = generatedQuestionResponseSchema.safeParse(normalizeGeneratedResponse(parsedJson, parsedInput));
  if (!result.success) {
    throw new Error(`OpenAI response failed validation: ${result.error.message}`);
  }

  return result.data.questions;
}
