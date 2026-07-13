import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { buildBlueprintContext, formatBlueprintContextForPrompt, type BlueprintContext } from '@/lib/blueprint/blueprint-context-builder';
import { checkAndUpdateQuestionIntegrity } from '@/lib/content-integrity/question-integrity-checker';
import { INTEGRITY_THRESHOLDS } from '@/lib/content-integrity/integrity-gates';
import { getOpenAIClient } from '@/lib/openai/client';
import { resolveConfiguredModel } from '@/lib/openai/model-config';
import { temperatureOption } from '@/lib/openai/request-options';
import type { Question } from '@/types/database';

export const EDITORIAL_MODELS = {
  blueprint: resolveConfiguredModel('CONTENT_BLUEPRINT_REVIEW_MODEL', 'gpt-4.1'),
  difficulty: resolveConfiguredModel('CONTENT_DIFFICULTY_MODEL', 'gpt-4.1'),
  distractor: resolveConfiguredModel('CONTENT_DISTRACTOR_MODEL', 'gpt-4.1'),
  psychometric: resolveConfiguredModel('CONTENT_PSYCHOMETRIC_MODEL', 'gpt-4.1'),
  bias: resolveConfiguredModel('CONTENT_BIAS_MODEL', 'gpt-4.1'),
  security: resolveConfiguredModel('CONTENT_SECURITY_MODEL', 'gpt-4.1'),
  rewrite: resolveConfiguredModel('CONTENT_REWRITE_MODEL', 'gpt-4.1'),
  final: resolveConfiguredModel('CONTENT_FINAL_REVIEW_MODEL', 'gpt-4.1'),
  committee: resolveConfiguredModel('CONTENT_COMMITTEE_MODEL', 'gpt-4.1'),
};

const scoreSchema: z.ZodType<number, z.ZodTypeDef, unknown> = z.preprocess(
  (value) => normalizeScore(value),
  z.number().int().min(0).max(100)
);
const flexibleStringSchema = z.preprocess((value) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}, z.string().optional());

const reviewerSchema = z.object({
  score: scoreSchema.optional(),
  blueprint_alignment_score: scoreSchema.optional(),
  difficulty_quality_score: scoreSchema.optional(),
  distractor_score: scoreSchema.optional(),
  rationale_score: scoreSchema.optional(),
  psychometric_score: scoreSchema.optional(),
  bias_score: scoreSchema.optional(),
  security_score: scoreSchema.optional(),
  plagiarism_risk_score: scoreSchema.optional(),
  detected_cognitive_level: z.string().optional(),
  explanation: z.string().default(''),
  similarity_notes: flexibleStringSchema,
  failure_reasons: z.array(z.string()).default([]),
  rewrite_recommendations: z.array(z.string()).default([]),
  bias_flags: z.array(z.string()).default([]),
});

const finalReviewSchema = z.object({
  final_blueprint_score: scoreSchema,
  final_difficulty_score: scoreSchema,
  final_distractor_score: scoreSchema,
  final_psychometric_score: scoreSchema,
  final_bias_score: scoreSchema,
  final_security_score: scoreSchema,
  final_integrity_score: scoreSchema,
  final_status: z.enum(['passed', 'needs_improvement', 'needs_human_review', 'needs_metadata', 'rejected']),
  explanation: z.string().default(''),
  failure_reasons: z.array(z.string()).default([]),
  rewrite_recommendations: z.array(z.string()).default([]),
});

const committeeReviewSchema = z.object({
  role: z.string(),
  vote: z.enum(['approve', 'revise', 'reject']),
  score: scoreSchema,
  reason: z.string(),
  required_changes: z.array(z.string()).default([]),
});

const rewrittenQuestionSchema = z.object({
  question_en: z.string().min(40),
  option_a_en: z.string().min(1),
  option_b_en: z.string().min(1),
  option_c_en: z.string().min(1),
  option_d_en: z.string().min(1),
  correct_option: z.enum(['a', 'b', 'c', 'd']),
  rationale_en: z.string().min(20),
  correct_rationale_en: z.string().min(20),
  option_a_rationale_en: z.string().min(10),
  option_b_rationale_en: z.string().min(10),
  option_c_rationale_en: z.string().min(10),
  option_d_rationale_en: z.string().min(10),
  test_taking_tip_en: z.string().min(10),
  difficulty: z.enum(['medium', 'hard']),
  cognitive_level: z.string().min(1),
  subtopic: z.string().min(1),
  learning_objective: z.string().min(1),
  source_topic: z.string().min(1),
});

function questionForPrompt(question: Question) {
  return {
    id: question.id,
    question_en: question.question_en,
    option_a_en: question.option_a_en,
    option_b_en: question.option_b_en,
    option_c_en: question.option_c_en,
    option_d_en: question.option_d_en,
    correct_option: question.correct_option,
    rationale_en: question.rationale_en,
    correct_rationale_en: question.correct_rationale_en,
    option_a_rationale_en: question.option_a_rationale_en,
    option_b_rationale_en: question.option_b_rationale_en,
    option_c_rationale_en: question.option_c_rationale_en,
    option_d_rationale_en: question.option_d_rationale_en,
    test_taking_tip_en: question.test_taking_tip_en,
    difficulty: question.difficulty,
    cognitive_level: question.cognitive_level,
    subtopic: question.subtopic,
    learning_objective: question.learning_objective,
    source_topic: question.source_topic,
  };
}

function allFailureReasons(results: Record<string, any>) {
  return Object.values(results).flatMap((result) => Array.isArray(result.failure_reasons) ? result.failure_reasons : []);
}

function allRewriteRecommendations(results: Record<string, any>) {
  return Object.values(results).flatMap((result) => Array.isArray(result.rewrite_recommendations) ? result.rewrite_recommendations : []);
}

function integrityScoreFromScores(scores: {
  blueprint: number;
  difficulty: number;
  distractor: number;
  rationale: number;
  psychometric: number;
  bias: number;
  security: number;
}) {
  const distractorRationale = Math.min(scores.distractor, scores.rationale);
  return Math.round(
    (scores.blueprint * 0.25)
    + (scores.difficulty * 0.20)
    + (distractorRationale * 0.15)
    + (scores.psychometric * 0.20)
    + (scores.bias * 0.10)
    + (scores.security * 0.10)
  );
}

function normalizeScore(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const score = numeric > 0 && numeric <= 1 ? numeric * 100 : numeric;
  return Math.max(0, Math.min(100, Math.round(score)));
}

async function fetchQuestion(supabaseAdmin: SupabaseClient, questionId: string) {
  const { data, error } = await supabaseAdmin
    .from('questions')
    .select('*')
    .eq('id', questionId)
    .single();

  if (error || !data) throw new Error(error?.message || 'Question not found.');
  return data as Question;
}

async function contextForQuestion(supabaseAdmin: SupabaseClient, question: Question) {
  const context = await buildBlueprintContext(supabaseAdmin, {
    examTrackId: question.exam_track_id || '',
    topicId: question.topic_id || '',
    subtopicId: question.subtopic_id,
    socialWorkBlueprintItemId: question.social_work_blueprint_item_id,
    difficultyTarget: question.difficulty,
    cognitiveLevelTarget: question.intended_cognitive_level || question.cognitive_level,
  });
  return context;
}

async function callJsonModel<T>(
  model: string,
  system: string,
  prompt: string,
  schema: z.ZodType<T>
): Promise<T> {
  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model,
    ...temperatureOption(model, 0.15),
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error(`${model} returned no content.`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`${model} returned invalid JSON.`);
  }

  return schema.parse(parsed);
}

async function runReviewer(
  role: string,
  model: string,
  context: BlueprintContext,
  question: Question,
  instructions: string
) {
  return callJsonModel(
    model,
    `${role}. Use only the supplied BlueprintContext and question. Output JSON only.`,
    `${formatBlueprintContextForPrompt(context)}

Question:
${JSON.stringify(questionForPrompt(question), null, 2)}

${instructions}`,
    reviewerSchema
  );
}

export async function runEditorialReview(supabaseAdmin: SupabaseClient, questionId: string, modelName = EDITORIAL_MODELS.blueprint) {
  const question = await fetchQuestion(supabaseAdmin, questionId);
  const context = await contextForQuestion(supabaseAdmin, question);

  if (context.missingMetadata.length) {
    await supabaseAdmin
      .from('questions')
      .update({
        integrity_status: 'needs_metadata',
        failure_reasons: context.missingMetadata.map((field) => `Missing blueprint metadata: ${field}`),
        editorial_review: { missingMetadata: context.missingMetadata },
      })
      .eq('id', questionId);
    return { status: 'needs_metadata', missingMetadata: context.missingMetadata };
  }

  const [blueprint, difficulty, distractor, psychometric, bias, security] = await Promise.all([
    runReviewer('Blueprint SME Reviewer', modelName, context, question, `Evaluate only exam track, major content area, competency section, applied knowledge statement, learning objective, topic/subtopic alignment.
Return: blueprint_alignment_score, explanation, failure_reasons, rewrite_recommendations.`),
    runReviewer('Difficulty and Cognitive Reviewer', modelName, context, question, `Evaluate only difficulty, cognitive level, application, reasoning, clinical judgment, prioritization, risk, ethics, and best-next-step thinking.
Easy questions fail. Return: difficulty_quality_score, detected_cognitive_level, explanation, failure_reasons, rewrite_recommendations.`),
    runReviewer('Distractor and Rationale Reviewer', modelName, context, question, `Evaluate distractor plausibility, duplicate answers, obvious wrong answers, multiple correct answers, cueing, correct rationale quality, and wrong-answer rationale quality.
Return: distractor_score, rationale_score, explanation, failure_reasons, rewrite_recommendations.`),
    runReviewer('Psychometrician Reviewer', modelName, context, question, `Evaluate construct validity, expected discrimination, ambiguity, candidate reasoning, cueing, estimated item performance, and whether it distinguishes competent from non-competent candidates.
Return: psychometric_score, explanation, failure_reasons, rewrite_recommendations.`),
    runReviewer('Bias and Fairness Reviewer', modelName, context, question, `Evaluate cultural, gender, age, disability, socioeconomic bias, unnecessary demographics, and fairness.
Return: bias_score, bias_flags, failure_reasons, rewrite_recommendations.`),
    runReviewer('Security and Originality Reviewer', modelName, context, question, `Evaluate duplicate risk, copyright risk, similarity to existing bank or official-style sample items, and originality.
Return: security_score, plagiarism_risk_score, similarity_notes, failure_reasons, rewrite_recommendations.`),
  ]);

  const scores = {
    blueprint: normalizeScore(blueprint.blueprint_alignment_score ?? blueprint.score ?? 0),
    difficulty: normalizeScore(difficulty.difficulty_quality_score ?? difficulty.score ?? 0),
    distractor: normalizeScore(distractor.distractor_score ?? distractor.score ?? 0),
    rationale: normalizeScore(distractor.rationale_score ?? distractor.score ?? 0),
    psychometric: normalizeScore(psychometric.psychometric_score ?? psychometric.score ?? 0),
    bias: normalizeScore(bias.bias_score ?? bias.score ?? 0),
    security: normalizeScore(security.security_score ?? security.score ?? 0),
  };
  const plagiarismRiskScore = normalizeScore(security.plagiarism_risk_score ?? question.plagiarism_risk_score ?? 0);
  const integrityScore = integrityScoreFromScores(scores);
  const failureReasons = allFailureReasons({ blueprint, difficulty, distractor, psychometric, bias, security });
  const rewriteRecommendations = allRewriteRecommendations({ blueprint, difficulty, distractor, psychometric, bias, security });
  const passed = scores.blueprint >= INTEGRITY_THRESHOLDS.blueprintAlignment
    && scores.difficulty >= INTEGRITY_THRESHOLDS.difficultyQuality
    && scores.distractor >= 85
    && scores.rationale >= 85
    && scores.psychometric >= 85
    && scores.bias >= 90
    && scores.security >= 90
    && integrityScore >= INTEGRITY_THRESHOLDS.overallIntegrity;

  const attempts = question.improvement_attempts || 0;
  const status = passed ? 'passed' : attempts >= 2 ? 'needs_human_review' : 'needs_improvement';

  const { data: updated, error } = await supabaseAdmin
    .from('questions')
    .update({
      blueprint_alignment_score: scores.blueprint,
      difficulty_quality_score: scores.difficulty,
      distractor_score: scores.distractor,
      rationale_score: scores.rationale,
      psychometric_score: scores.psychometric,
      bias_score: scores.bias,
      security_score: scores.security,
      plagiarism_risk_score: plagiarismRiskScore,
      bias_flags: bias.bias_flags || [],
      integrity_score: integrityScore,
      integrity_status: status,
      failure_reasons: failureReasons,
      rewrite_recommendations: rewriteRecommendations,
      editorial_review: { blueprint, difficulty, distractor, psychometric, bias, security },
      integrity_review_notes: failureReasons.join('\n') || 'Editorial review passed.',
      integrity_checked_at: new Date().toISOString(),
    })
    .eq('id', questionId)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return { status, scores, integrityScore, failureReasons, rewriteRecommendations, question: updated };
}

export async function autoRewriteQuestion(supabaseAdmin: SupabaseClient, questionId: string, committeeChanges: string[] = [], modelName = EDITORIAL_MODELS.rewrite) {
  const question = await fetchQuestion(supabaseAdmin, questionId);
  const context = await contextForQuestion(supabaseAdmin, question);
  if (context.missingMetadata.length) {
    await supabaseAdmin.from('questions').update({ integrity_status: 'needs_metadata' }).eq('id', questionId);
    return { status: 'needs_metadata', missingMetadata: context.missingMetadata };
  }

  const attempts = question.improvement_attempts || 0;
  if (attempts >= 2) {
    await supabaseAdmin.from('questions').update({ integrity_status: 'needs_human_review' }).eq('id', questionId);
    throw new Error('Auto-rewrite limit reached. Manual review is required.');
  }

  const reviewerContext = {
    editorial_review: (question as any).editorial_review || {},
    failure_reasons: (question as any).failure_reasons || question.quality_flags || [],
    rewrite_recommendations: [
      ...(((question as any).rewrite_recommendations || []) as string[]),
      ...committeeChanges,
    ],
  };

  const rewritten = await callJsonModel(
    modelName,
    'You are the GPT rewrite engine. Do not review. Rewrite the question to directly address every failure reason. Output JSON only.',
    `${formatBlueprintContextForPrompt(context)}

Original question:
${JSON.stringify(questionForPrompt(question), null, 2)}

Reviewer outputs and required changes:
${JSON.stringify(reviewerContext, null, 2)}

Rewrite rules:
- Directly address every failure reason.
- Do not merely rephrase.
- If blueprint failure, tie directly to the applied knowledge statement.
- If difficulty failure, make the scenario more application or reasoning based.
- If LCSW and recall, rewrite into a clinical vignette.
- If distractor failure, rewrite distractors.
- If rationale failure, expand rationales.
- If bias failure, remove irrelevant demographic assumptions.
- If security failure, create a different scenario.
- Preserve exam track, topic, subtopic, applied knowledge statement, difficulty target, and cognitive target.
- Medium or hard only.

Return one JSON object with question_en, option_a_en, option_b_en, option_c_en, option_d_en, correct_option, rationale_en, correct_rationale_en, option_a_rationale_en, option_b_rationale_en, option_c_rationale_en, option_d_rationale_en, test_taking_tip_en, difficulty, cognitive_level, subtopic, learning_objective, source_topic.`,
    rewrittenQuestionSchema
  );

  const { count } = await supabaseAdmin
    .from('question_revisions')
    .select('id', { count: 'exact', head: true })
    .eq('question_id', questionId);
  const revisionNumber = (count || 0) + 1;

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('questions')
    .update({
      ...rewritten,
      correct_option: rewritten.correct_option,
      improvement_attempts: attempts + 1,
      auto_improved: true,
      improvement_notes: [
        question.improvement_notes,
        `Rewrite attempt ${attempts + 1} at ${new Date().toISOString()} using ${modelName}.`,
      ].filter(Boolean).join('\n\n'),
      reviewed: false,
      active: false,
      committee_status: 'pending',
      final_review_status: 'pending',
    })
    .eq('id', questionId)
    .select('*')
    .single();

  if (updateError) throw new Error(updateError.message);

  const { error: revisionError } = await supabaseAdmin.from('question_revisions').insert({
    question_id: questionId,
    revision_number: revisionNumber,
    revision_type: committeeChanges.length ? 'committee_rewrite' : 'auto_rewrite',
    previous_question: questionForPrompt(question),
    revised_question: rewritten,
    failure_reasons: reviewerContext.failure_reasons,
    improvement_notes: `Rewrite attempt ${attempts + 1}.`,
    model_used: modelName,
  });
  if (revisionError) throw new Error(revisionError.message);

  return { status: 'rewritten', question: updated, revisionNumber };
}

export async function runFinalReview(supabaseAdmin: SupabaseClient, questionId: string, modelName = EDITORIAL_MODELS.final) {
  const question = await fetchQuestion(supabaseAdmin, questionId);
  const context = await contextForQuestion(supabaseAdmin, question);
  if (context.missingMetadata.length) {
    await supabaseAdmin.from('questions').update({ integrity_status: 'needs_metadata' }).eq('id', questionId);
    return { status: 'needs_metadata', missingMetadata: context.missingMetadata };
  }

  const finalReview = await callJsonModel(
    modelName,
    'You are an independent final GPT reviewer. You receive no prior scores. Output JSON only.',
    `${formatBlueprintContextForPrompt(context)}

Final question:
${JSON.stringify(questionForPrompt(question), null, 2)}

Evaluate independently and output final_blueprint_score, final_difficulty_score, final_distractor_score, final_psychometric_score, final_bias_score, final_security_score, final_integrity_score, final_status, explanation, failure_reasons, rewrite_recommendations.`,
    finalReviewSchema
  );
  const finalScores = {
    blueprint: normalizeScore(finalReview.final_blueprint_score),
    difficulty: normalizeScore(finalReview.final_difficulty_score),
    distractor: normalizeScore(finalReview.final_distractor_score),
    psychometric: normalizeScore(finalReview.final_psychometric_score),
    bias: normalizeScore(finalReview.final_bias_score),
    security: normalizeScore(finalReview.final_security_score),
    integrity: normalizeScore(finalReview.final_integrity_score),
  };

  const passed = finalScores.blueprint >= INTEGRITY_THRESHOLDS.blueprintAlignment
    && finalScores.difficulty >= INTEGRITY_THRESHOLDS.difficultyQuality
    && finalScores.distractor >= 85
    && finalScores.psychometric >= 85
    && finalScores.bias >= 90
    && finalScores.security >= 90
    && finalScores.integrity >= INTEGRITY_THRESHOLDS.overallIntegrity;
  const attempts = question.improvement_attempts || 0;
  const status = passed ? 'passed' : attempts >= 2 ? 'needs_human_review' : 'needs_improvement';

  const { data: updated, error } = await supabaseAdmin
    .from('questions')
    .update({
      final_blueprint_score: finalScores.blueprint,
      final_difficulty_score: finalScores.difficulty,
      final_distractor_score: finalScores.distractor,
      final_psychometric_score: finalScores.psychometric,
      final_bias_score: finalScores.bias,
      final_security_score: finalScores.security,
      final_integrity_score: finalScores.integrity,
      final_review_status: finalReview.final_status,
      final_review_notes: finalReview.explanation,
      failure_reasons: finalReview.failure_reasons,
      rewrite_recommendations: finalReview.rewrite_recommendations,
      integrity_status: status,
      integrity_score: finalScores.integrity,
      blueprint_alignment_score: finalScores.blueprint,
      difficulty_quality_score: finalScores.difficulty,
      psychometric_score: finalScores.psychometric,
      bias_score: finalScores.bias,
      security_score: finalScores.security,
    })
    .eq('id', questionId)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return { status, finalReview, question: updated };
}

export async function runCommitteeReview(supabaseAdmin: SupabaseClient, questionId: string, modelName = EDITORIAL_MODELS.committee) {
  const question = await fetchQuestion(supabaseAdmin, questionId);
  const context = await contextForQuestion(supabaseAdmin, question);
  if (context.missingMetadata.length) {
    await supabaseAdmin.from('questions').update({ integrity_status: 'needs_metadata' }).eq('id', questionId);
    return { status: 'needs_metadata', missingMetadata: context.missingMetadata };
  }

  const roles = [
    {
      role: 'Clinical SME Reviewer',
      instructions: 'Evaluate social work practice accuracy, correct answer quality, scope of practice, ASWB-style appropriateness, and BSW/LMSW/LCSW level match.',
    },
    {
      role: 'Psychometrician Reviewer',
      instructions: 'Evaluate construct validity, clarity, expected discrimination, ambiguity, cueing, distractor function, and difficulty appropriateness.',
    },
    {
      role: 'Exam Chair Reviewer',
      instructions: 'Evaluate publication readiness, professional tone, ethical fairness, blueprint alignment, legal/security risk, and whether the item should publish.',
    },
  ];

  const reviews = await Promise.all(roles.map(({ role, instructions }) => callJsonModel(
    modelName,
    `${role}. You receive only BlueprintContext and final question. Output JSON only.`,
    `${formatBlueprintContextForPrompt(context)}

Question:
${JSON.stringify(questionForPrompt(question), null, 2)}

${instructions}

Output exactly: role, vote approve|revise|reject, score, reason, required_changes.`,
    committeeReviewSchema
  )));

  await supabaseAdmin.from('question_committee_reviews').insert(
    reviews.map((review) => ({
      question_id: questionId,
      reviewer_role: review.role,
      model_used: modelName,
      vote: review.vote,
      score: normalizeScore(review.score),
      reason: review.reason,
      required_changes: review.required_changes,
    }))
  );

  const averageScore = Math.round(reviews.reduce((sum, review) => sum + normalizeScore(review.score), 0) / reviews.length);
  const approveCount = reviews.filter((review) => review.vote === 'approve').length;
  const rejectCount = reviews.filter((review) => review.vote === 'reject').length;
  const committeeStatus = rejectCount > 0
    ? 'rejected'
    : approveCount >= 2 && averageScore >= 85
      ? 'approved'
      : 'needs_revision';

  const { data: updated, error } = await supabaseAdmin
    .from('questions')
    .update({
      committee_status: committeeStatus,
      committee_average_score: averageScore,
      committee_review_notes: reviews.map((review) => `${review.role}: ${review.vote} (${normalizeScore(review.score)}) - ${review.reason}`).join('\n'),
      committee_approved_at: committeeStatus === 'approved' ? new Date().toISOString() : null,
      integrity_status: committeeStatus === 'rejected' ? 'rejected' : question.integrity_status,
      active: false,
    })
    .eq('id', questionId)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return { status: committeeStatus, averageScore, reviews, question: updated };
}

export async function publishQuestion(supabaseAdmin: SupabaseClient, questionId: string, adminUserId: string, overrideReason?: string) {
  const checked = await checkAndUpdateQuestionIntegrity(supabaseAdmin, questionId);
  const question = await fetchQuestion(supabaseAdmin, questionId) as Question & {
    committee_status?: string | null;
    admin_override?: boolean | null;
    admin_override_reason?: string | null;
  };
  const context = await contextForQuestion(supabaseAdmin, question);
  if (context.missingMetadata.length) {
    throw new Error(`Missing blueprint metadata: ${context.missingMetadata.join(', ')}`);
  }

  const canPublish = checked.result.integrity_status === 'passed'
    && question.committee_status === 'approved'
    && checked.result.blueprint_alignment_score >= INTEGRITY_THRESHOLDS.blueprintAlignment
    && checked.result.difficulty_quality_score >= INTEGRITY_THRESHOLDS.difficultyQuality
    && checked.result.integrity_score >= INTEGRITY_THRESHOLDS.overallIntegrity
    && question.difficulty !== 'easy'
    && checked.result.plagiarism_risk_score <= INTEGRITY_THRESHOLDS.highDuplicateRisk;

  const override = Boolean(overrideReason?.trim());
  if (!canPublish && !override) {
    throw new Error('Question cannot publish until integrity passes, committee approves, and metadata is complete.');
  }

  const { data, error } = await supabaseAdmin
    .from('questions')
    .update({
      reviewed: true,
      active: true,
      ...(override ? {
        admin_override: true,
        admin_override_reason: overrideReason,
        admin_override_by: adminUserId,
        admin_override_at: new Date().toISOString(),
        integrity_override: true,
        integrity_override_reason: overrideReason,
        integrity_override_by: adminUserId,
        integrity_override_at: new Date().toISOString(),
      } : {}),
    })
    .eq('id', questionId)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return { question: data, overridden: override };
}
