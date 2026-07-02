import type { SupabaseClient } from '@supabase/supabase-js';
import { evaluateQuestionIntegrity, type QuestionContext, type QuestionIntegrityResult } from '@/lib/content-integrity/question-integrity-checker';
import { getOpenAIClient } from '@/lib/openai/client';
import { generatedQuestionSchema, type GeneratedQuestion } from '@/lib/openai/question-generator';
import type { Question } from '@/types/database';

const MAX_IMPROVEMENT_ATTEMPTS = 2;

interface ImprovementMetadata {
  examTrackId: string;
  topicId: string;
  examTrackName: string;
  topicTitle: string;
  subtopic: string;
  learningObjective: string;
}

interface ImproveGeneratedQuestionInput {
  question: GeneratedQuestion;
  metadata: ImprovementMetadata;
  integrityResult: QuestionIntegrityResult;
}

function asQuestion(question: GeneratedQuestion, metadata: ImprovementMetadata): Question {
  return {
    id: 'draft',
    exam_id: null,
    exam_track_id: metadata.examTrackId,
    topic_id: metadata.topicId,
    difficulty: question.difficulty,
    question_en: question.question,
    question_es: '',
    question_fr: '',
    option_a_en: question.option_a,
    option_a_es: '',
    option_a_fr: '',
    option_b_en: question.option_b,
    option_b_es: '',
    option_b_fr: '',
    option_c_en: question.option_c,
    option_c_es: '',
    option_c_fr: '',
    option_d_en: question.option_d,
    option_d_es: '',
    option_d_fr: '',
    correct_option: question.correct_option.toLowerCase() as Question['correct_option'],
    rationale_en: question.correct_rationale,
    rationale_es: '',
    rationale_fr: '',
    subtopic: question.subtopic || metadata.subtopic,
    learning_objective: question.learning_objective || metadata.learningObjective,
    cognitive_level: question.cognitive_level,
    correct_rationale_en: question.correct_rationale,
    option_a_rationale_en: question.option_a_rationale,
    option_b_rationale_en: question.option_b_rationale,
    option_c_rationale_en: question.option_c_rationale,
    option_d_rationale_en: question.option_d_rationale,
    test_taking_tip_en: question.test_taking_tip,
    source_topic: question.source_topic || question.topic,
    duplicate_hash: null,
    quality_score: null,
    review_notes: null,
    generation_batch_id: null,
    generated_by_ai: true,
    integrity_status: 'pending',
    integrity_score: 0,
    quality_flags: [],
    bias_flags: [],
    distractor_flags: [],
    blueprint_alignment_score: 0,
    difficulty_quality_score: 0,
    cognitive_level_detected: null,
    predicted_difficulty: null,
    plagiarism_risk_score: 0,
    integrity_review_notes: null,
    integrity_checked_at: null,
    improvement_attempts: 0,
    auto_improved: false,
    improvement_notes: null,
    integrity_override: false,
    integrity_override_reason: null,
    integrity_override_by: null,
    integrity_override_at: null,
    active: false,
    reviewed: false,
    created_at: new Date().toISOString(),
  };
}

export function evaluateGeneratedQuestionIntegrity(
  question: GeneratedQuestion,
  metadata: ImprovementMetadata,
  existingQuestions: QuestionContext['existingQuestions'] = []
) {
  return evaluateQuestionIntegrity(asQuestion(question, metadata), {
    examTrack: { id: metadata.examTrackId, name: metadata.examTrackName, full_name: metadata.examTrackName },
    topic: { id: metadata.topicId, title: metadata.topicTitle },
    existingQuestions,
  });
}

function formatFlags(result: QuestionIntegrityResult) {
  return [
    ...result.quality_flags.map((flag) => `Quality: ${flag}`),
    ...result.distractor_flags.map((flag) => `Distractor: ${flag}`),
    ...result.bias_flags.map((flag) => `Bias/fairness: ${flag}`),
    result.integrity_review_notes,
  ].filter(Boolean).join('\n');
}

function firstText(...values: Array<string | null | undefined>) {
  return values.find((value) => typeof value === 'string' && value.trim())?.trim() || '';
}

function normalizeGeneratedQuestion(value: any, metadata: ImprovementMetadata): GeneratedQuestion {
  const candidate = {
    ...value,
    topic: firstText(value?.topic, metadata.topicTitle, metadata.subtopic, 'Selected topic'),
    subtopic: firstText(value?.subtopic, metadata.subtopic, metadata.topicTitle, 'Selected subtopic'),
    learning_objective: firstText(value?.learning_objective, metadata.learningObjective, `Apply ${metadata.topicTitle} to the selected exam track.`),
    source_topic: firstText(value?.source_topic, value?.topic, metadata.topicTitle, metadata.subtopic, 'Selected topic'),
  };

  return generatedQuestionSchema.parse(candidate);
}

async function rewriteQuestion(input: ImproveGeneratedQuestionInput) {
  const openai = getOpenAIClient();
  const { question, metadata, integrityResult } = input;

  const prompt = `Rewrite this generated MCQ so it meets the required integrity thresholds before human review.

Preserve exactly:
- Exam track id: ${metadata.examTrackId}
- Exam track name/scope: ${metadata.examTrackName}
- Topic id: ${metadata.topicId}
- Topic: ${metadata.topicTitle}
- Subtopic: ${metadata.subtopic}
- Learning objective: ${metadata.learningObjective}
- Intended difficulty: ${question.difficulty}
- Intended cognitive level: ${question.cognitive_level}

Current scores:
- blueprint_alignment_score: ${integrityResult.blueprint_alignment_score} (target 90+)
- difficulty_quality_score: ${integrityResult.difficulty_quality_score} (target 80+)
- integrity_score: ${integrityResult.integrity_score} (target 85+)
- integrity_status: ${integrityResult.integrity_status}

Problems to fix:
${formatFlags(integrityResult) || 'Improve alignment, reasoning depth, distractor quality, and rationale specificity.'}

Original question JSON:
${JSON.stringify(question, null, 2)}

Rewrite requirements:
- Keep the same selected exam track, topic, subtopic, learning objective, intended cognitive level, and intended difficulty.
- Make the item directly blueprint-aligned and exam-track-specific.
- Do not make it generic.
- Do not switch topics.
- Do not copy official exam content or copyrighted test-bank content.
- Use one clear best answer only.
- Use plausible, non-duplicate distractors.
- Do not use all/none of the above.
- Avoid vague wording, double negatives, and unnecessary absolutes.
- Include detailed rationales for correct and incorrect options.
- Include a test-taking tip.

Return only one JSON object matching the generated question schema.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.25,
    messages: [
      {
        role: 'system',
        content: 'You are a strict professional exam item improver. Rewrite weak items into original, aligned, exam-track-specific MCQs. Output JSON only.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned no improved question content.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('OpenAI returned invalid improved question JSON.');
  }

  try {
    return normalizeGeneratedQuestion(parsed, metadata);
  } catch {
    // Try wrapped shape below.
  }

  try {
    return normalizeGeneratedQuestion((parsed as any)?.question, metadata);
  } catch (err: any) {
    throw new Error(`Improved question failed validation: ${err.message}`);
  }

}

export async function improveGeneratedQuestionOnce(input: ImproveGeneratedQuestionInput) {
  const improvedQuestion = await rewriteQuestion(input);
  const improvedIntegrity = evaluateGeneratedQuestionIntegrity(improvedQuestion, input.metadata);

  return {
    question: improvedQuestion,
    integrityResult: improvedIntegrity,
    improvementNotes: [
      `Before: blueprint ${input.integrityResult.blueprint_alignment_score}, difficulty ${input.integrityResult.difficulty_quality_score}, integrity ${input.integrityResult.integrity_score}, status ${input.integrityResult.integrity_status}.`,
      `After: blueprint ${improvedIntegrity.blueprint_alignment_score}, difficulty ${improvedIntegrity.difficulty_quality_score}, integrity ${improvedIntegrity.integrity_score}, status ${improvedIntegrity.integrity_status}.`,
    ].join('\n'),
  };
}

function storedQuestionToGenerated(question: Question, metadata: ImprovementMetadata): GeneratedQuestion {
  return {
    question: question.question_en,
    option_a: question.option_a_en,
    option_b: question.option_b_en,
    option_c: question.option_c_en,
    option_d: question.option_d_en,
    correct_option: question.correct_option.toUpperCase() as GeneratedQuestion['correct_option'],
    correct_rationale: question.correct_rationale_en || question.rationale_en,
    option_a_rationale: question.option_a_rationale_en || '',
    option_b_rationale: question.option_b_rationale_en || '',
    option_c_rationale: question.option_c_rationale_en || '',
    option_d_rationale: question.option_d_rationale_en || '',
    test_taking_tip: question.test_taking_tip_en || '',
    difficulty: question.difficulty,
    cognitive_level: (question.cognitive_level || 'application') as GeneratedQuestion['cognitive_level'],
    topic: firstText(question.source_topic, metadata.topicTitle, metadata.subtopic, 'Selected topic'),
    subtopic: firstText(question.subtopic, metadata.subtopic, metadata.topicTitle, 'Selected subtopic'),
    learning_objective: firstText(question.learning_objective, metadata.learningObjective, `Apply ${metadata.topicTitle} to the selected exam track.`),
    source_topic: firstText(question.source_topic, metadata.topicTitle, metadata.subtopic, 'Selected topic'),
  };
}

export async function autoImproveStoredQuestion(supabaseAdmin: SupabaseClient, questionId: string) {
  const { checkAndUpdateQuestionIntegrity } = await import('@/lib/content-integrity/question-integrity-checker');
  const { data, error } = await supabaseAdmin
    .from('questions')
    .select('*, exam_track:exam_tracks(id, name, full_name, slug), topic:topics(id, title, description)')
    .eq('id', questionId)
    .single();

  if (error || !data) throw new Error(error?.message || 'Question not found.');

  const question = data as Question & {
    exam_track?: { id: string; name: string | null; full_name?: string | null };
    topic?: { id: string; title: string | null };
  };

  const attempts = question.improvement_attempts || 0;
  if (attempts >= MAX_IMPROVEMENT_ATTEMPTS) {
    await supabaseAdmin
      .from('questions')
      .update({ integrity_status: 'needs_human_review' })
      .eq('id', questionId);
    throw new Error('Auto-improvement limit reached. This question needs human review.');
  }

  const currentIntegrity = evaluateQuestionIntegrity(question, {
    examTrack: question.exam_track,
    topic: question.topic,
    existingQuestions: [],
  });

  const metadata: ImprovementMetadata = {
    examTrackId: question.exam_track_id || '',
    topicId: question.topic_id || '',
    examTrackName: question.exam_track?.full_name || question.exam_track?.name || 'Selected exam track',
    topicTitle: question.topic?.title || question.source_topic || 'Selected topic',
    subtopic: firstText(question.subtopic, question.topic?.title, question.source_topic, 'Selected subtopic'),
    learningObjective: firstText(question.learning_objective, question.topic?.title ? `Apply ${question.topic.title} to the selected exam track.` : null, 'Apply the selected topic to the selected exam track.'),
  };

  const improved = await improveGeneratedQuestionOnce({
    question: storedQuestionToGenerated(question, metadata),
    metadata,
    integrityResult: currentIntegrity,
  });

  const nextAttempts = attempts + 1;
  const improvementNotes = [
    question.improvement_notes,
    `Attempt ${nextAttempts} at ${new Date().toISOString()}`,
    improved.improvementNotes,
  ].filter(Boolean).join('\n\n');

  await supabaseAdmin
    .from('questions')
    .update({
      question_en: improved.question.question,
      option_a_en: improved.question.option_a,
      option_b_en: improved.question.option_b,
      option_c_en: improved.question.option_c,
      option_d_en: improved.question.option_d,
      correct_option: improved.question.correct_option.toLowerCase(),
      rationale_en: improved.question.correct_rationale,
      correct_rationale_en: improved.question.correct_rationale,
      option_a_rationale_en: improved.question.option_a_rationale,
      option_b_rationale_en: improved.question.option_b_rationale,
      option_c_rationale_en: improved.question.option_c_rationale,
      option_d_rationale_en: improved.question.option_d_rationale,
      test_taking_tip_en: improved.question.test_taking_tip,
      difficulty: improved.question.difficulty,
      cognitive_level: improved.question.cognitive_level,
      subtopic: improved.question.subtopic || metadata.subtopic,
      learning_objective: improved.question.learning_objective || metadata.learningObjective,
      source_topic: improved.question.source_topic || improved.question.topic,
      improvement_attempts: nextAttempts,
      auto_improved: true,
      improvement_notes: improvementNotes,
      reviewed: false,
      active: false,
    })
    .eq('id', questionId);

  const checked = await checkAndUpdateQuestionIntegrity(supabaseAdmin, questionId);

  if (
    nextAttempts >= MAX_IMPROVEMENT_ATTEMPTS
    && (
      checked.result.blueprint_alignment_score < 90
      || checked.result.difficulty_quality_score < 80
      || checked.result.integrity_score < 85
    )
  ) {
    const marked = await supabaseAdmin
      .from('questions')
      .update({ integrity_status: 'needs_human_review' })
      .eq('id', questionId)
      .select('*, exam_track:exam_tracks(name, slug), topic:topics(title)')
      .single();

    if (marked.error) throw new Error(marked.error.message);
    return { ...checked, question: marked.data };
  }

  return checked;
}
