import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getSupabaseAdmin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

type PracticeMode = 'mcq' | 'flashcard' | 'vignette';
type SelectedAnswer = 'a' | 'b' | 'c' | 'd';

function isPracticeMode(value: unknown): value is PracticeMode {
  return value === 'mcq' || value === 'flashcard' || value === 'vignette';
}

function isSelectedAnswer(value: unknown): value is SelectedAnswer {
  return value === 'a' || value === 'b' || value === 'c' || value === 'd';
}

async function userHasAccess(userId: string, examTrackId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('user_exam_access')
    .select('id')
    .eq('user_id', userId)
    .eq('exam_track_id', examTrackId)
    .eq('active', true)
    .limit(1);

  if (error) throw error;
  return Boolean(data?.length);
}

async function getUserSession(userId: string, sessionId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('practice_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { examTrackId, mode } = await req.json();
    if (!examTrackId || !isPracticeMode(mode)) {
      return NextResponse.json({ error: 'Exam track and practice mode are required' }, { status: 400 });
    }

    if (!(await userHasAccess(authUser.id, examTrackId))) {
      return NextResponse.json({ error: 'No active access for this exam track' }, { status: 403 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from('practice_sessions')
      .insert({
        user_id: authUser.id,
        exam_track_id: examTrackId,
        mode,
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ session: data });
  } catch (err: any) {
    console.error('Create practice session error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId, questionId, selectedAnswer, isCorrect } = await req.json();
    if (!sessionId || !questionId || !isSelectedAnswer(selectedAnswer) || typeof isCorrect !== 'boolean') {
      return NextResponse.json({ error: 'Session, question, answer, and correctness are required' }, { status: 400 });
    }

    const session = await getUserSession(authUser.id, sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Practice session not found' }, { status: 404 });
    }

    const { error } = await getSupabaseAdmin()
      .from('responses')
      .insert({
        session_id: sessionId,
        question_id: questionId,
        selected_answer: selectedAnswer,
        is_correct: isCorrect,
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Record practice response error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId, scorePercent, weakTopics } = await req.json();
    if (!sessionId || typeof scorePercent !== 'number') {
      return NextResponse.json({ error: 'Session and score are required' }, { status: 400 });
    }

    const session = await getUserSession(authUser.id, sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Practice session not found' }, { status: 404 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { error: sessionError } = await supabaseAdmin
      .from('practice_sessions')
      .update({
        completed: true,
        completed_at: new Date().toISOString(),
        score_percent: scorePercent,
      })
      .eq('id', sessionId)
      .eq('user_id', authUser.id);

    if (sessionError) {
      return NextResponse.json({ error: sessionError.message }, { status: 500 });
    }

    const { error: scoreError } = await supabaseAdmin
      .from('scores')
      .insert({
        user_id: authUser.id,
        exam_track_id: session.exam_track_id || undefined,
        exam_id: session.exam_id || undefined,
        score: scorePercent,
        weak_topics: Array.isArray(weakTopics) ? weakTopics : [],
      });

    if (scoreError) {
      return NextResponse.json({ error: scoreError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Complete practice session error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
