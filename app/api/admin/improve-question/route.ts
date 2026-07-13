import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logAIUsage, resolveAIModelSetting } from '@/lib/ai/model-settings';
import { autoImproveStoredQuestion } from '@/lib/content-integrity/question-improver';
import { getSupabaseAdmin, requireAdmin } from '@/lib/server-auth';
import { enforceRateLimit } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  question_id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const adminUser = await requireAdmin(req);
    if (!adminUser) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    const limited = await enforceRateLimit(req, { keyPrefix: 'admin:auto-improve', actorId: adminUser.id, limit: 30, windowMs: 60 * 60 * 1000 });
    if (limited) return limited;

    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid improvement request', details: parsed.error.flatten() }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const model = await resolveAIModelSetting(supabaseAdmin, 'auto_improvement');
    const checked = await autoImproveStoredQuestion(supabaseAdmin, parsed.data.question_id, model.model_name);
    await logAIUsage(supabaseAdmin, {
      actionType: 'auto_improvement',
      modelName: model.model_name,
      inputTokens: 2200,
      outputTokens: 1000,
      relatedRecordId: parsed.data.question_id,
      adminUserId: adminUser.id,
      success: true,
    });

    return NextResponse.json({
      question_id: parsed.data.question_id,
      score: checked.result.integrity_score,
      status: checked.result.integrity_status,
      blueprint_alignment_score: checked.result.blueprint_alignment_score,
      difficulty_quality_score: checked.result.difficulty_quality_score,
      question: checked.question,
    });
  } catch (err: any) {
    console.error('Question auto-improvement failed:', err);
    return NextResponse.json({ error: err.message || 'Question auto-improvement failed.' }, { status: 500 });
  }
}
