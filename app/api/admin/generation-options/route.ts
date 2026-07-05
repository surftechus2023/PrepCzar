import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireAdmin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

function isMissingSchemaObject(message: string | undefined) {
  const value = (message || '').toLowerCase();
  return value.includes('schema cache') || value.includes('could not find') || value.includes('relation') || value.includes('column');
}

export async function GET(req: NextRequest) {
  try {
    const adminUser = await requireAdmin(req);
    if (!adminUser) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get('categoryId');
    const trackId = searchParams.get('trackId');
    const topicId = searchParams.get('topicId');
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

    const subtopicsQuery = topicId
      ? supabaseAdmin
          .from('subtopics')
          .select('*')
          .eq('topic_id', topicId)
          .order('display_order')
      : Promise.resolve({ data: [], error: null });

    const blueprintItemsQuery = trackId
      ? supabaseAdmin
          .from('social_work_blueprint_items')
          .select('*')
          .eq('exam_track_id', trackId)
          .order('display_order')
      : Promise.resolve({ data: [], error: null });

    const [categoriesRes, tracksRes, topicsRes, subtopicsRes, blueprintItemsRes] = await Promise.all([
      categoriesQuery,
      tracksQuery,
      topicsQuery,
      subtopicsQuery,
      blueprintItemsQuery,
    ]);

    const blueprintItemsError = blueprintItemsRes.error && !isMissingSchemaObject(blueprintItemsRes.error.message)
      ? blueprintItemsRes.error
      : null;
    const error = categoriesRes.error || tracksRes.error || topicsRes.error || subtopicsRes.error || blueprintItemsError;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const socialWorkBlueprintItems = blueprintItemsRes.data || [];
    const topics = topicsRes.data || [];
    const blueprintTopicIds = new Set(
      socialWorkBlueprintItems
        .map((item: any) => item.topic_id)
        .filter(Boolean)
    );
    const visibleTopics = socialWorkBlueprintItems.length
      ? topics.filter((topic: any) => blueprintTopicIds.has(topic.id) && String(topic.official_blueprint_text || '').trim())
      : topics;

    return NextResponse.json({
      categories: categoriesRes.data || [],
      tracks: tracksRes.data || [],
      topics: visibleTopics,
      subtopics: subtopicsRes.data || [],
      socialWorkBlueprintItems,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
