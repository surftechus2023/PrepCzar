import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireAdmin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const adminUser = await requireAdmin(req);
    if (!adminUser) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get('categoryId');
    const trackId = searchParams.get('trackId');
    const supabaseAdmin = getSupabaseAdmin();

    const categoriesQuery = supabaseAdmin
      .from('exam_categories')
      .select('*')
      .order('display_order');

    const tracksQuery = categoryId
      ? supabaseAdmin
          .from('exam_tracks')
          .select('*')
          .eq('category_id', categoryId)
          .order('display_order')
      : Promise.resolve({ data: [], error: null });

    const topicsQuery = trackId
      ? supabaseAdmin
          .from('topics')
          .select('*')
          .eq('exam_track_id', trackId)
          .order('display_order')
      : Promise.resolve({ data: [], error: null });

    const [categoriesRes, tracksRes, topicsRes] = await Promise.all([
      categoriesQuery,
      tracksQuery,
      topicsQuery,
    ]);

    const error = categoriesRes.error || tracksRes.error || topicsRes.error;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      categories: categoriesRes.data || [],
      tracks: tracksRes.data || [],
      topics: topicsRes.data || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
