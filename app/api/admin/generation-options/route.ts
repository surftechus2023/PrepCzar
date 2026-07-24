import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireAdmin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

function isMissingSchemaObject(message: string | undefined) {
  const value = (message || '').toLowerCase();
  return value.includes('schema cache') || value.includes('could not find') || value.includes('relation') || value.includes('column');
}

async function getVerifiedNceBlueprintIds(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>, trackId: string | null) {
  if (!trackId) {
    return { domainIds: new Set<string>(), objectiveIds: new Set<string>() };
  }

  const domainsRes = await supabaseAdmin
    .from('blueprint_domains')
    .select('id')
    .eq('exam_track_id', trackId)
    .eq('active', true)
    .eq('is_placeholder', false);

  if (domainsRes.error) {
    throw new Error(domainsRes.error.message);
  }

  const domainIds = new Set<string>((domainsRes.data || []).map((domain: any) => domain.id));
  if (!domainIds.size) {
    return { domainIds, objectiveIds: new Set<string>() };
  }

  const competenciesRes = await supabaseAdmin
    .from('blueprint_competencies')
    .select('id')
    .in('domain_id', Array.from(domainIds))
    .eq('active', true)
    .eq('is_placeholder', false);

  if (competenciesRes.error) {
    throw new Error(competenciesRes.error.message);
  }

  const competencyIds = (competenciesRes.data || []).map((competency: any) => competency.id);
  if (!competencyIds.length) {
    return { domainIds, objectiveIds: new Set<string>() };
  }

  const objectivesRes = await supabaseAdmin
    .from('blueprint_objectives')
    .select('id')
    .in('competency_id', competencyIds)
    .eq('active', true)
    .eq('is_placeholder', false);

  if (objectivesRes.error) {
    throw new Error(objectivesRes.error.message);
  }

  return {
    domainIds,
    objectiveIds: new Set<string>((objectivesRes.data || []).map((objective: any) => objective.id)),
  };
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

    const selectedTrackQuery = trackId
      ? supabaseAdmin
          .from('exam_tracks')
          .select('id, slug')
          .eq('id', trackId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null });

    const [categoriesRes, tracksRes, topicsRes, subtopicsRes, blueprintItemsRes, selectedTrackRes] = await Promise.all([
      categoriesQuery,
      tracksQuery,
      topicsQuery,
      subtopicsQuery,
      blueprintItemsQuery,
      selectedTrackQuery,
    ]);

    const blueprintItemsError = blueprintItemsRes.error && !isMissingSchemaObject(blueprintItemsRes.error.message)
      ? blueprintItemsRes.error
      : null;
    const error = categoriesRes.error || tracksRes.error || topicsRes.error || subtopicsRes.error || blueprintItemsError || selectedTrackRes.error;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const socialWorkBlueprintItems = blueprintItemsRes.data || [];
    const topics = topicsRes.data || [];
    const selectedTrack = selectedTrackRes.data || (tracksRes.data || []).find((track: any) => track.id === trackId);
    const blueprintTopicIds = new Set(
      socialWorkBlueprintItems
        .map((item: any) => item.topic_id)
        .filter(Boolean)
    );
    const verifiedNceIds = selectedTrack?.slug === 'nce'
      ? await getVerifiedNceBlueprintIds(supabaseAdmin, trackId)
      : null;
    const visibleTopics = verifiedNceIds
      ? topics.filter((topic: any) => verifiedNceIds.domainIds.has(topic.blueprint_domain_id))
      : socialWorkBlueprintItems.length
      ? topics.filter((topic: any) => blueprintTopicIds.has(topic.id) && String(topic.official_blueprint_text || '').trim())
      : topics;
    const visibleSubtopics = verifiedNceIds
      ? (subtopicsRes.data || []).filter((subtopic: any) => verifiedNceIds.objectiveIds.has(subtopic.blueprint_objective_id))
      : subtopicsRes.data || [];

    return NextResponse.json({
      categories: categoriesRes.data || [],
      tracks: tracksRes.data || [],
      topics: visibleTopics,
      subtopics: visibleSubtopics,
      socialWorkBlueprintItems,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
