import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Question } from '@/types/database';

export type IntegrityStatus = 'pending' | 'passed' | 'needs_review' | 'needs_improvement' | 'needs_human_review' | 'failed';
type CognitiveLevel =
  | 'recall'
  | 'comprehension'
  | 'application'
  | 'analysis'
  | 'clinical judgment'
  | 'ethics'
  | 'safety'
  | 'prioritization';

export interface QuestionContext {
  examTrack?: { id: string; name: string | null; full_name?: string | null; slug?: string | null } | null;
  topic?: { id: string; title: string | null; description?: string | null } | null;
  existingQuestions?: Array<{ id: string; question_en: string | null; duplicate_hash: string | null }>;
}

export interface QuestionIntegrityResult {
  integrity_status: IntegrityStatus;
  integrity_score: number;
  quality_flags: string[];
  bias_flags: string[];
  distractor_flags: string[];
  blueprint_alignment_score: number;
  difficulty_quality_score: number;
  cognitive_level_detected: CognitiveLevel;
  predicted_difficulty: 'easy' | 'medium' | 'hard';
  plagiarism_risk_score: number;
  integrity_review_notes: string;
  duplicate_hash: string;
}

const ABSOLUTE_TERMS = /\b(always|never|only|must|all|none|every|completely|totally|guaranteed)\b/i;
const DOUBLE_NEGATIVE = /\b(no|not|never|none|without)\b.{0,45}\b(no|not|never|none|without|except|unless)\b/i;
const VAGUE_WORDING = /\b(generally|usually|often|sometimes|may|might|could|somewhat|probably|best thing|appropriate thing)\b/i;
const DEMOGRAPHIC_REFERENCES = /\b(race|racial|ethnic|ethnicity|religion|religious|nationality|immigrant|disabled|disability|elderly|young woman|young man|gender|male|female|poor|wealthy|low-income)\b/i;
const STEREOTYPE_OR_IDIOM = /\b(you guys|crazy|insane|addict|clean and sober|pull yourself up|third world|illegal alien|normal person)\b/i;
const CLINICAL_CONTEXT = /\b(client|patient|student|family|caregiver|case|therapy|assessment|diagnosis|treatment|intervention|symptom|school|hospital|clinic|nurse|social worker)\b/i;

function normalizeText(value: string | null | undefined) {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string | null | undefined) {
  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length >= 4)
    .filter((token) => ![
      'question',
      'answer',
      'which',
      'what',
      'when',
      'where',
      'client',
      'patient',
      'should',
      'would',
      'could',
      'most',
      'best',
      'appropriate',
    ].includes(token));
}

function similarity(left: string | null | undefined, right: string | null | undefined) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  if (!leftTokens.size || !rightTokens.size) return 0;

  let intersection = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) intersection += 1;
  });

  let union = leftTokens.size;
  rightTokens.forEach((token) => {
    if (!leftTokens.has(token)) union += 1;
  });
  return union ? intersection / union : 0;
}

export function createQuestionDuplicateHash(questionText: string | null | undefined, examTrackId: string | null | undefined) {
  return createHash('sha256')
    .update(`${examTrackId || 'unknown'}:${normalizeText(questionText)}`)
    .digest('hex');
}

function questionOptions(question: Question) {
  return [
    question.option_a_en,
    question.option_b_en,
    question.option_c_en,
    question.option_d_en,
  ];
}

function correctOptionText(question: Question) {
  const index = ['a', 'b', 'c', 'd'].indexOf(question.correct_option);
  return questionOptions(question)[index] || '';
}

function evaluateQuality(question: Question) {
  const flags: string[] = [];
  const stem = question.question_en || '';
  const normalizedStem = normalizeText(stem);
  const wordCount = normalizedStem ? normalizedStem.split(' ').length : 0;

  if (wordCount < 8) flags.push('Question stem appears too short or unclear.');
  if (wordCount > 95) flags.push('Question stem may be excessively complex.');
  if (VAGUE_WORDING.test(stem)) flags.push('Question contains vague wording that may weaken precision.');
  if (DOUBLE_NEGATIVE.test(stem)) flags.push('Question may contain a double negative.');
  if (ABSOLUTE_TERMS.test(stem)) flags.push('Question uses absolute terms such as always, never, only, must, all, or none.');
  if (!/[?]$/.test(stem.trim()) && !/\b(select|identify|choose|determine)\b/i.test(stem)) flags.push('Question stem may not clearly ask a task.');
  if (!question.rationale_en && !question.correct_rationale_en) flags.push('Correct-answer rationale is missing.');
  if (!question.learning_objective) flags.push('Learning objective is missing.');
  if (!CLINICAL_CONTEXT.test(stem) && /lcsw|nclex|clinical|social|nursing|psychology|counsel/i.test([
    question.source_topic,
    question.learning_objective,
    question.subtopic,
  ].join(' '))) {
    flags.push('Question may be missing clinical or professional context.');
  }

  return flags;
}

function evaluateDistractors(question: Question) {
  const flags: string[] = [];
  const options = questionOptions(question);
  const normalizedOptions = options.map(normalizeText);
  const correct = correctOptionText(question);
  const correctNormalized = normalizeText(correct);

  if (options.some((option) => normalizeText(option).length === 0)) flags.push('One or more answer choices are missing.');
  if (new Set(normalizedOptions).size !== normalizedOptions.length) flags.push('Duplicate answer choices detected.');
  if (options.some((option) => /\b(all of the above|none of the above|both a and b|do nothing)\b/i.test(option))) {
    flags.push('One or more distractors may be too obvious or test-wise.');
  }

  const similarToCorrect = normalizedOptions.filter((option) => option && option !== correctNormalized && similarity(option, correctNormalized) >= 0.7);
  if (similarToCorrect.length) flags.push('One or more distractors are too similar to the correct answer.');

  const lengths = options.map((option) => normalizeText(option).length).filter(Boolean);
  const shortest = Math.min(...lengths);
  const longest = Math.max(...lengths);
  if (shortest > 0 && longest / shortest >= 2.6) flags.push('Answer choices have unequal length that may cue the correct answer.');

  if (question.correct_option === 'a' || question.correct_option === 'd') {
    flags.push('Correct answer position should be monitored for pattern bias across the batch.');
  }

  return flags;
}

function evaluateBlueprintAlignment(question: Question, context: QuestionContext) {
  const questionText = [
    question.question_en,
    ...questionOptions(question),
    question.rationale_en,
    question.correct_rationale_en,
  ].join(' ');
  const questionNormalized = normalizeText(questionText);
  const scoreParts = [
    { text: `${context.topic?.title || ''} ${context.topic?.description || ''}`, weight: 30 },
    { text: question.subtopic || '', weight: 25 },
    { text: question.learning_objective || '', weight: 35 },
    { text: `${context.examTrack?.name || ''} ${context.examTrack?.full_name || ''} ${question.source_topic || ''}`, weight: 10 },
  ];

  let availableWeight = 0;
  let score = 0;

  scoreParts.forEach((part) => {
    const tokens = tokenize(part.text);
    if (!tokens.length) return;
    availableWeight += part.weight;
    const matched = tokens.filter((token) => questionNormalized.includes(token)).length;
    score += Math.min(1, matched / Math.min(tokens.length, 4)) * part.weight;
  });

  if (!availableWeight) return 75;
  return Math.round(Math.max(35, Math.min(100, (score / availableWeight) * 100)));
}

function detectCognitiveLevel(question: Question): CognitiveLevel {
  const text = normalizeText(`${question.question_en} ${question.learning_objective || ''} ${question.cognitive_level || ''}`);
  if (/\b(ethic|confidential|consent|boundary|mandated|duty|legal)\b/.test(text)) return 'ethics';
  if (/\b(safety|suicide|harm|abuse|danger|emergency|risk)\b/.test(text)) return 'safety';
  if (/\b(first|priority|prioritize|immediate|initial)\b/.test(text)) return 'prioritization';
  if (/\b(clinical judgment|most appropriate intervention|best next step|assessment|diagnosis|treatment plan)\b/.test(text)) return 'clinical judgment';
  if (/\b(analyze|differentiate|compare|evaluate|interpret)\b/.test(text)) return 'analysis';
  if (/\b(apply|scenario|case|intervention|response)\b/.test(text)) return 'application';
  if (/\b(explain|understand|describe|identify)\b/.test(text)) return 'comprehension';
  return 'recall';
}

function predictDifficulty(question: Question, cognitiveLevel: CognitiveLevel) {
  const wordCount = tokenize(`${question.question_en} ${question.rationale_en}`).length;
  if (['analysis', 'clinical judgment', 'prioritization', 'safety'].includes(cognitiveLevel) || wordCount > 80) return 'hard';
  if (['application', 'ethics', 'comprehension'].includes(cognitiveLevel) || wordCount > 45) return 'medium';
  return 'easy';
}

function evaluateBias(question: Question) {
  const flags: string[] = [];
  const text = [
    question.question_en,
    ...questionOptions(question),
    question.rationale_en,
  ].join(' ');

  if (DEMOGRAPHIC_REFERENCES.test(text)) {
    flags.push('Question includes demographic references; verify they are necessary and fair.');
  }
  if (STEREOTYPE_OR_IDIOM.test(text)) {
    flags.push('Question may contain culturally specific idioms, stigmatizing language, or regional phrasing.');
  }

  return flags;
}

function evaluatePlagiarismRisk(question: Question, context: QuestionContext, duplicateHash: string) {
  const existing = context.existingQuestions || [];
  if (existing.some((item) => item.id !== question.id && item.duplicate_hash === duplicateHash)) return 100;

  const maxSimilarity = existing.reduce((max, item) => {
    if (item.id === question.id) return max;
    return Math.max(max, similarity(question.question_en, item.question_en));
  }, 0);

  if (maxSimilarity >= 0.88) return 85;
  if (maxSimilarity >= 0.74) return 70;
  if (maxSimilarity >= 0.6) return 45;
  return 10;
}

function cognitiveLevelMatches(question: Question, detected: CognitiveLevel) {
  const intended = normalizeText(question.cognitive_level);
  if (!intended) return true;
  if (intended.includes(detected)) return true;
  if (intended.includes('application') && ['application', 'clinical judgment', 'prioritization'].includes(detected)) return true;
  if (intended.includes('analysis') && ['analysis', 'clinical judgment', 'prioritization', 'safety'].includes(detected)) return true;
  return false;
}

function isTooLowForTrack(question: Question, context: QuestionContext, detected: CognitiveLevel) {
  const trackText = normalizeText(`${context.examTrack?.name || ''} ${context.examTrack?.full_name || ''}`);
  if (!/(lcsw|nclex|eppp|ccm|nce|clinical|licen)/.test(trackText)) return false;
  return detected === 'recall' && /hard|medium/.test(question.difficulty || '');
}

function evaluateDifficultyQuality(question: Question, context: QuestionContext, detected: CognitiveLevel, predictedDifficulty: 'easy' | 'medium' | 'hard') {
  let score = 100;
  const stemTokens = tokenize(question.question_en);
  const intended = question.difficulty || 'medium';

  if (predictedDifficulty !== intended) score -= 20;
  if (isTooLowForTrack(question, context, detected)) score -= 35;
  if ((intended === 'medium' || intended === 'hard') && detected === 'recall') score -= 30;
  if (intended === 'hard' && !['analysis', 'clinical judgment', 'safety', 'prioritization', 'ethics'].includes(detected)) score -= 20;
  if (stemTokens.length < 25 && intended !== 'easy') score -= 15;
  if (!/\b(case|client|patient|scenario|first|priority|best|most appropriate|assessment|intervention|response)\b/i.test(question.question_en) && detected !== 'recall') {
    score -= 15;
  }

  return Math.max(0, Math.min(100, score));
}

export function evaluateQuestionIntegrity(question: Question, context: QuestionContext = {}): QuestionIntegrityResult {
  const duplicateHash = createQuestionDuplicateHash(question.question_en, question.exam_track_id);
  const qualityFlags = evaluateQuality(question);
  const distractorFlags = evaluateDistractors(question);
  const blueprintAlignmentScore = evaluateBlueprintAlignment(question, context);
  const cognitiveLevelDetected = detectCognitiveLevel(question);
  const predictedDifficulty = predictDifficulty(question, cognitiveLevelDetected);
  const difficultyQualityScore = evaluateDifficultyQuality(question, context, cognitiveLevelDetected, predictedDifficulty);
  const biasFlags = evaluateBias(question);
  const plagiarismRiskScore = evaluatePlagiarismRisk(question, context, duplicateHash);
  const notes: string[] = [];

  if (blueprintAlignmentScore < 90) notes.push('Question is below the 90+ blueprint alignment target and should be improved before human review.');
  if (difficultyQualityScore < 80) notes.push('Question is below the 80+ professional difficulty quality target and should be improved.');
  if (!cognitiveLevelMatches(question, cognitiveLevelDetected)) notes.push('Detected cognitive level does not clearly match the intended cognitive level.');
  if (isTooLowForTrack(question, context, cognitiveLevelDetected)) notes.push('Question may be too low-level for this exam track.');
  if (predictedDifficulty !== question.difficulty) notes.push(`Predicted difficulty (${predictedDifficulty}) differs from intended difficulty (${question.difficulty}).`);
  if (plagiarismRiskScore > 70) notes.push('Question has high similarity to existing content and needs originality review.');
  if (biasFlags.length) notes.push('Bias/fairness flags require human review.');

  const itemWritingPoints = Math.max(0, 25 - qualityFlags.length * 5);
  const distractorPoints = Math.max(0, 20 - distractorFlags.length * 5);
  const blueprintPoints = Math.round((blueprintAlignmentScore / 100) * 20);
  const cognitivePoints = cognitiveLevelMatches(question, cognitiveLevelDetected) && !isTooLowForTrack(question, context, cognitiveLevelDetected) ? 10 : 4;
  const difficultyPoints = predictedDifficulty === question.difficulty ? 10 : 5;
  const biasPoints = biasFlags.length ? 4 : 10;
  const originalityPoints = plagiarismRiskScore > 70 ? 0 : plagiarismRiskScore >= 45 ? 2 : 5;
  const integrityScore = Math.max(0, Math.min(100, itemWritingPoints + distractorPoints + blueprintPoints + cognitivePoints + difficultyPoints + biasPoints + originalityPoints));

  let status: IntegrityStatus = 'passed';

  if (plagiarismRiskScore > 70) status = 'failed';
  else if (blueprintAlignmentScore < 90 || difficultyQualityScore < 80) status = 'needs_improvement';
  else if (integrityScore < 75) status = 'needs_improvement';
  else if (integrityScore < 85) status = 'needs_review';
  if (biasFlags.length && status === 'passed') status = 'needs_review';

  return {
    integrity_status: status,
    integrity_score: integrityScore,
    quality_flags: qualityFlags,
    bias_flags: biasFlags,
    distractor_flags: distractorFlags,
    blueprint_alignment_score: blueprintAlignmentScore,
    difficulty_quality_score: difficultyQualityScore,
    cognitive_level_detected: cognitiveLevelDetected,
    predicted_difficulty: predictedDifficulty,
    plagiarism_risk_score: plagiarismRiskScore,
    integrity_review_notes: notes.join('\n'),
    duplicate_hash: duplicateHash,
  };
}

export async function checkAndUpdateQuestionIntegrity(supabaseAdmin: SupabaseClient, questionId: string) {
  const { data: question, error: questionError } = await supabaseAdmin
    .from('questions')
    .select('*, exam_track:exam_tracks(id, name, full_name, slug), topic:topics(id, title, description)')
    .eq('id', questionId)
    .single();

  if (questionError || !question) {
    throw new Error(questionError?.message || 'Question not found.');
  }

  const typedQuestion = question as Question & {
    exam_track?: QuestionContext['examTrack'];
    topic?: QuestionContext['topic'];
  };

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('questions')
    .select('id, question_en, duplicate_hash')
    .eq('exam_track_id', typedQuestion.exam_track_id)
    .limit(1000);

  if (existingError) throw new Error(existingError.message);

  const result = evaluateQuestionIntegrity(typedQuestion, {
    examTrack: typedQuestion.exam_track,
    topic: typedQuestion.topic,
    existingQuestions: (existing || []) as QuestionContext['existingQuestions'],
  });

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('questions')
    .update({
      integrity_status: result.integrity_status,
      integrity_score: result.integrity_score,
      quality_flags: result.quality_flags,
      bias_flags: result.bias_flags,
      distractor_flags: result.distractor_flags,
      blueprint_alignment_score: result.blueprint_alignment_score,
      difficulty_quality_score: result.difficulty_quality_score,
      cognitive_level_detected: result.cognitive_level_detected,
      predicted_difficulty: result.predicted_difficulty,
      plagiarism_risk_score: result.plagiarism_risk_score,
      integrity_review_notes: result.integrity_review_notes,
      integrity_checked_at: new Date().toISOString(),
      duplicate_hash: typedQuestion.duplicate_hash || result.duplicate_hash,
    })
    .eq('id', questionId)
    .select('*, exam_track:exam_tracks(name, slug), topic:topics(title)')
    .single();

  if (updateError) throw new Error(updateError.message);
  return { result, question: updated };
}
