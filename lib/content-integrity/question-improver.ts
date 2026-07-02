import type { SupabaseClient } from '@supabase/supabase-js';
import { formatExamTrackRulesForPrompt } from '@/lib/content-generation/exam-track-rules';
import { evaluateQuestionIntegrity, type QuestionContext, type QuestionIntegrityResult } from '@/lib/content-integrity/question-integrity-checker';
import { getOpenAIClient } from '@/lib/openai/client';
import { generatedQuestionSchema, type GeneratedQuestion } from '@/lib/openai/question-generator';
import type { Question } from '@/types/database';

const MAX_IMPROVEMENT_ATTEMPTS = 2;

interface ImprovementMetadata {
  examTrackId: string;
  topicId: string;
  subtopicId?: string | null;
  examTrackName: string;
  officialSourceUrl?: string | null;
  officialExamDescription?: string | null;
  topicTitle: string;
  topicDescription?: string | null;
  topicOfficialBlueprintText?: string | null;
  topicWeightPercent?: number | null;
  subtopic: string;
  subtopicDescription?: string | null;
  subtopicOfficialBlueprintText?: string | null;
  learningObjective: string;
  blueprintReferenceText?: string | null;
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
    subtopic_id: metadata.subtopicId || null,
    blueprint_reference_text: metadata.blueprintReferenceText || metadata.subtopicOfficialBlueprintText || metadata.topicOfficialBlueprintText || null,
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
    examTrack: {
      id: metadata.examTrackId,
      name: metadata.examTrackName,
      full_name: metadata.examTrackName,
      official_source_url: metadata.officialSourceUrl,
      official_exam_description: metadata.officialExamDescription,
    },
    topic: {
      id: metadata.topicId,
      title: metadata.topicTitle,
      description: metadata.topicDescription,
      official_blueprint_text: metadata.topicOfficialBlueprintText,
      official_weight_percent: metadata.topicWeightPercent,
    },
    subtopic: metadata.subtopicId ? {
      id: metadata.subtopicId,
      title: metadata.subtopic,
      description: metadata.subtopicDescription,
      learning_objective: metadata.learningObjective,
      official_blueprint_text: metadata.subtopicOfficialBlueprintText,
    } : null,
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
- Official source URL: ${metadata.officialSourceUrl || 'Not provided'}
- Exam description: ${metadata.officialExamDescription || 'Not provided'}
- Topic id: ${metadata.topicId}
- Topic: ${metadata.topicTitle}
- Topic description: ${metadata.topicDescription || 'Not provided'}
- Topic official blueprint text: ${metadata.topicOfficialBlueprintText || 'Not provided'}
- Topic weight: ${metadata.topicWeightPercent ?? 'Not provided'}
- Subtopic id: ${metadata.subtopicId || 'Not provided'}
- Subtopic: ${metadata.subtopic}
- Subtopic description: ${metadata.subtopicDescription || 'Not provided'}
- Subtopic official blueprint text: ${metadata.subtopicOfficialBlueprintText || 'Not provided'}
- Learning objective: ${metadata.learningObjective}
- Blueprint reference text: ${metadata.blueprintReferenceText || 'Not provided'}
- Intended difficulty: ${question.difficulty}
- Intended cognitive level: ${question.cognitive_level}

Exam-track-specific rewrite rules:
${formatExamTrackRulesForPrompt(metadata.examTrackName)}

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
- Meaningfully rewrite weak items; do not make only small wording edits.
- Keep the same selected exam track, topic, subtopic, learning objective, intended cognitive level, and intended difficulty.
- Judge and improve blueprint alignment only against the provided exam blueprint metadata, not general model knowledge.
- If blueprint_alignment_score is below 90, rewrite the item to more directly test the provided learning objective and blueprint reference text.
- Make the clinical/professional scenario clearly match the provided blueprint text.
- If this is an LCSW recall-style item, rewrite it as a clinical case vignette testing assessment priority, best next step, differential diagnosis, ethical decision-making, risk/safety judgment, or intervention planning.
- If this is an NCLEX-RN item, rewrite it toward clinical judgment, safety, prioritization, delegation, or nursing-process reasoning.
- If this is an NCLEX-PN item, preserve PN scope and use safety/basic care/reporting/escalation reasoning.
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
    .select('*, exam_track:exam_tracks(id, name, full_name, slug, official_source_url, official_exam_description), topic:topics(id, title, description, official_blueprint_text, official_weight_percent), subtopic_record:subtopics(id, title, description, learning_objective, official_blueprint_text)')
    .eq('id', questionId)
    .single();

  if (error || !data) throw new Error(error?.message || 'Question not found.');

  const question = data as Question & {
    exam_track?: NonNullable<QuestionContext['examTrack']>;
    topic?: NonNullable<QuestionContext['topic']>;
    subtopic_record?: QuestionContext['subtopic'];
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
    subtopic: question.subtopic_record,
    existingQuestions: [],
  });

  const metadata: ImprovementMetadata = {
    examTrackId: question.exam_track_id || '',
    topicId: question.topic_id || '',
    subtopicId: question.subtopic_id,
    examTrackName: question.exam_track?.full_name || question.exam_track?.name || 'Selected exam track',
    officialSourceUrl: question.exam_track?.official_source_url,
    officialExamDescription: question.exam_track?.official_exam_description,
    topicTitle: question.topic?.title || question.source_topic || 'Selected topic',
    topicDescription: question.topic?.description,
    topicOfficialBlueprintText: question.topic?.official_blueprint_text,
    topicWeightPercent: question.topic?.official_weight_percent,
    subtopic: firstText(question.subtopic_record?.title, question.subtopic, question.topic?.title, question.source_topic, 'Selected subtopic'),
    subtopicDescription: question.subtopic_record?.description,
    subtopicOfficialBlueprintText: question.subtopic_record?.official_blueprint_text,
    learningObjective: firstText(question.learning_objective, question.subtopic_record?.learning_objective, question.topic?.title ? `Apply ${question.topic.title} to the selected exam track.` : null, 'Apply the selected topic to the selected exam track.'),
    blueprintReferenceText: firstText(
      question.blueprint_reference_text,
      question.subtopic_record?.official_blueprint_text,
      question.topic?.official_blueprint_text,
      question.learning_objective,
      question.subtopic_record?.learning_objective,
      question.subtopic_record?.description,
      question.subtopic_record?.title,
      question.topic?.description,
      question.topic?.title,
      question.subtopic,
      question.source_topic
    ),
  };

  if (!metadata.blueprintReferenceText) {
    throw new Error('Blueprint metadata is missing. Add question blueprint reference text, learning objective, subtopic, source topic, topic description, or topic/subtopic official blueprint text, then rerun integrity check.');
  }

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
      subtopic_id: metadata.subtopicId || null,
      learning_objective: improved.question.learning_objective || metadata.learningObjective,
      source_topic: improved.question.source_topic || improved.question.topic,
      blueprint_reference_text: metadata.blueprintReferenceText || metadata.subtopicOfficialBlueprintText || metadata.topicOfficialBlueprintText || null,
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
