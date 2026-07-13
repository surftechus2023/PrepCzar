import { NextRequest, NextResponse } from 'next/server';
import { assertActiveExamTrackAccess } from '@/lib/access/server';
import { getAuthenticatedUser, getSupabaseAdmin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { examTrackId, contentType, contentItemId, bookmarked } = await req.json();
    if (!examTrackId || !contentType || !contentItemId) {
      return NextResponse.json({ error: 'Exam track, content type, and content item are required.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    await assertActiveExamTrackAccess(supabaseAdmin, authUser.id, examTrackId);

    const { data: existingBookmark } = await (supabaseAdmin as any)
      .from('bookmarks')
      .select('id')
      .eq('user_id', authUser.id)
      .eq('content_type', contentType)
      .eq('content_item_id', contentItemId)
      .maybeSingle();

    const shouldRemove = bookmarked === false || (typeof bookmarked === 'undefined' && existingBookmark);

    if (shouldRemove) {
      const { error } = await (supabaseAdmin as any)
        .from('bookmarks')
        .delete()
        .eq('user_id', authUser.id)
        .eq('content_type', contentType)
        .eq('content_item_id', contentItemId);
      if (error) throw new Error(error.message);
      return NextResponse.json({ bookmarked: false });
    }

    const { error } = await (supabaseAdmin as any)
      .from('bookmarks')
      .upsert({
        user_id: authUser.id,
        exam_track_id: examTrackId,
        content_type: contentType,
        content_item_id: contentItemId,
      }, { onConflict: 'user_id,content_type,content_item_id' });

    if (error) throw new Error(error.message);
    return NextResponse.json({ bookmarked: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
