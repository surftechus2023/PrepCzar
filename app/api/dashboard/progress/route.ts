import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getSupabaseAdmin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const scoreLimit = Number(searchParams.get('scoreLimit') || 30);
    const sessionLimit = Number(searchParams.get('sessionLimit') || 20);
    const supabaseAdmin = getSupabaseAdmin();

    const [scoresRes, sessionsRes] = await Promise.all([
      supabaseAdmin
        .from('scores')
        .select('*, exam_track:exam_tracks(*)')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(Number.isFinite(scoreLimit) ? scoreLimit : 30),
      supabaseAdmin
        .from('practice_sessions')
        .select('*, exam_track:exam_tracks(*)')
        .eq('user_id', authUser.id)
        .order('started_at', { ascending: false })
        .limit(Number.isFinite(sessionLimit) ? sessionLimit : 20),
    ]);

    const error = scoresRes.error || sessionsRes.error;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      scores: scoresRes.data || [],
      sessions: sessionsRes.data || [],
    });
  } catch (err: any) {
    console.error('Dashboard progress error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
