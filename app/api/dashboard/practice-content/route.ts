import { NextRequest, NextResponse } from 'next/server';
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

function isContentType(value: string | null): value is ContentType {
  return value === 'mcq' || value === 'flashcards' || value === 'vignettes';
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const examTrackId = searchParams.get('exam');
    const contentType = searchParams.get('type');

    if (!examTrackId || !isContentType(contentType)) {
      return NextResponse.json({ error: 'Exam track and content type are required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: access, error: accessError } = await supabaseAdmin
      .from('user_exam_access')
      .select('id')
      .eq('user_id', authUser.id)
      .eq('exam_track_id', examTrackId)
      .eq('active', true)
      .limit(1);

    if (accessError) {
      return NextResponse.json({ error: accessError.message }, { status: 500 });
    }

    if (!access?.length) {
      return NextResponse.json({ error: 'No active access for this exam track' }, { status: 403 });
    }

    const { data: track, error: trackError } = await supabaseAdmin
      .from('exam_tracks')
      .select('id, name')
      .eq('id', examTrackId)
      .maybeSingle();

    if (trackError) {
      return NextResponse.json({ error: trackError.message }, { status: 500 });
    }

    const table = TABLE_BY_TYPE[contentType];
    let contentQuery = supabaseAdmin
      .from(table)
      .select('*')
      .eq('exam_track_id', examTrackId)
      .eq('active', true)
      .eq('reviewed', true);

    if (contentType === 'mcq') {
      contentQuery = contentQuery.or('integrity_status.eq.passed,integrity_override.eq.true');
    }

    const { data: content, error: contentError } = await contentQuery.limit(LIMIT_BY_TYPE[contentType]);

    if (contentError) {
      return NextResponse.json({ error: contentError.message }, { status: 500 });
    }

    return NextResponse.json({
      track,
      content: content || [],
    });
  } catch (err: any) {
    console.error('Dashboard practice content error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
