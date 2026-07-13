import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  assertAdminGenerationWithinLimits,
  estimateModelCost,
  estimateTokensForGeneration,
  logAIUsage,
  resolveAIModelSetting,
} from '@/lib/ai/model-settings';
import { getSupabaseAdmin, requireAdmin } from '@/lib/server-auth';
import {
  QUESTION_PROMPT_VERSION,
  generateQuestions,
} from '@/lib/openai/question-generator';
import {
  loadExistingQuestionFingerprints,
  validateQuestionQuality,
} from '@/lib/content-quality/question-quality';
import { checkAndUpdateQuestionIntegrity } from '@/lib/content-integrity/question-integrity-checker';
import { INTEGRITY_THRESHOLDS } from '@/lib/content-integrity/integrity-gates';
import {
  evaluateGeneratedQuestionIntegrity,
  improveGeneratedQuestionOnce,
} from '@/lib/content-integrity/question-improver';
import { getExamTrackRules, isRecallOnlyStem } from '@/lib/content-generation/exam-track-rules';
import { buildBlueprintContext } from '@/lib/blueprint/blueprint-context-builder';

export const dynamic = 'force-dynamic';

const difficultyMixSchema = z.object({
  easy: z.number().int().min(0).max(100),
  medium: z.number().int().min(0).max(100),
  hard: z.number().int().min(0).max(100),
});

const cognitiveLevelMixSchema = z.object({
  recall: z.number().int().min(0).max(100),
  application: z.number().int().min(0).max(100),
  analysis: z.number().int().min(0).max(100),
});

const requestSchema = z.object({
  examTrackId: z.string().uuid(),
  topicId: z.string().uuid(),
  subtopicId: z.string().uuid().optional().nullable(),
  socialWorkBlueprintItemId: z.string().uuid().optional().nullable(),
  subtopic: z.string().min(2),
  learningObjective: z.string().min(5),
  intendedCognitiveLevel: z.string().optional().nullable(),
  intendedDifficulty: z.enum(['medium', 'hard']).optional().nullable(),
  quantity: z.number().int().min(1).max(100),
  difficultyMix: difficultyMixSchema,
  cognitiveLevelMix: cognitiveLevelMixSchema,
});

function nextBatchSize(remaining: number) {
  if (remaining <= 25) return remaining;
  return 25;
}

function isMissingSchemaObject(errorMessage: string | undefined) {
  const message = (errorMessage || '').toLowerCase();
  return message.includes('schema cache') || message.includes('could not find') || message.includes('column');
}

function isSocialWorkTrack(track: { name?: string | null; full_name?: string | null; slug?: string | null }) {
  return /\b(bsw|msw|lmsw|lcsw|social work|clinical social)\b/i.test([
    track.slug,
    track.name,
    track.full_name,
  ].filter(Boolean).join(' '));
}

function asSocialWorkExamLevel(value: string | null | undefined): 'bsw' | 'lmsw_msw' | 'lcsw_clinical' | null {
  if (value === 'bsw' || value === 'lmsw_msw' || value === 'lcsw_clinical') return value;
  return null;
}

export async function POST(req: NextRequest) {
  let batchId: string | null = null;
  let supportsQualityMetadata = true;
  const supabaseAdmin = getSupabaseAdmin();

  try {
    const adminUser = await requireAdmin(req);
    if (!adminUser) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid generation request', details: parsed.error.flatten() }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not configured' }, { status: 500 });
    }

    const body = parsed.data;
    await assertAdminGenerationWithinLimits(supabaseAdmin, adminUser.id, body.quantity);
    const generationModel = await resolveAIModelSetting(supabaseAdmin, 'mcq_generation');
    const improvementModel = await resolveAIModelSetting(supabaseAdmin, 'auto_improvement');
    const estimatedTokens = estimateTokensForGeneration(body.quantity);
    const estimatedCost = estimateModelCost(generationModel.model_name, estimatedTokens.inputTokens, estimatedTokens.outputTokens);

    const [trackRes, topicRes] = await Promise.all([
      supabaseAdmin
        .from('exam_tracks')
        .select('id, name, full_name, slug, official_source_url, official_exam_description, aswb_exam_level')
        .eq('id', body.examTrackId)
        .eq('active', true)
        .single(),
      supabaseAdmin
        .from('topics')
        .select('id, title, description, official_blueprint_text, official_weight_percent, exam_track_id')
        .eq('id', body.topicId)
        .eq('exam_track_id', body.examTrackId)
        .single(),
    ]);

    if (trackRes.error || topicRes.error || !trackRes.data || !topicRes.data) {
      return NextResponse.json({ error: 'Exam track or topic not found.' }, { status: 404 });
    }

    const examName = trackRes.data.full_name || trackRes.data.name;
    const examTrackRules = getExamTrackRules(examName);
    const socialWorkTrack = isSocialWorkTrack(trackRes.data);
    const requestedDifficultyMix = {
      ...body.difficultyMix,
      easy: 0,
    };

    if (body.difficultyMix.easy > 0) {
      return NextResponse.json(
        { error: 'Easy questions are disabled. Use medium or hard difficulty only.' },
        { status: 400 }
      );
    }

    if (socialWorkTrack && !body.socialWorkBlueprintItemId) {
      return NextResponse.json(
        { error: 'Social Work generation requires a stored ASWB blueprint applied knowledge statement.' },
        { status: 400 }
      );
    }

    let selectedSubtopic: any = null;
    let selectedBlueprintItem: any = null;
    if (body.subtopicId) {
      const { data: subtopicData, error: subtopicError } = await supabaseAdmin
        .from('subtopics')
        .select('id, title, description, learning_objective, official_blueprint_text')
        .eq('id', body.subtopicId)
        .eq('topic_id', body.topicId)
        .maybeSingle();

      if (subtopicError) throw new Error(subtopicError.message);
      selectedSubtopic = subtopicData;
    }
    if (body.socialWorkBlueprintItemId) {
      const { data: blueprintItemData, error: blueprintItemError } = await supabaseAdmin
        .from('social_work_blueprint_items')
        .select('*')
        .eq('id', body.socialWorkBlueprintItemId)
        .eq('exam_track_id', body.examTrackId)
        .maybeSingle();

      if (blueprintItemError) throw new Error(blueprintItemError.message);
      if (!blueprintItemData) {
        return NextResponse.json({ error: 'Selected Social Work blueprint item was not found for this exam track.' }, { status: 404 });
      }
      selectedBlueprintItem = blueprintItemData;
    }

    if (!selectedSubtopic && selectedBlueprintItem?.subtopic_id) {
      const { data: blueprintSubtopicData, error: blueprintSubtopicError } = await supabaseAdmin
        .from('subtopics')
        .select('id, title, description, learning_objective, official_blueprint_text')
        .eq('id', selectedBlueprintItem.subtopic_id)
        .maybeSingle();

      if (blueprintSubtopicError) throw new Error(blueprintSubtopicError.message);
      selectedSubtopic = blueprintSubtopicData;
    }

    const blueprintContext = await buildBlueprintContext(supabaseAdmin, {
      examTrackId: body.examTrackId,
      topicId: body.topicId,
      subtopicId: selectedSubtopic?.id || body.subtopicId || null,
      socialWorkBlueprintItemId: selectedBlueprintItem?.id || body.socialWorkBlueprintItemId || null,
      difficultyTarget: body.intendedDifficulty || 'medium',
      cognitiveLevelTarget: body.intendedCognitiveLevel || 'application',
    });

    if (blueprintContext.missingMetadata.length) {
      return NextResponse.json(
        {
          error: `The selected blueprint objective is incomplete. Add official blueprint text and a learning objective before generating content. Missing: ${blueprintContext.missingMetadata.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const effectiveSubtopic = blueprintContext.competencySection || selectedSubtopic?.title || selectedBlueprintItem?.competency_section || body.subtopic;
    const effectiveLearningObjective = blueprintContext.learningObjective || selectedBlueprintItem?.applied_knowledge_statement || selectedSubtopic?.learning_objective || body.learningObjective;
    const blueprintReferenceText = blueprintContext.officialBlueprintText;
    const socialWorkExamLevel = asSocialWorkExamLevel(blueprintContext.aswbExamLevel || selectedBlueprintItem?.exam_level);
    const canonicalTopicId = blueprintContext.topicId || body.topicId;
    const canonicalTopicTitle = blueprintContext.majorContentArea || topicRes.data.title;

    const { data: batch, error: batchError } = await supabaseAdmin
      .from('ai_generation_batches')
      .insert({
        admin_user_id: adminUser.id,
        exam_track_id: body.examTrackId,
        topic_id: canonicalTopicId,
        content_type: 'mcq',
        quantity_requested: body.quantity,
        status: 'running',
        model_used: generationModel.model_name,
        prompt_version: QUESTION_PROMPT_VERSION,
      })
      .select('id')
      .single();

    if (batchError || !batch) {
      if (!isMissingSchemaObject(batchError?.message)) {
        throw new Error(batchError?.message || 'Could not create generation batch.');
      }

      supportsQualityMetadata = false;
    } else {
      batchId = batch.id;
    }

    const existingQuestions = await loadExistingQuestionFingerprints(
      supabaseAdmin,
      body.examTrackId,
      canonicalTopicId
    );
    const seenHashes = new Set(existingQuestions.map((question) => question.duplicate_hash).filter(Boolean));

    let quantityGenerated = 0;
    let quantityInserted = 0;
    let quantityRejected = 0;
    const rejected: Array<{ question: string; qualityScore: number; reviewNotes: string[] }> = [];
    const insertedIds: string[] = [];
    const integrityResults: Array<{ questionId: string; status: string; score: number }> = [];

    while (quantityGenerated < body.quantity) {
      const remaining = body.quantity - quantityGenerated;
      const quantity = nextBatchSize(remaining);

      const generated = await generateQuestions({
        examTrackId: body.examTrackId,
        topicId: canonicalTopicId,
        subtopicId: blueprintContext.subtopicId || null,
        examTrackName: examName,
        officialSourceUrl: trackRes.data.official_source_url,
        officialExamDescription: blueprintContext.officialExamDescription,
        topicTitle: canonicalTopicTitle,
        topicDescription: blueprintContext.topicDescription,
        topicOfficialBlueprintText: blueprintContext.topicOfficialBlueprintText,
        topicWeightPercent: blueprintContext.majorContentWeight,
        subtopic: effectiveSubtopic,
        subtopicDescription: blueprintContext.subtopicDescription,
        subtopicOfficialBlueprintText: blueprintContext.subtopicOfficialBlueprintText,
        learningObjective: effectiveLearningObjective,
        blueprintReferenceText,
        socialWorkBlueprintItemId: blueprintContext.socialWorkBlueprintItemId || null,
        socialWorkExamLevel,
        majorContentArea: blueprintContext.majorContentArea || null,
        percentageWeight: blueprintContext.majorContentWeight,
        competencySection: blueprintContext.competencySection || null,
        appliedKnowledgeStatement: blueprintContext.appliedKnowledgeStatement || null,
        cognitiveLevelGuidance: selectedBlueprintItem?.cognitive_level_guidance || blueprintContext.cognitiveLevelTarget,
        sampleStyleGuidance: blueprintContext.questionWritingGuidelines || null,
        intendedCognitiveLevel: blueprintContext.cognitiveLevelTarget,
        intendedDifficulty: blueprintContext.difficultyTarget,
        model: generationModel.model_name,
        quantity,
        difficultyMix: requestedDifficultyMix,
        cognitiveLevelMix: body.cognitiveLevelMix,
      });

      if (generated.length === 0) {
        throw new Error('OpenAI returned zero questions for a generation chunk.');
      }

      quantityGenerated += generated.length;

      const acceptedRows: any[] = [];

      for (const originalQuestion of generated) {
        let question = originalQuestion;
        const quality = validateQuestionQuality(question, {
          examTrackId: body.examTrackId,
          topicId: canonicalTopicId,
          topicTitle: canonicalTopicTitle,
          subtopic: effectiveSubtopic,
          learningObjective: effectiveLearningObjective,
          existingQuestions,
        });

        if (seenHashes.has(quality.duplicateHash)) {
          quality.accepted = false;
          quality.reviewNotes.push('Duplicate hash appeared earlier in this generation batch.');
          quality.qualityScore = Math.min(quality.qualityScore, 40);
        }

        if (!quality.accepted) {
          quantityRejected += 1;
          rejected.push({
            question: question.question,
            qualityScore: quality.qualityScore,
            reviewNotes: quality.reviewNotes,
          });
          continue;
        }

        let integrity = evaluateGeneratedQuestionIntegrity(
          question,
          {
            examTrackId: body.examTrackId,
            topicId: canonicalTopicId,
            examTrackName: examName,
            officialSourceUrl: trackRes.data.official_source_url,
            officialExamDescription: blueprintContext.officialExamDescription,
            topicTitle: canonicalTopicTitle,
            topicDescription: blueprintContext.topicDescription,
            topicOfficialBlueprintText: blueprintContext.topicOfficialBlueprintText,
            topicWeightPercent: blueprintContext.majorContentWeight,
            subtopicId: blueprintContext.subtopicId || null,
            subtopic: effectiveSubtopic,
            subtopicDescription: blueprintContext.subtopicDescription,
            subtopicOfficialBlueprintText: blueprintContext.subtopicOfficialBlueprintText,
            learningObjective: effectiveLearningObjective,
            blueprintReferenceText,
            socialWorkBlueprintItem: selectedBlueprintItem,
            intendedCognitiveLevel: blueprintContext.cognitiveLevelTarget,
            intendedDifficulty: blueprintContext.difficultyTarget,
          },
          existingQuestions.map((existing, index) => ({
            id: `existing-${index}`,
            question_en: existing.question_en,
            duplicate_hash: existing.duplicate_hash,
          }))
        );

        let autoImproved = false;
        let improvementAttempts = 0;
        let improvementNotes: string | null = null;

        if (
          integrity.integrity_status !== 'needs_metadata'
          && (
            (examTrackRules.preferScenarioBased && isRecallOnlyStem(question.question))
            || integrity.blueprint_alignment_score < INTEGRITY_THRESHOLDS.blueprintAlignment
            || integrity.difficulty_quality_score < INTEGRITY_THRESHOLDS.difficultyQuality
            || integrity.integrity_score < INTEGRITY_THRESHOLDS.overallIntegrity
          )
        ) {
          const improved = await improveGeneratedQuestionOnce({
            question,
            metadata: {
              examTrackId: body.examTrackId,
              topicId: canonicalTopicId,
              examTrackName: examName,
              officialSourceUrl: trackRes.data.official_source_url,
              officialExamDescription: blueprintContext.officialExamDescription,
              topicTitle: canonicalTopicTitle,
              topicDescription: blueprintContext.topicDescription,
              topicOfficialBlueprintText: blueprintContext.topicOfficialBlueprintText,
              topicWeightPercent: blueprintContext.majorContentWeight,
              subtopicId: blueprintContext.subtopicId || null,
              subtopic: effectiveSubtopic,
              subtopicDescription: blueprintContext.subtopicDescription,
              subtopicOfficialBlueprintText: blueprintContext.subtopicOfficialBlueprintText,
              learningObjective: effectiveLearningObjective,
              blueprintReferenceText,
              socialWorkBlueprintItem: selectedBlueprintItem,
              intendedCognitiveLevel: blueprintContext.cognitiveLevelTarget,
              intendedDifficulty: blueprintContext.difficultyTarget,
            },
            integrityResult: integrity,
          }, improvementModel.model_name);

          question = improved.question;
          integrity = improved.integrityResult;
          autoImproved = true;
          improvementAttempts = 1;
          improvementNotes = improved.improvementNotes;
          quality.duplicateHash = integrity.duplicate_hash;
          quality.qualityScore = Math.max(quality.qualityScore, integrity.integrity_score);
          quality.reviewNotes.push('AI auto-improved candidate before saving.');
        }

        seenHashes.add(quality.duplicateHash);
        existingQuestions.push({
          question_en: question.question,
          duplicate_hash: quality.duplicateHash,
        });

        const row = {
          exam_track_id: body.examTrackId,
          topic_id: canonicalTopicId,
          subtopic_id: blueprintContext.subtopicId || null,
          social_work_blueprint_item_id: blueprintContext.socialWorkBlueprintItemId || null,
          blueprint_content_area: blueprintContext.majorContentArea || null,
          blueprint_competency_section: blueprintContext.competencySection || null,
          applied_knowledge_statement: blueprintContext.appliedKnowledgeStatement || null,
          question_writing_guideline: blueprintContext.questionWritingGuidelines || null,
          intended_cognitive_level: blueprintContext.cognitiveLevelTarget,
          blueprint_reference_text: blueprintReferenceText || null,
          question_en: question.question,
          option_a_en: question.option_a,
          option_b_en: question.option_b,
          option_c_en: question.option_c,
          option_d_en: question.option_d,
          correct_option: question.correct_option.toLowerCase(),
          rationale_en: question.correct_rationale,
          difficulty: question.difficulty,
          reviewed: false,
          active: false,
        };

        if (!supportsQualityMetadata) {
          acceptedRows.push(row);
          continue;
        }

        acceptedRows.push({
          ...row,
          correct_rationale_en: question.correct_rationale,
          option_a_rationale_en: question.option_a_rationale,
          option_b_rationale_en: question.option_b_rationale,
          option_c_rationale_en: question.option_c_rationale,
          option_d_rationale_en: question.option_d_rationale,
          test_taking_tip_en: question.test_taking_tip,
          cognitive_level: question.cognitive_level,
          subtopic: question.subtopic || effectiveSubtopic,
          learning_objective: question.learning_objective || effectiveLearningObjective,
          source_topic: question.source_topic || question.topic,
          duplicate_hash: quality.duplicateHash,
          quality_score: quality.qualityScore,
          review_notes: quality.reviewNotes.join('\n'),
          generation_batch_id: batchId,
          generated_by_ai: true,
          integrity_status: integrity.integrity_status,
          integrity_score: integrity.integrity_score,
          blueprint_alignment_score: integrity.blueprint_alignment_score,
          difficulty_quality_score: integrity.difficulty_quality_score,
          quality_flags: integrity.quality_flags,
          bias_flags: integrity.bias_flags,
          distractor_flags: integrity.distractor_flags,
          cognitive_level_detected: integrity.cognitive_level_detected,
          predicted_difficulty: integrity.predicted_difficulty,
          plagiarism_risk_score: integrity.plagiarism_risk_score,
          integrity_review_notes: integrity.integrity_review_notes,
          integrity_checked_at: new Date().toISOString(),
          improvement_attempts: improvementAttempts,
          auto_improved: autoImproved,
          improvement_notes: improvementNotes,
        });
      }

      if (acceptedRows.length > 0) {
        const { data: inserted, error: insertError } = await supabaseAdmin
          .from('questions')
          .insert(acceptedRows)
          .select('id');

        if (insertError) throw new Error(insertError.message);
        quantityInserted += inserted?.length || 0;
        const newIds = ((inserted || []) as Array<{ id: string }>).map((row) => row.id);
        insertedIds.push(...newIds);

        for (const questionId of newIds) {
          const checked = await checkAndUpdateQuestionIntegrity(supabaseAdmin, questionId);
          integrityResults.push({
            questionId,
            status: checked.result.integrity_status,
            score: checked.result.integrity_score,
          });
        }
      }

      if (batchId) {
        await supabaseAdmin
          .from('ai_generation_batches')
          .update({
            quantity_generated: quantityGenerated,
            quantity_inserted: quantityInserted,
            quantity_rejected: quantityRejected,
          })
          .eq('id', batchId);
      }
    }

    if (batchId) {
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
    } else {
      await supabaseAdmin.from('generation_logs').insert({
        admin_user_id: adminUser.id,
        exam_track_id: body.examTrackId,
        exam_name: examName,
        topic_id: canonicalTopicId,
        content_type: 'mcq',
        requested_count: body.quantity,
        generated_count: quantityInserted,
        duplicate_count: quantityRejected,
        status: 'success',
        model_used: generationModel.model_name,
        estimated_cost: estimatedCost,
      });
    }

    await logAIUsage(supabaseAdmin, {
      actionType: 'mcq_generation',
      modelName: generationModel.model_name,
      inputTokens: estimatedTokens.inputTokens,
      outputTokens: estimatedTokens.outputTokens,
      relatedBatchId: batchId,
      adminUserId: adminUser.id,
      success: true,
    });

    return NextResponse.json({
      batchId,
      quantityRequested: body.quantity,
      quantityGenerated,
      quantityInserted,
      quantityRejected,
      modelUsed: generationModel.model_name,
      estimatedCost,
      insertedIds,
      integrityResults,
      rejected,
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

    console.error('Question generation failed:', err);
    return NextResponse.json({ error: err.message || 'Question generation failed.' }, { status: 500 });
  }
}
