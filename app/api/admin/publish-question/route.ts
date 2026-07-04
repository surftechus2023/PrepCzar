import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { publishQuestion } from '@/lib/editorial/ai-editorial-pipeline';
import { getSupabaseAdmin, requireAdmin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  question_id: z.string().uuid(),
  override_reason: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const adminUser = await requireAdmin(req);
    if (!adminUser) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid publish request', details: parsed.error.flatten() }, { status: 400 });
    }

    const result = await publishQuestion(
      getSupabaseAdmin(),
      parsed.data.question_id,
      adminUser.id,
      parsed.data.override_reason?.trim() || undefined
    );

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Publish failed.' }, { status: 500 });
  }
}
