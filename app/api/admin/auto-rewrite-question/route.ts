import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logAIUsage, resolveAIModelSetting } from '@/lib/ai/model-settings';
import { autoRewriteQuestion, runEditorialReview } from '@/lib/editorial/ai-editorial-pipeline';
import { getSupabaseAdmin, requireAdmin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  question_id: z.string().uuid(),
  committee_changes: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const adminUser = await requireAdmin(req);
    if (!adminUser) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid auto-rewrite request', details: parsed.error.flatten() }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const improvementModel = await resolveAIModelSetting(supabaseAdmin, 'auto_improvement');
    const integrityModel = await resolveAIModelSetting(supabaseAdmin, 'integrity_review');
    const rewrite = await autoRewriteQuestion(supabaseAdmin, parsed.data.question_id, parsed.data.committee_changes || [], improvementModel.model_name);
    const review = rewrite.status === 'rewritten'
      ? await runEditorialReview(supabaseAdmin, parsed.data.question_id, integrityModel.model_name)
      : null;
    await logAIUsage(supabaseAdmin, {
      actionType: 'auto_improvement',
      modelName: improvementModel.model_name,
      inputTokens: 2500,
      outputTokens: 1000,
      relatedRecordId: parsed.data.question_id,
      adminUserId: adminUser.id,
      success: rewrite.status === 'rewritten',
    });

    return NextResponse.json({ ...rewrite, review });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Auto-rewrite failed.' }, { status: 500 });
  }
}
