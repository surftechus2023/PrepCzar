import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logAIUsage, resolveAIModelSetting } from '@/lib/ai/model-settings';
import { runFinalReview } from '@/lib/editorial/ai-editorial-pipeline';
import { getSupabaseAdmin, requireAdmin } from '@/lib/server-auth';

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

    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid final review request', details: parsed.error.flatten() }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const model = await resolveAIModelSetting(supabaseAdmin, 'integrity_review');
    const result = await runFinalReview(supabaseAdmin, parsed.data.question_id, model.model_name);
    await logAIUsage(supabaseAdmin, {
      actionType: 'integrity_review',
      modelName: model.model_name,
      inputTokens: 1800,
      outputTokens: 700,
      relatedRecordId: parsed.data.question_id,
      adminUserId: adminUser.id,
      success: true,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Final review failed.' }, { status: 500 });
  }
}
