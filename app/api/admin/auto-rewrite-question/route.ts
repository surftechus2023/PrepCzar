import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
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
    const rewrite = await autoRewriteQuestion(supabaseAdmin, parsed.data.question_id, parsed.data.committee_changes || []);
    const review = rewrite.status === 'rewritten'
      ? await runEditorialReview(supabaseAdmin, parsed.data.question_id)
      : null;

    return NextResponse.json({ ...rewrite, review });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Auto-rewrite failed.' }, { status: 500 });
  }
}
