import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  assertAdminGenerationWithinLimits,
  estimateModelCost,
  estimateTokensForGeneration,
  logAIUsage,
  resolveAIModelSetting,
  type AIModelTask,
} from '@/lib/ai/model-settings';
import { checkAndUpdateQuestionIntegrity } from '@/lib/content-integrity/question-integrity-checker';
import { INTEGRITY_THRESHOLDS } from '@/lib/content-integrity/integrity-gates';
import { autoImproveStoredQuestion } from '@/lib/content-integrity/question-improver';
import {
  loadRequiredBlueprintContext,
} from '@/lib/content-generation/blueprint-context';
import {
  QUESTION_GENERATOR_MODEL,
  QUESTION_PROMPT_VERSION,
  generateQuestions,
} from '@/lib/content-generation/question-generator';
import {
  FLASHCARD_GENERATOR_MODEL,
  FLASHCARD_PROMPT_VERSION,
  generateFlashcardsFromBlueprint,
} from '@/lib/content-generation/flashcard-generator';
import {
  VIGNETTE_GENERATOR_MODEL,
  VIGNETTE_PROMPT_VERSION,
  generateVignettesFromBlueprint,
} from '@/lib/content-generation/vignette-generator';
import { getSupabaseAdmin, requireAdmin } from '@/lib/server-auth';
import { enforceRateLimit } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

const generateSchema = z.object({
  type: z.enum(['mcq', 'flashcards', 'vignettes']),
  examTrackId: z.string().uuid(),
  topicId: z.string().uuid(),
  subtopicId: z.string().uuid(),
  socialWorkBlueprintItemId: z.string().uuid().optional().nullable(),
  count: z.number().int().min(1).max(100),
  intendedDifficulty: z.enum(['medium', 'hard']).default('medium'),
  intendedCognitiveLevel: z.string().min(1).default('application'),
  language: z.enum(['en', 'es', 'fr', 'all']).default('all'),
});

type GenerateRequest = z.infer<typeof generateSchema>;

function normalize(value: string | null | undefined) {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ');
}

function duplicateHash(examTrackId: string, contentType: string, text: string) {
  return createHash('sha256')
    .update(`${examTrackId}:${contentType}:${normalize(text)}`)
    .digest('hex');
}

function nextBatchSize(remaining: number) {
  return Math.min(25, Math.max(1, remaining));
}

function modelForType(type: GenerateRequest['type']) {
  if (type === 'flashcards') return FLASHCARD_GENERATOR_MODEL;
  if (type === 'vignettes') return VIGNETTE_GENERATOR_MODEL;
  return QUESTION_GENERATOR_MODEL;
}

function modelTaskForType(type: GenerateRequest['type']): AIModelTask {
  if (type === 'flashcards') return 'flashcard_generation';
  if (type === 'vignettes') return 'case_vignette_generation';
  return 'mcq_generation';
}

function promptVersionForType(type: GenerateRequest['type']) {
  if (type === 'flashcards') return FLASHCARD_PROMPT_VERSION;
  if (type === 'vignettes') return VIGNETTE_PROMPT_VERSION;
  return QUESTION_PROMPT_VERSION;
}

function asSocialWorkExamLevel(value: string | null | undefined) {
  return value === 'bsw' || value === 'lmsw_msw' || value === 'lcsw_clinical' ? value : null;
}

async function resolveSocialWorkBlueprintItemId(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  body: GenerateRequest
) {
  if (body.socialWorkBlueprintItemId) return body.socialWorkBlueprintItemId;

  const { data, error } = await supabaseAdmin
    .from('social_work_blueprint_items')
    .select('id')
    .eq('exam_track_id', body.examTrackId)
    .eq('topic_id', body.topicId)
    .eq('subtopic_id', body.subtopicId)
    .limit(2);

  if (error) return null;
  return data?.length === 1 ? data[0].id : null;
}

async function loadExistingHashes(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  type: GenerateRequest['type'],
  examTrackId: string,
  topicId: string
) {
  if (type === 'mcq') {
    const { data, error } = await supabaseAdmin
      .from('questions')
      .select('question_en, duplicate_hash')
      .eq('exam_track_id', examTrackId)
      .eq('topic_id', topicId);
    if (error) throw new Error(error.message);
    return new Set((data || []).map((row: any) => row.duplicate_hash || duplicateHash(examTrackId, type, row.question_en)));
  }

  if (type === 'flashcards') {
    const { data, error } = await supabaseAdmin
      .from('flashcards')
      .select('front_en, duplicate_hash')
      .eq('exam_track_id', examTrackId)
      .eq('topic_id', topicId);
    if (error) throw new Error(error.message);
    return new Set((data || []).map((row: any) => row.duplicate_hash || duplicateHash(examTrackId, type, row.front_en)));
  }

  const { data, error } = await supabaseAdmin
    .from('case_vignettes')
    .select('case_en, duplicate_hash')
    .eq('exam_track_id', examTrackId)
    .eq('topic_id', topicId);
  if (error) throw new Error(error.message);
  return new Set((data || []).map((row: any) => row.duplicate_hash || duplicateHash(examTrackId, type, row.case_en)));
}

function rejectIfWeakText(text: string, type: GenerateRequest['type']) {
  if (!normalize(text)) return 'Missing generated text.';
  if (type === 'mcq' && text.length < 40) return 'MCQ stem is too short.';
  if (type === 'flashcards' && text.length < 8) return 'Flashcard front is too short.';
  if (type === 'vignettes' && text.length < 60) return 'Case vignette scenario is too short.';
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const adminUser = await requireAdmin(req);
    if (!adminUser) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const { data, error } = await getSupabaseAdmin()
      .from('ai_generation_batches')
      .select('*, exam_track:exam_tracks(name, slug), topic:topics(title)')
      .order('created_at', { ascending: false })
      .limit(25);

    if (error) throw new Error(error.message);
    return NextResponse.json({ batches: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Could not load generation history' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  let body: GenerateRequest | null = null;
  let batchId: string | null = null;
  let adminUserId: string | null = null;
  let examName = '';
  let rejectedReasons: string[] = [];

  try {
    const adminUser = await requireAdmin(req);
    if (!adminUser) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    adminUserId = adminUser.id;
    const limited = await enforceRateLimit(req, { keyPrefix: 'admin:generate-content', actorId: adminUser.id, limit: 6, windowMs: 60 * 60 * 1000 });
    if (limited) return limited;

    const parsed = generateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid generation request', details: parsed.error.flatten() }, { status: 400 });
    }
    body = parsed.data;
    await assertAdminGenerationWithinLimits(supabaseAdmin, adminUser.id, body.count);
    const generationModel = await resolveAIModelSetting(supabaseAdmin, modelTaskForType(body.type));
    const improvementModel = await resolveAIModelSetting(supabaseAdmin, 'auto_improvement');
    const estimatedTokens = estimateTokensForGeneration(body.count);
    const estimatedCost = estimateModelCost(generationModel.model_name, estimatedTokens.inputTokens, estimatedTokens.outputTokens);

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not configured.' }, { status: 503 });
    }

    const socialWorkBlueprintItemId = await resolveSocialWorkBlueprintItemId(supabaseAdmin, body);

    const blueprintContext = await loadRequiredBlueprintContext(supabaseAdmin, {
      examTrackId: body.examTrackId,
      topicId: body.topicId,
      subtopicId: body.subtopicId,
      socialWorkBlueprintItemId,
      intendedDifficulty: body.intendedDifficulty,
      intendedCognitiveLevel: body.intendedCognitiveLevel,
    });

    examName = blueprintContext.examTrack;
    const { data: batch, error: batchError } = await supabaseAdmin
      .from('ai_generation_batches')
      .insert({
        admin_user_id: adminUser.id,
        exam_track_id: body.examTrackId,
        topic_id: body.topicId,
        content_type: body.type,
        quantity_requested: body.count,
        status: 'running',
        model_used: generationModel.model_name,
        prompt_version: promptVersionForType(body.type),
      })
      .select('id')
      .single();

    if (batchError || !batch) throw new Error(batchError?.message || 'Could not create generation batch.');
    batchId = batch.id;

    const seenHashes = await loadExistingHashes(supabaseAdmin, body.type, body.examTrackId, body.topicId);
    let quantityGenerated = 0;
    let quantityInserted = 0;
    let quantityRejected = 0;
    const insertedIds: string[] = [];

    while (quantityGenerated < body.count) {
      const quantity = nextBatchSize(body.count - quantityGenerated);

      if (body.type === 'mcq') {
        const questions = await generateQuestions({
          examTrackId: body.examTrackId,
          topicId: blueprintContext.topicId,
          subtopicId: blueprintContext.subtopicId || null,
          examTrackName: blueprintContext.examTrack,
          officialSourceUrl: blueprintContext.officialSourceURL,
          officialExamDescription: blueprintContext.officialExamDescription,
          topicTitle: blueprintContext.majorContentArea,
          topicDescription: blueprintContext.topicDescription,
          topicOfficialBlueprintText: blueprintContext.topicOfficialBlueprintText,
          topicWeightPercent: blueprintContext.majorContentWeight,
          subtopic: blueprintContext.competencySection,
          subtopicDescription: blueprintContext.subtopicDescription,
          subtopicOfficialBlueprintText: blueprintContext.subtopicOfficialBlueprintText,
          learningObjective: blueprintContext.learningObjective,
          blueprintReferenceText: blueprintContext.officialBlueprintText,
          socialWorkBlueprintItemId: blueprintContext.socialWorkBlueprintItemId || null,
          socialWorkExamLevel: asSocialWorkExamLevel(blueprintContext.aswbExamLevel),
          majorContentArea: blueprintContext.majorContentArea,
          percentageWeight: blueprintContext.majorContentWeight,
          competencySection: blueprintContext.competencySection,
          appliedKnowledgeStatement: blueprintContext.appliedKnowledgeStatement,
          cognitiveLevelGuidance: blueprintContext.cognitiveLevelTarget,
          sampleStyleGuidance: blueprintContext.questionWritingGuidelines,
          intendedCognitiveLevel: blueprintContext.cognitiveLevelTarget,
          intendedDifficulty: blueprintContext.difficultyTarget,
          model: generationModel.model_name,
          quantity,
          difficultyMix: { easy: 0, medium: blueprintContext.difficultyTarget === 'medium' ? 100 : 0, hard: blueprintContext.difficultyTarget === 'hard' ? 100 : 0 },
          cognitiveLevelMix: { recall: 0, application: blueprintContext.cognitiveLevelTarget === 'application' ? 100 : 50, analysis: blueprintContext.cognitiveLevelTarget === 'application' ? 0 : 50 },
        });

        quantityGenerated += questions.length;
        const rows = questions.flatMap((question) => {
          const reason = rejectIfWeakText(question.question, 'mcq');
          const hash = duplicateHash(body!.examTrackId, 'mcq', question.question);
          if (reason || seenHashes.has(hash)) {
            quantityRejected += 1;
            rejectedReasons.push(reason || 'Duplicate MCQ candidate.');
            return [];
          }
          seenHashes.add(hash);
          return [{
            exam_track_id: body!.examTrackId,
            topic_id: blueprintContext.topicId,
            subtopic_id: blueprintContext.subtopicId || null,
            social_work_blueprint_item_id: blueprintContext.socialWorkBlueprintItemId || null,
            blueprint_content_area: blueprintContext.majorContentArea,
            blueprint_competency_section: blueprintContext.competencySection,
            applied_knowledge_statement: blueprintContext.appliedKnowledgeStatement,
            question_writing_guideline: blueprintContext.questionWritingGuidelines,
            intended_cognitive_level: blueprintContext.cognitiveLevelTarget,
            blueprint_reference_text: blueprintContext.officialBlueprintText,
            question_en: question.question,
            option_a_en: question.option_a,
            option_b_en: question.option_b,
            option_c_en: question.option_c,
            option_d_en: question.option_d,
            correct_option: question.correct_option.toLowerCase(),
            rationale_en: question.correct_rationale,
            correct_rationale_en: question.correct_rationale,
            option_a_rationale_en: question.option_a_rationale,
            option_b_rationale_en: question.option_b_rationale,
            option_c_rationale_en: question.option_c_rationale,
            option_d_rationale_en: question.option_d_rationale,
            test_taking_tip_en: question.test_taking_tip,
            cognitive_level: question.cognitive_level,
            difficulty: question.difficulty,
            subtopic: question.subtopic,
            learning_objective: question.learning_objective,
            source_topic: question.source_topic,
            duplicate_hash: hash,
            generation_batch_id: batchId,
            generated_by_ai: true,
            integrity_status: 'pending',
            reviewed: false,
            active: false,
          }];
        });

        if (rows.length) {
          const { data: inserted, error } = await supabaseAdmin.from('questions').insert(rows).select('id');
          if (error) throw new Error(error.message);
          quantityInserted += inserted?.length || 0;
          insertedIds.push(...((inserted || []) as Array<{ id: string }>).map((row) => row.id));

          for (const question of inserted || []) {
            const checked = await checkAndUpdateQuestionIntegrity(supabaseAdmin, question.id);
            if (
              checked.result.integrity_status !== 'needs_metadata'
              && (
                checked.result.blueprint_alignment_score < INTEGRITY_THRESHOLDS.blueprintAlignment
                || checked.result.difficulty_quality_score < INTEGRITY_THRESHOLDS.difficultyQuality
                || checked.result.integrity_score < INTEGRITY_THRESHOLDS.overallIntegrity
              )
            ) {
              await autoImproveStoredQuestion(supabaseAdmin, question.id, improvementModel.model_name);
            }
          }
        }
      } else if (body.type === 'flashcards') {
        const cards = await generateFlashcardsFromBlueprint({ context: blueprintContext, quantity, language: body.language, model: generationModel.model_name });
        quantityGenerated += cards.length;
        const rows = cards.flatMap((card) => {
          const reason = rejectIfWeakText(card.front_en, 'flashcards');
          const hash = duplicateHash(body!.examTrackId, 'flashcards', card.front_en);
          if (reason || seenHashes.has(hash)) {
            quantityRejected += 1;
            rejectedReasons.push(reason || 'Duplicate flashcard candidate.');
            return [];
          }
          seenHashes.add(hash);
          return [{
            exam_track_id: body!.examTrackId,
            exam_name: examName,
            topic_id: blueprintContext.topicId,
            subtopic_id: blueprintContext.subtopicId || null,
            blueprint_reference_text: card.blueprint_reference,
            source_topic: card.topic,
            learning_objective: card.learning_objective,
            difficulty: card.difficulty,
            cognitive_level: card.cognitive_level,
            generation_batch_id: batchId,
            duplicate_hash: hash,
            front_en: card.front_en,
            front_es: card.front_es,
            front_fr: card.front_fr,
            back_en: card.back_en,
            back_es: card.back_es,
            back_fr: card.back_fr,
            active: false,
            reviewed: false,
          }];
        });
        if (rows.length) {
          const { data: inserted, error } = await supabaseAdmin.from('flashcards').insert(rows).select('id');
          if (error) throw new Error(error.message);
          quantityInserted += inserted?.length || 0;
          insertedIds.push(...((inserted || []) as Array<{ id: string }>).map((row) => row.id));
        }
      } else {
        const vignettes = await generateVignettesFromBlueprint({ context: blueprintContext, quantity, language: body.language, model: generationModel.model_name });
        quantityGenerated += vignettes.length;
        const rows = vignettes.flatMap((vignette) => {
          const reason = rejectIfWeakText(vignette.case_en, 'vignettes');
          const hash = duplicateHash(body!.examTrackId, 'vignettes', vignette.case_en);
          if (reason || seenHashes.has(hash)) {
            quantityRejected += 1;
            rejectedReasons.push(reason || 'Duplicate vignette candidate.');
            return [];
          }
          seenHashes.add(hash);
          return [{
            exam_track_id: body!.examTrackId,
            exam_name: examName,
            topic_id: blueprintContext.topicId,
            subtopic_id: blueprintContext.subtopicId || null,
            blueprint_reference_text: vignette.blueprint_reference,
            source_topic: vignette.topic,
            learning_objective: vignette.learning_objective,
            difficulty: vignette.difficulty,
            cognitive_level: vignette.cognitive_level,
            expected_answer_elements: vignette.expected_answer_elements,
            scoring_rubric: vignette.scoring_rubric,
            generation_batch_id: batchId,
            duplicate_hash: hash,
            case_en: vignette.case_en,
            case_es: vignette.case_es,
            case_fr: vignette.case_fr,
            prompt_en: vignette.prompt_en,
            prompt_es: vignette.prompt_es,
            prompt_fr: vignette.prompt_fr,
            ideal_answer_en: vignette.ideal_answer_en,
            ideal_answer_es: vignette.ideal_answer_es,
            ideal_answer_fr: vignette.ideal_answer_fr,
            coaching_feedback_en: vignette.coaching_feedback_en,
            coaching_feedback_es: vignette.coaching_feedback_es,
            coaching_feedback_fr: vignette.coaching_feedback_fr,
            active: false,
            reviewed: false,
          }];
        });
        if (rows.length) {
          const { data: inserted, error } = await supabaseAdmin.from('case_vignettes').insert(rows).select('id');
          if (error) throw new Error(error.message);
          quantityInserted += inserted?.length || 0;
          insertedIds.push(...((inserted || []) as Array<{ id: string }>).map((row) => row.id));
        }
      }

      await supabaseAdmin
        .from('ai_generation_batches')
        .update({
          quantity_generated: quantityGenerated,
          quantity_inserted: quantityInserted,
          quantity_rejected: quantityRejected,
        })
        .eq('id', batchId);
    }

    await supabaseAdmin
      .from('ai_generation_batches')
      .update({
        quantity_generated: quantityGenerated,
        quantity_inserted: quantityInserted,
        quantity_rejected: quantityRejected,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', batchId);

    await supabaseAdmin.from('generation_logs').insert({
      admin_user_id: adminUserId,
      exam_track_id: body.examTrackId,
      exam_name: examName,
      topic_id: body.topicId,
      content_type: body.type,
      requested_count: body.count,
      generated_count: quantityInserted,
      duplicate_count: quantityRejected,
      status: 'success',
      model_used: generationModel.model_name,
      estimated_cost: estimatedCost,
      rejected_reasons: rejectedReasons,
    });

    await logAIUsage(supabaseAdmin, {
      actionType: generationModel.setting_key,
      modelName: generationModel.model_name,
      inputTokens: estimatedTokens.inputTokens,
      outputTokens: estimatedTokens.outputTokens,
      relatedBatchId: batchId,
      adminUserId,
      success: true,
    });

    return NextResponse.json({
      batchId,
      quantityRequested: body.count,
      quantityGenerated,
      quantityInserted,
      quantityRejected,
      insertedIds,
      rejectedReasons,
      modelUsed: generationModel.model_name,
      estimatedCost,
      type: body.type,
    });
  } catch (err: any) {
    if (batchId) {
      await supabaseAdmin
        .from('ai_generation_batches')
        .update({
          status: 'failed',
          error_message: err.message,
          completed_at: new Date().toISOString(),
        })
        .eq('id', batchId);
    }

    if (body) {
      await supabaseAdmin.from('generation_logs').insert({
        admin_user_id: adminUserId,
        exam_track_id: body.examTrackId,
        exam_name: examName,
        topic_id: body.topicId,
        content_type: body.type,
        requested_count: body.count,
        generated_count: 0,
        duplicate_count: 0,
        status: 'error',
        error_message: err.message,
        model_used: modelForType(body.type),
        rejected_reasons: rejectedReasons,
      });
    }

    console.error('AI generation error:', err);
    return NextResponse.json({ error: err.message || 'Generation failed' }, { status: 500 });
  }
}
