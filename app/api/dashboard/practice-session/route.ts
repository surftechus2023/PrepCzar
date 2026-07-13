import { NextRequest, NextResponse } from 'next/server';
import { assertActiveExamTrackAccess } from '@/lib/access/server';
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

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    if (!sessionId) return NextResponse.json({ error: 'Session id is required' }, { status: 400 });

    const supabaseAdmin = getSupabaseAdmin();
    const session = await getUserSession(authUser.id, sessionId);
    if (!session) return NextResponse.json({ error: 'Practice session not found' }, { status: 404 });
    if (session.exam_track_id) await assertActiveExamTrackAccess(supabaseAdmin, authUser.id, session.exam_track_id);

    const [responsesRes, vignetteResponsesRes] = await Promise.all([
      (supabaseAdmin as any).from('responses').select('*').eq('session_id', sessionId),
      (supabaseAdmin as any).from('vignette_responses').select('*').eq('session_id', sessionId),
    ]);

    return NextResponse.json({
      session,
      responses: responsesRes.data || [],
      vignetteResponses: vignetteResponsesRes.data || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { examTrackId, mode, contentItemIds = [] } = await req.json();
    if (!examTrackId || !isPracticeMode(mode)) {
      return NextResponse.json({ error: 'Exam track and practice mode are required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    await assertActiveExamTrackAccess(supabaseAdmin, authUser.id, examTrackId);

    const { data, error } = await (supabaseAdmin as any)
      .from('practice_sessions')
      .insert({
        user_id: authUser.id,
        exam_track_id: examTrackId,
        mode,
        content_item_ids: Array.isArray(contentItemIds) ? contentItemIds : [],
        total_items: Array.isArray(contentItemIds) ? contentItemIds.length : 0,
        current_index: 0,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ session: data });
  } catch (err: any) {
    console.error('Create practice session error:', err);
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { sessionId, questionId, selectedAnswer, isCorrect } = body;
    if (!sessionId || !questionId || !isSelectedAnswer(selectedAnswer) || typeof isCorrect !== 'boolean') {
      return NextResponse.json({ error: 'Session, question, answer, and correctness are required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const session = await getUserSession(authUser.id, sessionId);
    if (!session) return NextResponse.json({ error: 'Practice session not found' }, { status: 404 });
    if (session.exam_track_id) await assertActiveExamTrackAccess(supabaseAdmin, authUser.id, session.exam_track_id);

    const responsePayload: Record<string, unknown> = {
      session_id: sessionId,
      question_id: questionId,
      content_item_id: questionId,
      content_type: 'mcq',
      selected_answer: selectedAnswer,
      is_correct: isCorrect,
    };

    if (typeof body.timeSpentMs === 'number') responsePayload.time_spent_ms = body.timeSpentMs;
    if (typeof body.domainTitle === 'string') responsePayload.domain_title = body.domainTitle;
    if (typeof body.competencyTitle === 'string') responsePayload.competency_title = body.competencyTitle;
    if (typeof body.cognitiveLevel === 'string') responsePayload.cognitive_level = body.cognitiveLevel;
    if (typeof body.difficulty === 'string') responsePayload.difficulty = body.difficulty;

    const { error } = await (supabaseAdmin as any)
      .from('responses')
      .upsert(responsePayload, { onConflict: 'session_id,question_id' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (typeof body.currentIndex === 'number') {
      await (supabaseAdmin as any)
        .from('practice_sessions')
        .update({ current_index: body.currentIndex })
        .eq('id', sessionId)
        .eq('user_id', authUser.id);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Record practice response error:', err);
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { sessionId, scorePercent, weakTopics, currentIndex, metadata } = await req.json();
    if (!sessionId || typeof scorePercent !== 'number') {
      return NextResponse.json({ error: 'Session and score are required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const session = await getUserSession(authUser.id, sessionId);
    if (!session) return NextResponse.json({ error: 'Practice session not found' }, { status: 404 });
    if (session.exam_track_id) await assertActiveExamTrackAccess(supabaseAdmin, authUser.id, session.exam_track_id);

    const { error: sessionError } = await (supabaseAdmin as any)
      .from('practice_sessions')
      .update({
        completed: true,
        completed_at: new Date().toISOString(),
        score_percent: scorePercent,
        current_index: typeof currentIndex === 'number' ? currentIndex : session.current_index,
        metadata: metadata && typeof metadata === 'object' ? metadata : session.metadata || {},
      })
      .eq('id', sessionId)
      .eq('user_id', authUser.id);

    if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });

    const { error: scoreError } = await supabaseAdmin
      .from('scores')
      .insert({
        user_id: authUser.id,
        exam_track_id: session.exam_track_id || undefined,
        exam_id: session.exam_id || undefined,
        score: scorePercent,
        weak_topics: Array.isArray(weakTopics) ? weakTopics : [],
      });

    if (scoreError) return NextResponse.json({ error: scoreError.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Complete practice session error:', err);
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
