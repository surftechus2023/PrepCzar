import { NextRequest, NextResponse } from 'next/server';
import { assertActiveExamTrackAccess } from '@/lib/access/server';
import { getAuthenticatedUser, getSupabaseAdmin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { examTrackId, flashcardId, classification } = await req.json();
    if (!examTrackId || !flashcardId || !['known', 'learning'].includes(classification)) {
      return NextResponse.json({ error: 'Exam track, flashcard, and classification are required.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    await assertActiveExamTrackAccess(supabaseAdmin, authUser.id, examTrackId);

    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + (classification === 'known' ? 7 : 1));

    const { data: existing } = await (supabaseAdmin as any)
      .from('flashcard_reviews')
      .select('review_count')
      .eq('user_id', authUser.id)
      .eq('flashcard_id', flashcardId)
      .maybeSingle();

    const { error } = await (supabaseAdmin as any)
      .from('flashcard_reviews')
      .upsert({
        user_id: authUser.id,
        exam_track_id: examTrackId,
        flashcard_id: flashcardId,
        classification,
        next_review_at: nextReviewAt.toISOString(),
        reviewed_at: new Date().toISOString(),
        review_count: ((existing as any)?.review_count || 0) + 1,
      }, { onConflict: 'user_id,flashcard_id' });

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, nextReviewAt });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
