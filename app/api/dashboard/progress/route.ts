import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getSupabaseAdmin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function percent(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

function summarizeResponses(responses: any[], key: string) {
  const grouped = new Map<string, { label: string; attempts: number; correct: number; totalTimeMs: number; timed: number }>();

  responses.forEach((response) => {
    const label = String(response[key] || 'Unmapped').trim();
    if (!label || label === 'null') return;
    const existing = grouped.get(label) || { label, attempts: 0, correct: 0, totalTimeMs: 0, timed: 0 };
    existing.attempts += 1;
    if (response.is_correct) existing.correct += 1;
    if (typeof response.time_spent_ms === 'number' && response.time_spent_ms > 0) {
      existing.totalTimeMs += response.time_spent_ms;
      existing.timed += 1;
    }
    grouped.set(label, existing);
  });

  return Array.from(grouped.values())
    .map((item) => ({
      label: item.label,
      attempts: item.attempts,
      score: percent(item.correct, item.attempts),
      averageResponseTimeSeconds: item.timed > 0 ? Math.round((item.totalTimeMs / item.timed) / 1000) : null,
    }))
    .sort((left, right) => left.score - right.score);
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
    const sessionIds = sessions.map((session: any) => session.id);

    const responsesRes = sessionIds.length
      ? await (supabaseAdmin as any)
          .from('responses')
          .select('*')
          .in('session_id', sessionIds)
      : { data: [], error: null };

    if (responsesRes.error) return NextResponse.json({ error: responsesRes.error.message }, { status: 500 });
    const responses = responsesRes.data || [];

    const weakTopicIds = Array.from(new Set(
      scores.flatMap((score: any) => Array.isArray(score.weak_topics) ? score.weak_topics : [])
        .filter((topic: unknown): topic is string => typeof topic === 'string' && isUuid(topic))
    ));

    const topicTitleMap = new Map<string, string>();
    if (weakTopicIds.length > 0) {
      const { data: topics, error: topicsError } = await supabaseAdmin
        .from('topics')
        .select('id, title')
        .in('id', weakTopicIds);

      if (topicsError) return NextResponse.json({ error: topicsError.message }, { status: 500 });
      (topics || []).forEach((topic: any) => {
        topicTitleMap.set(topic.id, topic.title);
      });
    }

    const weakDomainMap = new Map<string, number>();
    scores.forEach((score: any) => {
      const weakTopics = Array.isArray(score.weak_topics) ? score.weak_topics : [];
      weakTopics.forEach((topic: unknown) => {
        const rawLabel = typeof topic === 'string' ? topic : JSON.stringify(topic);
        const label = isUuid(rawLabel) ? topicTitleMap.get(rawLabel) : rawLabel;
        if (!label) return;
        weakDomainMap.set(label, (weakDomainMap.get(label) || 0) + 1);
      });
    });

    sessions.forEach((session: any) => {
      const weakDomains = session.metadata?.weakDomains;
      if (!weakDomains || typeof weakDomains !== 'object' || Array.isArray(weakDomains)) return;
      Object.entries(weakDomains).forEach(([label, count]) => {
        if (!label || isUuid(label)) return;
        weakDomainMap.set(label, (weakDomainMap.get(label) || 0) + Number(count || 1));
      });
    });

    const domainPerformance = summarizeResponses(responses, 'domain_title');
    const competencyPerformance = summarizeResponses(responses, 'competency_title');
    const difficultyPerformance = summarizeResponses(responses, 'difficulty');
    const cognitiveLevelPerformance = summarizeResponses(responses, 'cognitive_level');
    const timedResponses = responses
      .map((response: any) => Number(response.time_spent_ms || 0))
      .filter((time: number) => time > 0);
    const weakAreas = [...domainPerformance, ...competencyPerformance]
      .filter((item) => item.attempts >= 2 && item.score < 70)
      .slice(0, 6);
    const strengths = [...domainPerformance, ...competencyPerformance]
      .filter((item) => item.attempts >= 2 && item.score >= 80)
      .sort((left, right) => right.score - left.score)
      .slice(0, 6);

    const diagnostics = {
      averageScore: average(scores.map((score: any) => Number(score.score || 0))),
      recentAverage: average(recentScores),
      previousAverage: average(olderScores),
      improvementTrend: average(recentScores) - average(olderScores),
      completedSessions: completed.length,
      incompleteSessions: incomplete.length,
      completionRate: percent(completed.length, sessions.length),
      averageResponseTimeSeconds: timedResponses.length ? Math.round(average(timedResponses) / 1000) : null,
      weakBlueprintDomains: Array.from(weakDomainMap.entries())
        .sort((left, right) => right[1] - left[1])
        .slice(0, 5)
        .map(([label, count]) => ({ label, count })),
      domainPerformance,
      competencyPerformance,
      difficultyPerformance,
      cognitiveLevelPerformance,
      weakAreas,
      strengths,
      practiceHistory: sessions.map((session: any) => ({
        id: session.id,
        mode: session.mode,
        examTrack: session.exam_track?.name || session.exam?.name || 'Exam',
        completed: session.completed,
        score: session.score_percent,
        startedAt: session.started_at,
        completedAt: session.completed_at,
      })),
      scoreTrend: scores.slice(0, 20).reverse().map((score: any, index: number) => ({
        label: `Attempt ${index + 1}`,
        score: Math.round(Number(score.score || 0)),
        createdAt: score.created_at,
        examTrack: score.exam_track?.name || score.exam?.name || 'Exam',
      })),
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
