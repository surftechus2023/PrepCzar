import { NextRequest, NextResponse } from 'next/server';
import { assertActiveExamTrackAccess } from '@/lib/access/server';
import { getAuthenticatedUser, getSupabaseAdmin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

type ContentType = 'mcq' | 'flashcards' | 'vignettes';

const TABLE_BY_TYPE: Record<ContentType, 'questions' | 'flashcards' | 'case_vignettes'> = {
  mcq: 'questions',
  flashcards: 'flashcards',
  vignettes: 'case_vignettes',
};

const LIMIT_BY_TYPE: Record<ContentType, number> = {
  mcq: 100,
  flashcards: 50,
  vignettes: 10,
};

const SELECT_BY_TYPE: Record<ContentType, string> = {
  mcq: [
    'id, exam_track_id, topic_id, subtopic_id, difficulty, cognitive_level, intended_cognitive_level',
    'question_en, question_es, question_fr',
    'option_a_en, option_a_es, option_a_fr',
    'option_b_en, option_b_es, option_b_fr',
    'option_c_en, option_c_es, option_c_fr',
    'option_d_en, option_d_es, option_d_fr',
    'correct_option, rationale_en, rationale_es, rationale_fr, correct_rationale_en',
    'source_topic, subtopic, learning_objective',
    'topic:topics(id, title, official_weight_percent)',
    'subtopic_record:subtopics(id, title)',
  ].join(', '),
  flashcards: [
    'id, exam_track_id, topic_id, subtopic_id, difficulty',
    'front_en, front_es, front_fr, back_en, back_es, back_fr',
    'topic:topics(id, title, official_weight_percent)',
    'subtopic_record:subtopics(id, title)',
  ].join(', '),
  vignettes: [
    'id, exam_track_id, topic_id, subtopic_id, difficulty',
    'case_en, case_es, case_fr, prompt_en, prompt_es, prompt_fr',
    'ideal_answer_en, ideal_answer_es, ideal_answer_fr, coaching_feedback_en, coaching_feedback_es, coaching_feedback_fr',
    'scoring_rubric',
    'topic:topics(id, title, official_weight_percent)',
    'subtopic_record:subtopics(id, title)',
  ].join(', '),
};

function isContentType(value: string | null): value is ContentType {
  return value === 'mcq' || value === 'flashcards' || value === 'vignettes';
}

function modeForType(type: ContentType) {
  if (type === 'flashcards') return 'flashcard';
  if (type === 'vignettes') return 'vignette';
  return 'mcq';
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const examTrackId = searchParams.get('exam');
    const contentType = searchParams.get('type');
    const resumeSessionId = searchParams.get('session');

    if (!examTrackId || !isContentType(contentType)) {
      return NextResponse.json({ error: 'Exam track and content type are required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    await assertActiveExamTrackAccess(supabaseAdmin, authUser.id, examTrackId);

    const requestedLimit = Number(searchParams.get('limit') || LIMIT_BY_TYPE[contentType]);
    const limit = Math.min(Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : LIMIT_BY_TYPE[contentType]), LIMIT_BY_TYPE[contentType]);

    const { data: track, error: trackError } = await supabaseAdmin
      .from('exam_tracks')
      .select('id, name, slug')
      .eq('id', examTrackId)
      .maybeSingle();

    if (trackError) return NextResponse.json({ error: trackError.message }, { status: 500 });

    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .from('practice_sessions')
      .select('id')
      .eq('user_id', authUser.id)
      .eq('exam_track_id', examTrackId);

    if (sessionsError) return NextResponse.json({ error: sessionsError.message }, { status: 500 });

    const sessionIds = (sessions || []).map((session: any) => session.id);
    const responsesRes = sessionIds.length
      ? await (supabaseAdmin as any)
          .from('responses')
          .select('content_item_id, question_id')
          .in('session_id', sessionIds)
      : { data: [], error: null };

    if (responsesRes.error) return NextResponse.json({ error: responsesRes.error.message }, { status: 500 });

    const incompleteSessionRes = await (supabaseAdmin as any)
      .from('practice_sessions')
      .select('id, user_id, exam_track_id, exam_id, mode, score_percent, completed, started_at, completed_at, content_item_ids, current_index, total_items, metadata')
      .eq('user_id', authUser.id)
      .eq('exam_track_id', examTrackId)
      .eq('mode', modeForType(contentType))
      .eq('completed', false)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let resumeItemIds: string[] = [];
    if (resumeSessionId) {
      const { data: resumeSession, error: resumeSessionError } = await (supabaseAdmin as any)
        .from('practice_sessions')
        .select('id, user_id, exam_track_id, mode, content_item_ids')
        .eq('id', resumeSessionId)
        .eq('user_id', authUser.id)
        .eq('exam_track_id', examTrackId)
        .eq('mode', modeForType(contentType))
        .maybeSingle();

      if (resumeSessionError) return NextResponse.json({ error: resumeSessionError.message }, { status: 500 });
      if (!resumeSession) return NextResponse.json({ error: 'Practice session not found for this content request' }, { status: 404 });
      resumeItemIds = Array.isArray(resumeSession.content_item_ids)
        ? resumeSession.content_item_ids.filter((id: unknown): id is string => typeof id === 'string')
        : [];
    }

    const table = TABLE_BY_TYPE[contentType];
    let contentQuery = (supabaseAdmin as any)
      .from(table)
      .select(SELECT_BY_TYPE[contentType])
      .eq('exam_track_id', examTrackId)
      .eq('active', true)
      .eq('reviewed', true);

    if (contentType === 'mcq') {
      contentQuery = contentQuery.or(
        'and(integrity_status.eq.passed,committee_status.eq.approved,blueprint_alignment_score.gte.90,difficulty_quality_score.gte.80,integrity_score.gte.85,difficulty.neq.easy,plagiarism_risk_score.lte.70),and(admin_override.eq.true,admin_override_reason.not.is.null,admin_override_by.not.is.null,admin_override_at.not.is.null)'
      );
    }

    if (resumeItemIds.length > 0) {
      contentQuery = contentQuery.in('id', resumeItemIds);
    }

    const { data: content, error: contentError } = await contentQuery.limit(resumeItemIds.length || Math.max(limit * 3, limit));
    if (contentError) return NextResponse.json({ error: contentError.message }, { status: 500 });

    const seenIds = new Set((responsesRes.data || []).map((response: any) => response.content_item_id || response.question_id).filter(Boolean));
    const contentRows = ((content || []) as any[]);
    const orderedContent = resumeItemIds.length > 0
      ? resumeItemIds
          .map((id) => contentRows.find((item) => item.id === id))
          .filter(Boolean)
      : contentRows
          .map((item) => ({
            ...item,
            _seen: seenIds.has(item.id),
            _weight: Number(item.topic?.official_weight_percent || 1),
          }))
          .sort((left, right) => {
            if (left._seen !== right._seen) return left._seen ? 1 : -1;
            return right._weight - left._weight;
          })
          .slice(0, limit)
          .map(({ _seen, _weight, ...item }) => item);

    return NextResponse.json({
      track,
      content: orderedContent,
      limit,
      incompleteSession: incompleteSessionRes.data || null,
    });
  } catch (err: any) {
    console.error('Dashboard practice content error:', err);
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
