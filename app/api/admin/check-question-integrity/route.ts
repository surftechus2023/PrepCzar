import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkAndUpdateQuestionIntegrity } from '@/lib/content-integrity/question-integrity-checker';
import { getSupabaseAdmin, requireAdmin } from '@/lib/server-auth';
import { enforceRateLimit } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  question_id: z.string().uuid().optional(),
  generation_batch_id: z.string().uuid().optional(),
}).refine((value) => value.question_id || value.generation_batch_id, {
  message: 'question_id or generation_batch_id is required',
});

export async function POST(req: NextRequest) {
  try {
    const adminUser = await requireAdmin(req);
    if (!adminUser) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    const limited = await enforceRateLimit(req, { keyPrefix: 'admin:integrity-review', actorId: adminUser.id, limit: 60, windowMs: 60 * 60 * 1000 });
    if (limited) return limited;

    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid integrity check request', details: parsed.error.flatten() }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    let questionIds: string[] = [];

    if (parsed.data.question_id) {
      questionIds = [parsed.data.question_id];
    } else if (parsed.data.generation_batch_id) {
      const { data, error } = await supabaseAdmin
        .from('questions')
        .select('id')
        .eq('generation_batch_id', parsed.data.generation_batch_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      questionIds = (data || []).map((question: { id: string }) => question.id);
    }

    const results = [];
    for (const questionId of questionIds) {
      const checked = await checkAndUpdateQuestionIntegrity(supabaseAdmin, questionId);
      results.push({
        question_id: questionId,
        score: checked.result.integrity_score,
        status: checked.result.integrity_status,
        quality_flags: checked.result.quality_flags,
        distractor_flags: checked.result.distractor_flags,
        bias_flags: checked.result.bias_flags,
        blueprint_alignment_score: checked.result.blueprint_alignment_score,
        difficulty_quality_score: checked.result.difficulty_quality_score,
        predicted_difficulty: checked.result.predicted_difficulty,
        cognitive_level_detected: checked.result.cognitive_level_detected,
        plagiarism_risk_score: checked.result.plagiarism_risk_score,
        question: checked.question,
      });
    }

    return NextResponse.json({ count: results.length, results });
  } catch (err: any) {
    console.error('Question integrity check failed:', err);
    return NextResponse.json({ error: err.message || 'Question integrity check failed.' }, { status: 500 });
  }
}
