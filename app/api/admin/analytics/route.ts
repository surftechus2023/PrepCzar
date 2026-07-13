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

type CsvRow = Record<string, string | number | boolean | null | undefined>;

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function percent(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : null;
}

function toCsv(rows: CsvRow[]) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const text = value === null || typeof value === 'undefined' ? '' : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(',')),
  ].join('\n');
}

function csvResponse(filename: string, rows: CsvRow[]) {
  return new NextResponse(toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
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

    const exportType = new URL(req.url).searchParams.get('export');
    const supabaseAdmin = getSupabaseAdmin();
    const [usersRes, accessRes, tracksRes, sessionsRes, scoresRes, questionsRes, responsesRes, topicsRes, subscriptionsRes] = await Promise.all([
      supabaseAdmin.from('users').select('id,email,full_name,role,created_at').order('created_at', { ascending: false }),
      supabaseAdmin.from('user_exam_access').select('*').order('granted_at', { ascending: false }),
      supabaseAdmin.from('exam_tracks').select('id,name,slug,monthly_price').order('name'),
      supabaseAdmin.from('practice_sessions').select('*').order('started_at', { ascending: false }).limit(5000),
      supabaseAdmin.from('scores').select('*').order('created_at', { ascending: false }).limit(5000),
      supabaseAdmin.from('questions').select('id,exam_track_id,topic_id,blueprint_content_area,blueprint_competency_section,difficulty,cognitive_level,intended_cognitive_level,correct_option,active,reviewed,integrity_status,committee_status,blueprint_alignment_score,difficulty_quality_score,integrity_score,auto_improved,improvement_attempts,created_at').limit(10000),
      (supabaseAdmin as any).from('responses').select('*').limit(20000),
      supabaseAdmin.from('topics').select('id,exam_track_id,title,official_weight_percent'),
      supabaseAdmin.from('subscriptions').select('id,user_id,exam_track_id,status,created_at').limit(10000),
    ]);

    const error = usersRes.error || accessRes.error || tracksRes.error || sessionsRes.error || scoresRes.error || questionsRes.error || responsesRes.error || topicsRes.error || subscriptionsRes.error;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const tracksById = new Map((tracksRes.data || []).map((track: any) => [track.id, track]));
    const topicsById = new Map((topicsRes.data || []).map((topic: any) => [topic.id, topic]));
    const sessions = sessionsRes.data || [];
    const scores = scoresRes.data || [];
    const questions = questionsRes.data || [];
    const responses = responsesRes.data || [];
    const subscriptions = subscriptionsRes.data || [];
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

    const questionsById = new Map(questions.map((question: any) => [question.id, question]));
    const contentByTrack = Array.from(tracksById.values()).map((track: any) => {
      const trackQuestions = questions.filter((question: any) => question.exam_track_id === track.id);
      const reviewed = trackQuestions.filter((question: any) => question.reviewed).length;
      const pending = trackQuestions.filter((question: any) => !question.reviewed || question.integrity_status === 'pending').length;
      const passed = trackQuestions.filter((question: any) => question.integrity_status === 'passed').length;
      const autoImproved = trackQuestions.filter((question: any) => question.auto_improved).length;
      const autoImprovedPassed = trackQuestions.filter((question: any) => question.auto_improved && question.integrity_status === 'passed').length;
      return {
        trackId: track.id,
        trackName: track.name,
        activeQuestions: trackQuestions.filter((question: any) => question.active).length,
        totalQuestions: trackQuestions.length,
        reviewed,
        pending,
        integrityPassRate: percent(passed, trackQuestions.length),
        averageAlignmentScore: average(trackQuestions.map((question: any) => Number(question.blueprint_alignment_score || 0)).filter(Boolean)),
        averageDifficultyQualityScore: average(trackQuestions.map((question: any) => Number(question.difficulty_quality_score || 0)).filter(Boolean)),
        autoImprovementSuccessRate: percent(autoImprovedPassed, autoImproved),
        rejectedItemCount: trackQuestions.filter((question: any) => question.integrity_status === 'rejected' || question.committee_status === 'rejected').length,
      };
    });

    const coverage = (topicsRes.data || []).map((topic: any) => {
      const track = topic.exam_track_id ? tracksById.get(topic.exam_track_id) : null;
      const topicQuestions = questions.filter((question: any) => question.topic_id === topic.id && question.active);
      const trackActiveCount = questions.filter((question: any) => question.exam_track_id === topic.exam_track_id && question.active).length;
      return {
        trackName: track?.name || 'Unknown',
        topicName: topic.title,
        blueprintWeightPercent: topic.official_weight_percent,
        activeQuestionCount: topicQuestions.length,
        contentSharePercent: percent(topicQuestions.length, trackActiveCount),
        coverageDeltaPercent: typeof topic.official_weight_percent === 'number' && trackActiveCount > 0
          ? Math.round(((topicQuestions.length / trackActiveCount) * 100) - topic.official_weight_percent)
          : null,
      };
    }).filter((row: any) => row.activeQuestionCount > 0 || row.blueprintWeightPercent !== null);

    const responseGroups = new Map<string, any[]>();
    responses.forEach((response: any) => {
      const questionId = response.question_id || response.content_item_id;
      if (!questionId) return;
      responseGroups.set(questionId, [...(responseGroups.get(questionId) || []), response]);
    });

    const itemAnalytics = Array.from(responseGroups.entries()).map(([questionId, itemResponses]) => {
      const question = questionsById.get(questionId);
      const attempts = itemResponses.length;
      const correct = itemResponses.filter((response: any) => response.is_correct).length;
      const selections = { a: 0, b: 0, c: 0, d: 0 };
      itemResponses.forEach((response: any) => {
        if (response.selected_answer in selections) selections[response.selected_answer as 'a' | 'b' | 'c' | 'd'] += 1;
      });
      const reliable = attempts >= 30;
      return {
        questionId,
        trackName: question?.exam_track_id ? tracksById.get(question.exam_track_id)?.name || 'Unknown' : 'Unknown',
        topicName: question?.topic_id ? topicsById.get(question.topic_id)?.title || 'Unmapped' : 'Unmapped',
        attempts,
        percentCorrect: percent(correct, attempts),
        averageResponseTimeSeconds: average(itemResponses.map((response: any) => Number(response.time_spent_ms || 0)).filter(Boolean)) !== null
          ? Math.round((average(itemResponses.map((response: any) => Number(response.time_spent_ms || 0)).filter(Boolean)) || 0) / 1000)
          : null,
        distractorSelectionFrequency: selections,
        itemDifficultyEstimate: reliable ? percent(attempts - correct, attempts) : null,
        itemDiscriminationEstimate: reliable ? 'Requires upper/lower cohort calculation' : null,
        reliabilityNote: reliable ? 'Preliminary operational statistic; not validated psychometrics.' : 'Insufficient response data for reliable item statistics.',
      };
    }).sort((left, right) => right.attempts - left.attempts).slice(0, 50);

    const subscriptionSummary = {
      activeSubscriptions: subscriptions.filter((subscription: any) => subscription.status === 'active').length,
      trialingSubscriptions: subscriptions.filter((subscription: any) => subscription.status === 'trialing').length,
      estimatedMonthlyRevenue: subscriptions
        .filter((subscription: any) => subscription.status === 'active')
        .reduce((total: number, subscription: any) => total + Number((subscription.exam_track_id ? tracksById.get(subscription.exam_track_id)?.monthly_price : 0) || 0), 0),
    };

    if (exportType === 'content_inventory') {
      return csvResponse('content-inventory.csv', questions.map((question: any) => ({
        id: question.id,
        exam_track: question.exam_track_id ? tracksById.get(question.exam_track_id)?.name : '',
        topic: question.topic_id ? topicsById.get(question.topic_id)?.title : '',
        difficulty: question.difficulty,
        cognitive_level: question.cognitive_level || question.intended_cognitive_level,
        active: question.active,
        reviewed: question.reviewed,
        integrity_status: question.integrity_status,
      })));
    }

    if (exportType === 'blueprint_coverage') return csvResponse('blueprint-coverage.csv', coverage);
    if (exportType === 'question_quality') return csvResponse('question-quality-report.csv', questions.map((question: any) => ({
      id: question.id,
      exam_track: question.exam_track_id ? tracksById.get(question.exam_track_id)?.name : '',
      alignment_score: question.blueprint_alignment_score,
      difficulty_quality_score: question.difficulty_quality_score,
      integrity_score: question.integrity_score,
      integrity_status: question.integrity_status,
      auto_improved: question.auto_improved,
      improvement_attempts: question.improvement_attempts,
    })));
    if (exportType === 'item_performance') return csvResponse('item-performance-report.csv', itemAnalytics.map((item) => ({
      question_id: item.questionId,
      exam_track: item.trackName,
      topic: item.topicName,
      attempts: item.attempts,
      percent_correct: item.percentCorrect,
      average_response_time_seconds: item.averageResponseTimeSeconds,
      reliability_note: item.reliabilityNote,
    })));
    if (exportType === 'subscription_revenue') return csvResponse('subscription-revenue-summary.csv', subscriptions.map((subscription: any) => ({
      id: subscription.id,
      user_id: subscription.user_id,
      exam_track: subscription.exam_track_id ? tracksById.get(subscription.exam_track_id)?.name : '',
      status: subscription.status,
      estimated_monthly_price: subscription.exam_track_id ? tracksById.get(subscription.exam_track_id)?.monthly_price : '',
      created_at: subscription.created_at,
    })));

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
      contentAnalytics: {
        byTrack: contentByTrack,
        coverage,
      },
      itemAnalytics,
      subscriptionSummary,
      fairnessNotice: 'DIF infrastructure is preparatory only. Do not infer sensitive demographic characteristics or claim AI-only bias review is formal psychometric fairness validation.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
