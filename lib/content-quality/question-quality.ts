import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GeneratedQuestion } from '@/lib/openai/question-generator';

export interface QuestionQualityContext {
  examTrackId: string;
  topicId: string;
  topicTitle: string;
  subtopic: string;
  learningObjective: string;
  existingQuestions?: Array<{
    question_en: string | null;
    duplicate_hash: string | null;
  }>;
}

export interface QuestionQualityResult {
  accepted: boolean;
  qualityScore: number;
  duplicateHash: string;
  reviewNotes: string[];
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function significantTokens(value: string) {
  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length >= 4)
    .filter((token) => !['question', 'answer', 'client', 'patient', 'which', 'what', 'when', 'where', 'best'].includes(token));
}

function similarity(left: string, right: string) {
  const leftTokens = new Set(significantTokens(left));
  const rightTokens = new Set(significantTokens(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let intersection = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) intersection += 1;
  });

  let union = leftTokens.size;
  rightTokens.forEach((token) => {
    if (!leftTokens.has(token)) union += 1;
  });

  return intersection / union;
}

export function createQuestionDuplicateHash(questionText: string, examTrackId: string) {
  return createHash('sha256')
    .update(`${examTrackId}:${normalizeText(questionText)}`)
    .digest('hex');
}

function hasTopicMatch(question: GeneratedQuestion, context: QuestionQualityContext) {
  const topicTokens = significantTokens(`${context.topicTitle} ${context.subtopic} ${context.learningObjective}`);
  if (topicTokens.length === 0) return true;

  const generatedText = normalizeText(
    [
      question.question,
      question.topic,
      question.subtopic,
      question.learning_objective,
      question.source_topic,
    ].join(' ')
  );

  return topicTokens.some((token) => generatedText.includes(token));
}

function hasObviousMultipleCorrectOptions(question: GeneratedQuestion) {
  const options = [question.option_a, question.option_b, question.option_c, question.option_d].map(normalizeText);
  const correctIndex = ['A', 'B', 'C', 'D'].indexOf(question.correct_option);
  const correct = options[correctIndex];
  if (!correct) return true;

  return options.some((option, index) => {
    if (index === correctIndex) return false;
    return option === correct || similarity(option, correct) >= 0.9;
  });
}

export async function loadExistingQuestionFingerprints(
  supabaseAdmin: SupabaseClient,
  examTrackId: string,
  topicId: string
) {
  const { data, error } = await supabaseAdmin
    .from('questions')
    .select('question_en, duplicate_hash')
    .eq('exam_track_id', examTrackId)
    .eq('topic_id', topicId);

  if (error && error.message.toLowerCase().includes('duplicate_hash')) {
    const fallback = await supabaseAdmin
      .from('questions')
      .select('question_en')
      .eq('exam_track_id', examTrackId)
      .eq('topic_id', topicId);

    if (fallback.error) throw new Error(fallback.error.message);

    return (fallback.data || []).map((question: { question_en: string | null }) => ({
      question_en: question.question_en,
      duplicate_hash: null,
    }));
  }

  if (error) throw new Error(error.message);
  return (data || []) as Array<{ question_en: string | null; duplicate_hash: string | null }>;
}

export function validateQuestionQuality(
  question: GeneratedQuestion,
  context: QuestionQualityContext
): QuestionQualityResult {
  const reviewNotes: string[] = [];
  const duplicateHash = createQuestionDuplicateHash(question.question, context.examTrackId);
  let qualityScore = 100;

  const options = [question.option_a, question.option_b, question.option_c, question.option_d];
  const normalizedOptions = options.map(normalizeText);

  if (normalizeText(question.question).length < 40) {
    reviewNotes.push('Question text is too short.');
    qualityScore -= 25;
  }

  if (options.some((option) => normalizeText(option).length === 0)) {
    reviewNotes.push('One or more answer options are missing.');
    qualityScore -= 40;
  }

  if (new Set(normalizedOptions).size !== normalizedOptions.length) {
    reviewNotes.push('Duplicate answer options detected.');
    qualityScore -= 40;
  }

  if (!['A', 'B', 'C', 'D'].includes(question.correct_option)) {
    reviewNotes.push('Correct option is not A, B, C, or D.');
    qualityScore -= 40;
  }

  if (normalizeText(question.correct_rationale).length < 20) {
    reviewNotes.push('Correct rationale is missing or too short.');
    qualityScore -= 30;
  }

  const rationaleByOption = [
    question.option_a_rationale,
    question.option_b_rationale,
    question.option_c_rationale,
    question.option_d_rationale,
  ];

  if (rationaleByOption.some((rationale) => normalizeText(rationale).length < 10)) {
    reviewNotes.push('One or more wrong-option rationales are missing.');
    qualityScore -= 30;
  }

  if (!hasTopicMatch(question, context)) {
    reviewNotes.push('Question does not appear to match the selected topic.');
    qualityScore -= 35;
  }

  if ((context.existingQuestions || []).some((existing) => existing.duplicate_hash === duplicateHash)) {
    reviewNotes.push('Duplicate hash already exists in the database.');
    qualityScore -= 60;
  }

  if ((context.existingQuestions || []).some((existing) => existing.question_en && similarity(question.question, existing.question_en) >= 0.82)) {
    reviewNotes.push('Question appears too similar to an existing question.');
    qualityScore -= 50;
  }

  if (hasObviousMultipleCorrectOptions(question)) {
    reviewNotes.push('More than one answer option appears obviously correct or duplicated.');
    qualityScore -= 40;
  }

  if (!question.difficulty) {
    reviewNotes.push('Difficulty is missing.');
    qualityScore -= 25;
  }

  if (!question.cognitive_level) {
    reviewNotes.push('Cognitive level is missing.');
    qualityScore -= 25;
  }

  qualityScore = Math.max(0, Math.min(100, qualityScore));

  return {
    accepted: qualityScore >= 80,
    qualityScore,
    duplicateHash,
    reviewNotes,
  };
}
