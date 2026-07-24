import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin, requireAdmin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const recordTypeSchema = z.enum(['domain', 'competency', 'objective']);

const patchSchema = z.object({
  type: recordTypeSchema,
  id: z.string().uuid(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  official_blueprint_text: z.string().optional(),
  learning_objective: z.string().optional(),
  weight_percent: z.number().nullable().optional(),
  active: z.boolean().optional(),
  is_placeholder: z.boolean().optional(),
});

function hasText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

function objectiveComplete(objective: any) {
  return Boolean(
    objective.active
      && !objective.is_placeholder
      && hasText(objective.official_blueprint_text)
      && hasText(objective.learning_objective)
  );
}

function recordTable(type: z.infer<typeof recordTypeSchema>) {
  if (type === 'domain') return 'blueprint_domains';
  if (type === 'competency') return 'blueprint_competencies';
  return 'blueprint_objectives';
}

export async function GET(req: NextRequest) {
  try {
    const adminUser = await requireAdmin(req);
    if (!adminUser) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const trackId = searchParams.get('trackId');
    const supabaseAdmin = getSupabaseAdmin();

    const [categoriesRes, tracksRes] = await Promise.all([
      supabaseAdmin.from('exam_categories').select('*').order('display_order'),
      supabaseAdmin
        .from('exam_tracks')
        .select('*')
        .order('display_order'),
    ]);

    if (categoriesRes.error || tracksRes.error) {
      return NextResponse.json({ error: categoriesRes.error?.message || tracksRes.error?.message }, { status: 500 });
    }

    const selectedTrackId = trackId || tracksRes.data?.[0]?.id || null;
    const selectedTrack = (tracksRes.data || []).find((track: any) => track.id === selectedTrackId);
    let domainsQuery = selectedTrackId
      ? supabaseAdmin
          .from('blueprint_domains')
          .select('*')
          .eq('exam_track_id', selectedTrackId)
      : null;

    if (domainsQuery && selectedTrack?.slug === 'nce') {
      domainsQuery = domainsQuery
        .eq('active', true)
        .eq('is_placeholder', false);
    }

    const domainsRes = selectedTrackId
      ? await domainsQuery!.order('display_order')
      : { data: [], error: null };

    if (domainsRes.error) {
      return NextResponse.json({ error: domainsRes.error.message }, { status: 500 });
    }

    const domainIds = (domainsRes.data || []).map((domain: any) => domain.id);
    const competenciesRes = domainIds.length
      ? await supabaseAdmin
          .from('blueprint_competencies')
          .select('*')
          .in('domain_id', domainIds)
          .order('display_order')
      : { data: [], error: null };

    if (competenciesRes.error) {
      return NextResponse.json({ error: competenciesRes.error.message }, { status: 500 });
    }

    const competencyIds = (competenciesRes.data || []).map((competency: any) => competency.id);
    const objectivesRes = competencyIds.length
      ? await supabaseAdmin
          .from('blueprint_objectives')
          .select('*')
          .in('competency_id', competencyIds)
          .order('display_order')
      : { data: [], error: null };

    if (objectivesRes.error) {
      return NextResponse.json({ error: objectivesRes.error.message }, { status: 500 });
    }

    const objectives = objectivesRes.data || [];
    const completeObjectives = objectives.filter(objectiveComplete).length;
    const completeness = {
      domainCount: domainsRes.data?.length || 0,
      competencyCount: competenciesRes.data?.length || 0,
      objectiveCount: objectives.length,
      completeObjectiveCount: completeObjectives,
      incompleteObjectiveCount: objectives.length - completeObjectives,
      percentComplete: objectives.length ? Math.round((completeObjectives / objectives.length) * 100) : 0,
    };

    return NextResponse.json({
      categories: categoriesRes.data || [],
      tracks: tracksRes.data || [],
      selectedTrackId,
      domains: domainsRes.data || [],
      competencies: competenciesRes.data || [],
      objectives,
      completeness,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Could not load blueprints' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const adminUser = await requireAdmin(req);
    if (!adminUser) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid blueprint update', details: parsed.error.flatten() }, { status: 400 });
    }

    const { type, id, ...updates } = parsed.data;
    const allowedUpdates: Record<string, unknown> = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (type !== 'domain') {
      delete allowedUpdates.weight_percent;
    }

    if (type !== 'objective') {
      delete allowedUpdates.learning_objective;
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from(recordTable(type))
      .update(allowedUpdates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ record: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Could not update blueprint record' }, { status: 500 });
  }
}
