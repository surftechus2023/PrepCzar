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
  subtopic: z.string().min(2),
  learningObjective: z.string().min(5),
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
        .select('id, name, full_name')
        .eq('id', body.examTrackId)
        .eq('active', true)
        .single(),
      supabaseAdmin
        .from('topics')
        .select('id, title, exam_track_id')
        .eq('id', body.topicId)
        .eq('exam_track_id', body.examTrackId)
        .single(),
    ]);

    if (trackRes.error || topicRes.error || !trackRes.data || !topicRes.data) {
      return NextResponse.json({ error: 'Exam track or topic not found.' }, { status: 404 });
    }

    const examName = trackRes.data.full_name || trackRes.data.name;

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
        examTrackName: examName,
        topicTitle: topicRes.data.title,
        subtopic: body.subtopic,
        learningObjective: body.learningObjective,
        quantity,
        difficultyMix: body.difficultyMix,
        cognitiveLevelMix: body.cognitiveLevelMix,
      });

      if (generated.length === 0) {
        throw new Error('OpenAI returned zero questions for a generation chunk.');
      }

      quantityGenerated += generated.length;

      const acceptedRows = generated.flatMap((question) => {
        const quality = validateQuestionQuality(question, {
          examTrackId: body.examTrackId,
          topicId: body.topicId,
          topicTitle: topicRes.data.title,
          subtopic: body.subtopic,
          learningObjective: body.learningObjective,
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
          return [];
        }

        seenHashes.add(quality.duplicateHash);
        existingQuestions.push({
          question_en: question.question,
          duplicate_hash: quality.duplicateHash,
        });

        const row = {
          exam_track_id: body.examTrackId,
          topic_id: body.topicId,
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

        if (!supportsQualityMetadata) return [row];

        return [{
          ...row,
          correct_rationale_en: question.correct_rationale,
          option_a_rationale_en: question.option_a_rationale,
          option_b_rationale_en: question.option_b_rationale,
          option_c_rationale_en: question.option_c_rationale,
          option_d_rationale_en: question.option_d_rationale,
          test_taking_tip_en: question.test_taking_tip,
          cognitive_level: question.cognitive_level,
          subtopic: question.subtopic || body.subtopic,
          learning_objective: question.learning_objective || body.learningObjective,
          source_topic: question.source_topic || question.topic,
          duplicate_hash: quality.duplicateHash,
          quality_score: quality.qualityScore,
          review_notes: quality.reviewNotes.join('\n'),
          generation_batch_id: batchId,
          generated_by_ai: true,
        }];
      });

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
