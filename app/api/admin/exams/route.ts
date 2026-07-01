import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireAdmin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const adminUser = await requireAdmin(req);
    if (!adminUser) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const [categoriesRes, tracksRes, topicsRes] = await Promise.all([
      supabaseAdmin.from('exam_categories').select('*').order('display_order'),
      supabaseAdmin.from('exam_tracks').select('*').order('display_order'),
      supabaseAdmin.from('topics').select('*').order('display_order'),
    ]);

    const error = categoriesRes.error || tracksRes.error || topicsRes.error;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const topicsByTrack: Record<string, any[]> = {};
    for (const topic of topicsRes.data || []) {
      if (!topic.exam_track_id) continue;
      if (!topicsByTrack[topic.exam_track_id]) topicsByTrack[topic.exam_track_id] = [];
      topicsByTrack[topic.exam_track_id].push(topic);
    }

    const tracksByCategory: Record<string, any[]> = {};
    for (const track of tracksRes.data || []) {
      if (!tracksByCategory[track.category_id]) tracksByCategory[track.category_id] = [];
      tracksByCategory[track.category_id].push({
        ...track,
        topics: topicsByTrack[track.id] || [],
      });
    }

    const categories = (categoriesRes.data || []).map((category) => ({
      ...category,
      tracks: tracksByCategory[category.id] || [],
    }));

    return NextResponse.json({ categories });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminUser = await requireAdmin(req);
    if (!adminUser) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { trackId, title } = await req.json();
    const topicTitle = typeof title === 'string' ? title.trim() : '';

    if (!trackId || !topicTitle) {
      return NextResponse.json({ error: 'Track and topic title are required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { count, error: countError } = await supabaseAdmin
      .from('topics')
      .select('id', { count: 'exact', head: true })
      .eq('exam_track_id', trackId);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    const { data, error } = await supabaseAdmin
      .from('topics')
      .insert({
        exam_track_id: trackId,
        title: topicTitle,
        display_order: (count || 0) + 1,
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ topic: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const adminUser = await requireAdmin(req);
    if (!adminUser) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { trackId, active } = await req.json();
    if (!trackId || typeof active !== 'boolean') {
      return NextResponse.json({ error: 'Track and active status are required' }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from('exam_tracks')
      .update({ active })
      .eq('id', trackId)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ track: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
