import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { runEditorialReview } from '@/lib/editorial/ai-editorial-pipeline';
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
      return NextResponse.json({ error: 'Invalid editorial review request', details: parsed.error.flatten() }, { status: 400 });
    }

    const result = await runEditorialReview(getSupabaseAdmin(), parsed.data.question_id);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Editorial review failed.' }, { status: 500 });
  }
}
