import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin, requireAdmin } from '@/lib/server-auth';
import {
  QUESTION_GENERATOR_MODEL,
  QUESTION_PROMPT_VERSION,
  generateQuestions,
} from '@/lib/openai/question-generator';
import {
  loadExistingQuestionFingerprints,
  validateQuestionQuality,
} from '@/lib/content-quality/question-quality';
import { checkAndUpdateQuestionIntegrity } from '@/lib/content-integrity/question-integrity-checker';
import {
  evaluateGeneratedQuestionIntegrity,
  improveGeneratedQuestionOnce,
} from '@/lib/content-integrity/question-improver';
import { getExamTrackRules, isRecallOnlyStem } from '@/lib/content-generation/exam-track-rules';

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
  intendedDifficulty: z.enum(['easy', 'medium', 'hard']).optional().nullable(),
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

    const [trackRes, topicRes] = await Promise.all([
      supabaseAdmin
        .from('exam_tracks')
        .select('id, name, full_name, official_source_url, official_exam_description')
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

    const effectiveSubtopic = selectedSubtopic?.title || selectedBlueprintItem?.competency_section || body.subtopic;
    const effectiveLearningObjective = selectedBlueprintItem?.applied_knowledge_statement || selectedSubtopic?.learning_objective || body.learningObjective;
    const blueprintReferenceText = [
      selectedBlueprintItem?.official_blueprint_text,
      selectedBlueprintItem?.applied_knowledge_statement,
      selectedBlueprintItem?.competency_section,
      selectedBlueprintItem?.major_content_area,
      selectedSubtopic?.official_blueprint_text,
      topicRes.data.official_blueprint_text,
      effectiveLearningObjective,
    ].filter((value) => typeof value === 'string' && value.trim()).join('\n\n');

    const { data: batch, error: batchError } = await supabaseAdmin
      .from('ai_generation_batches')
      .insert({
        admin_user_id: adminUser.id,
        exam_track_id: body.examTrackId,
        topic_id: body.topicId,
        content_type: 'mcq',
        quantity_requested: body.quantity,
        status: 'running',
        model_used: QUESTION_GENERATOR_MODEL,
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
      body.topicId
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
        topicId: body.topicId,
        subtopicId: body.subtopicId || null,
        examTrackName: examName,
        officialSourceUrl: trackRes.data.official_source_url,
        officialExamDescription: trackRes.data.official_exam_description,
        topicTitle: topicRes.data.title,
        topicDescription: topicRes.data.description,
        topicOfficialBlueprintText: topicRes.data.official_blueprint_text,
        topicWeightPercent: topicRes.data.official_weight_percent,
        subtopic: effectiveSubtopic,
        subtopicDescription: selectedSubtopic?.description,
        subtopicOfficialBlueprintText: selectedSubtopic?.official_blueprint_text,
        learningObjective: effectiveLearningObjective,
        blueprintReferenceText,
        socialWorkBlueprintItemId: selectedBlueprintItem?.id || null,
        socialWorkExamLevel: selectedBlueprintItem?.exam_level || null,
        majorContentArea: selectedBlueprintItem?.major_content_area || null,
        percentageWeight: selectedBlueprintItem?.percentage_weight ?? null,
        competencySection: selectedBlueprintItem?.competency_section || null,
        appliedKnowledgeStatement: selectedBlueprintItem?.applied_knowledge_statement || null,
        cognitiveLevelGuidance: selectedBlueprintItem?.cognitive_level_guidance || null,
        sampleStyleGuidance: selectedBlueprintItem?.sample_style_guidance || null,
        intendedCognitiveLevel: body.intendedCognitiveLevel || null,
        intendedDifficulty: body.intendedDifficulty || null,
        quantity,
        difficultyMix: body.difficultyMix,
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
          topicId: body.topicId,
          topicTitle: topicRes.data.title,
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
            topicId: body.topicId,
            examTrackName: examName,
            officialSourceUrl: trackRes.data.official_source_url,
            officialExamDescription: trackRes.data.official_exam_description,
            topicTitle: topicRes.data.title,
            topicDescription: topicRes.data.description,
            topicOfficialBlueprintText: topicRes.data.official_blueprint_text,
            topicWeightPercent: topicRes.data.official_weight_percent,
            subtopicId: body.subtopicId || null,
            subtopic: effectiveSubtopic,
            subtopicDescription: selectedSubtopic?.description,
            subtopicOfficialBlueprintText: selectedSubtopic?.official_blueprint_text,
            learningObjective: effectiveLearningObjective,
            blueprintReferenceText,
            socialWorkBlueprintItem: selectedBlueprintItem,
            intendedCognitiveLevel: body.intendedCognitiveLevel || null,
            intendedDifficulty: body.intendedDifficulty || null,
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
            || integrity.blueprint_alignment_score < 90
            || integrity.difficulty_quality_score < examTrackRules.minimumDifficultyQualityScore
            || integrity.integrity_score < 85
          )
        ) {
          const improved = await improveGeneratedQuestionOnce({
            question,
            metadata: {
              examTrackId: body.examTrackId,
              topicId: body.topicId,
              examTrackName: examName,
              officialSourceUrl: trackRes.data.official_source_url,
              officialExamDescription: trackRes.data.official_exam_description,
              topicTitle: topicRes.data.title,
              topicDescription: topicRes.data.description,
              topicOfficialBlueprintText: topicRes.data.official_blueprint_text,
              topicWeightPercent: topicRes.data.official_weight_percent,
              subtopicId: body.subtopicId || null,
              subtopic: effectiveSubtopic,
              subtopicDescription: selectedSubtopic?.description,
              subtopicOfficialBlueprintText: selectedSubtopic?.official_blueprint_text,
              learningObjective: effectiveLearningObjective,
              blueprintReferenceText,
              socialWorkBlueprintItem: selectedBlueprintItem,
              intendedCognitiveLevel: body.intendedCognitiveLevel || null,
              intendedDifficulty: body.intendedDifficulty || null,
            },
            integrityResult: integrity,
          });

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
          topic_id: body.topicId,
          subtopic_id: body.subtopicId || null,
          social_work_blueprint_item_id: selectedBlueprintItem?.id || null,
          blueprint_content_area: selectedBlueprintItem?.major_content_area || null,
          blueprint_competency_section: selectedBlueprintItem?.competency_section || null,
          applied_knowledge_statement: selectedBlueprintItem?.applied_knowledge_statement || null,
          question_writing_guideline: selectedBlueprintItem?.sample_style_guidance || null,
          intended_cognitive_level: body.intendedCognitiveLevel || null,
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
        topic_id: body.topicId,
        content_type: 'mcq',
        requested_count: body.quantity,
        generated_count: quantityInserted,
        duplicate_count: quantityRejected,
        status: 'success',
      });
    }

    return NextResponse.json({
      batchId,
      quantityRequested: body.quantity,
      quantityGenerated,
      quantityInserted,
      quantityRejected,
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
