import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getSupabaseAdmin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const scoreLimit = Number(searchParams.get('scoreLimit') || 30);
    const sessionLimit = Number(searchParams.get('sessionLimit') || 20);
    const supabaseAdmin = getSupabaseAdmin();

    const [scoresRes, sessionsRes, subscriptionsRes] = await Promise.all([
      supabaseAdmin
        .from('scores')
        .select('*, exam_track:exam_tracks(*)')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(Number.isFinite(scoreLimit) ? scoreLimit : 30),
      (supabaseAdmin as any)
        .from('practice_sessions')
        .select('*, exam_track:exam_tracks(*)')
        .eq('user_id', authUser.id)
        .order('started_at', { ascending: false })
        .limit(Number.isFinite(sessionLimit) ? sessionLimit : 20),
      supabaseAdmin
        .from('subscriptions')
        .select('*, exam_track:exam_tracks(*)')
        .eq('user_id', authUser.id)
        .in('status', ['active', 'trialing', 'past_due']),
    ]);

    const error = scoresRes.error || sessionsRes.error || subscriptionsRes.error;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const sessions = sessionsRes.data || [];
    const completed = sessions.filter((session: any) => session.completed);
    const incomplete = sessions.filter((session: any) => !session.completed);
    const scores = scoresRes.data || [];
    const recentScores = scores.slice(0, 5).map((score: any) => Number(score.score || 0));
    const olderScores = scores.slice(5, 10).map((score: any) => Number(score.score || 0));

    const weakDomainMap = new Map<string, number>();
    scores.forEach((score: any) => {
      const weakTopics = Array.isArray(score.weak_topics) ? score.weak_topics : [];
      weakTopics.forEach((topic: unknown) => {
        const label = typeof topic === 'string' ? topic : JSON.stringify(topic);
        weakDomainMap.set(label, (weakDomainMap.get(label) || 0) + 1);
      });
    });

    const diagnostics = {
      averageScore: average(scores.map((score: any) => Number(score.score || 0))),
      recentAverage: average(recentScores),
      previousAverage: average(olderScores),
      improvementTrend: average(recentScores) - average(olderScores),
      completedSessions: completed.length,
      incompleteSessions: incomplete.length,
      weakBlueprintDomains: Array.from(weakDomainMap.entries())
        .sort((left, right) => right[1] - left[1])
        .slice(0, 5)
        .map(([label, count]) => ({ label, count })),
      byMode: ['mcq', 'flashcard', 'vignette'].map((mode) => {
        const modeSessions = completed.filter((session: any) => session.mode === mode);
        return {
          mode,
          completed: modeSessions.length,
          averageScore: average(modeSessions.map((session: any) => Number(session.score_percent || 0))),
        };
      }),
    };

    return NextResponse.json({
      scores,
      sessions,
      subscriptions: subscriptionsRes.data || [],
      diagnostics,
      disclaimer: 'PrepCzar scores estimate practice performance and do not predict official exam results with certainty.',
    });
  } catch (err: any) {
    console.error('Dashboard progress error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
