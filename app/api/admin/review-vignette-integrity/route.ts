import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin, requireAdmin } from '@/lib/server-auth';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { reviewVignetteIntegrity } from '@/lib/content-integrity/study-content-review';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  vignette_id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const adminUser = await requireAdmin(req);
    if (!adminUser) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const limited = await enforceRateLimit(req, { keyPrefix: 'admin:vignette-integrity', actorId: adminUser.id, limit: 80, windowMs: 60 * 60 * 1000 });
    if (limited) return limited;

    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid vignette review request', details: parsed.error.flatten() }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: vignette, error: loadError } = await supabaseAdmin
      .from('case_vignettes')
      .select('*')
      .eq('id', parsed.data.vignette_id)
      .maybeSingle();

    if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
    if (!vignette) return NextResponse.json({ error: 'Vignette not found' }, { status: 404 });

    const result = await reviewVignetteIntegrity({ supabaseAdmin, vignette, adminUserId: adminUser.id });
    const updateValues = {
      integrity_status: result.integrity_status,
      integrity_score: Math.round(result.integrity_score),
      blueprint_alignment_score: Math.round(result.blueprint_alignment_score),
      difficulty_quality_score: Math.round(result.difficulty_quality_score),
      content_quality_score: Math.round(result.content_quality_score),
      bias_score: Math.round(result.bias_score),
      ai_review_notes: result.review_notes,
      quality_flags: result.quality_flags,
      reviewed_by_ai: true,
      ai_review_model: result.model_used,
      ai_reviewed_at: new Date().toISOString(),
      reviewed: result.integrity_status === 'passed',
      active: result.integrity_status === 'passed' ? vignette.active : false,
    };

    const { data: updated, error: updateError } = await (supabaseAdmin as any)
      .from('case_vignettes')
      .update(updateValues)
      .eq('id', vignette.id)
      .select('*, exam_track:exam_tracks(name)')
      .single();

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ result, vignette: updated });
  } catch (err: any) {
    console.error('Vignette integrity review failed:', err);
    return NextResponse.json({ error: err.message || 'Vignette integrity review failed.' }, { status: 500 });
  }
}
