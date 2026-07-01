import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireAdmin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

type AnalyticsRow = {
  userId: string;
  studentName: string;
  email: string;
  trackId: string | null;
  trackName: string;
  accessActive: boolean;
  attempts: number;
  completedAttempts: number;
  averageScore: number | null;
  bestScore: number | null;
  passStatus: string;
  diagnosis: string;
  lastActivity: string | null;
};

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function latestDate(...dates: Array<string | null | undefined>) {
  const validDates = dates.filter(Boolean) as string[];
  if (validDates.length === 0) return null;
  return validDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
}

function summarizeWeakTopics(value: unknown): string {
  if (!value) return '';

  if (Array.isArray(value)) {
    return value
      .map((topic) => {
        if (typeof topic === 'string') return topic;
        if (topic && typeof topic === 'object') {
          const record = topic as Record<string, unknown>;
          return String(record.title || record.name || record.topic || '').trim();
        }
        return '';
      })
      .filter(Boolean)
      .slice(0, 3)
      .join(', ');
  }

  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .sort(([, a], [, b]) => Number(b) - Number(a))
      .slice(0, 3)
      .map(([topic]) => topic)
      .join(', ');
  }

  return String(value);
}

function getPassStatus(bestScore: number | null, averageScore: number | null, attempts: number) {
  const score = bestScore ?? averageScore;
  if (score === null || attempts === 0) return 'No attempts';
  if (score >= 70) return 'Likely pass';
  if (score >= 60) return 'Borderline';
  return 'Needs support';
}

export async function GET(req: NextRequest) {
  try {
    const adminUser = await requireAdmin(req);
    if (!adminUser) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const [usersRes, accessRes, tracksRes, sessionsRes, scoresRes] = await Promise.all([
      supabaseAdmin.from('users').select('id,email,full_name,role,created_at').order('created_at', { ascending: false }),
      supabaseAdmin.from('user_exam_access').select('*').order('granted_at', { ascending: false }),
      supabaseAdmin.from('exam_tracks').select('id,name,slug').order('name'),
      supabaseAdmin.from('practice_sessions').select('*').order('started_at', { ascending: false }).limit(5000),
      supabaseAdmin.from('scores').select('*').order('created_at', { ascending: false }).limit(5000),
    ]);

    const error = usersRes.error || accessRes.error || tracksRes.error || sessionsRes.error || scoresRes.error;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const tracksById = new Map((tracksRes.data || []).map((track: any) => [track.id, track]));
    const sessions = sessionsRes.data || [];
    const scores = scoresRes.data || [];
    const students = (usersRes.data || []).filter((user: any) => user.role !== 'admin');

    const rows: AnalyticsRow[] = [];

    for (const student of students) {
      const studentAccess = (accessRes.data || []).filter((access: any) => access.user_id === student.id);
      const trackIds = new Set<string | null>(
        studentAccess.length > 0
          ? studentAccess.map((access: any) => access.exam_track_id)
          : [
              ...sessions.filter((session: any) => session.user_id === student.id).map((session: any) => session.exam_track_id),
              ...scores.filter((score: any) => score.user_id === student.id).map((score: any) => score.exam_track_id),
            ]
      );

      if (trackIds.size === 0) trackIds.add(null);

      for (const trackId of Array.from(trackIds)) {
        const track = trackId ? tracksById.get(trackId) : null;
        const trackAccess = studentAccess.find((access: any) => access.exam_track_id === trackId);
        const trackSessions = sessions.filter((session: any) => (
          session.user_id === student.id && (trackId ? session.exam_track_id === trackId : !session.exam_track_id)
        ));
        const trackScores = scores.filter((score: any) => (
          score.user_id === student.id && (trackId ? score.exam_track_id === trackId : !score.exam_track_id)
        ));

        const scoreValues = [
          ...trackSessions.map((session: any) => asNumber(session.score_percent)).filter((score): score is number => score !== null),
          ...trackScores.map((score: any) => asNumber(score.score)).filter((score): score is number => score !== null),
        ];
        const averageScore = scoreValues.length > 0
          ? Math.round(scoreValues.reduce((total, score) => total + score, 0) / scoreValues.length)
          : null;
        const bestScore = scoreValues.length > 0 ? Math.round(Math.max(...scoreValues)) : null;
        const latestScore = trackScores[0];
        const latestSession = trackSessions[0];
        const lastActivity = latestDate(latestScore?.created_at, latestSession?.completed_at, latestSession?.started_at);
        const diagnosis = summarizeWeakTopics(latestScore?.weak_topics);

        rows.push({
          userId: student.id,
          studentName: student.full_name || 'Unnamed student',
          email: student.email,
          trackId,
          trackName: track?.name || 'No exam track',
          accessActive: Boolean(trackAccess?.active),
          attempts: trackSessions.length,
          completedAttempts: trackSessions.filter((session: any) => session.completed).length,
          averageScore,
          bestScore,
          passStatus: getPassStatus(bestScore, averageScore, trackSessions.length),
          diagnosis: diagnosis || 'No weak areas recorded',
          lastActivity,
        });
      }
    }

    const activeEnrollments = rows.filter((row) => row.accessActive).length;
    const totalAttempts = rows.reduce((total, row) => total + row.attempts, 0);
    const averageScores = rows.map((row) => row.averageScore).filter((score): score is number => score !== null);

    return NextResponse.json({
      summary: {
        students: students.length,
        activeEnrollments,
        totalAttempts,
        averageScore: averageScores.length > 0
          ? Math.round(averageScores.reduce((total, score) => total + score, 0) / averageScores.length)
          : null,
      },
      rows,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
