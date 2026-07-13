import { NextRequest, NextResponse } from 'next/server';
import { assertActiveExamTrackAccess } from '@/lib/access/server';
import { getAuthenticatedUser, getSupabaseAdmin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { sessionId, examTrackId, caseVignetteId, responseText, selfScore } = await req.json();
    if (!sessionId || !examTrackId || !caseVignetteId || !String(responseText || '').trim()) {
      return NextResponse.json({ error: 'Session, exam track, vignette, and response are required.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    await assertActiveExamTrackAccess(supabaseAdmin, authUser.id, examTrackId);

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('practice_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (sessionError) throw new Error(sessionError.message);
    if (!session) return NextResponse.json({ error: 'Practice session not found.' }, { status: 404 });

    const { error } = await (supabaseAdmin as any)
      .from('vignette_responses')
      .upsert({
        session_id: sessionId,
        user_id: authUser.id,
        case_vignette_id: caseVignetteId,
        response_text: responseText,
        self_score: typeof selfScore === 'number' ? selfScore : null,
      }, { onConflict: 'session_id,case_vignette_id' });

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
