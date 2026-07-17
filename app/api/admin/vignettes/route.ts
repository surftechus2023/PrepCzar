import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireAdmin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

async function enrichWithExamName(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  id: string,
  values: Record<string, any>
) {
  const nextValues = { ...values };
  if (nextValues.exam_name) return nextValues;

  const { data: vignette } = await supabaseAdmin
    .from('case_vignettes')
    .select('exam_track_id, exam_name')
    .eq('id', id)
    .maybeSingle();

  if (vignette?.exam_name || !vignette?.exam_track_id) return nextValues;

  const { data: track } = await supabaseAdmin
    .from('exam_tracks')
    .select('name, full_name')
    .eq('id', vignette.exam_track_id)
    .maybeSingle();

  const examName = track ? track.full_name || track.name : '';
  if (examName) nextValues.exam_name = examName;

  return nextValues;
}

export async function GET(req: NextRequest) {
  try {
    const adminUser = await requireAdmin(req);
    if (!adminUser) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const [vignettesRes, tracksRes, topicsRes] = await Promise.all([
      supabaseAdmin
        .from('case_vignettes')
        .select('*, exam_track:exam_tracks(name)')
        .order('created_at', { ascending: false })
        .limit(200),
      supabaseAdmin.from('exam_tracks').select('*').order('name'),
      supabaseAdmin
        .from('topics')
        .select('id, exam_track_id, title, display_order')
        .order('display_order', { ascending: true })
        .order('title', { ascending: true }),
    ]);

    const error = vignettesRes.error || tracksRes.error || topicsRes.error;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      vignettes: vignettesRes.data || [],
      tracks: tracksRes.data || [],
      topics: topicsRes.data || [],
    });
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

    const { id, values } = await req.json();
    if (!id || !values || typeof values !== 'object') {
      return NextResponse.json({ error: 'Invalid update request' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const updateValues = await enrichWithExamName(supabaseAdmin, id, values);

    const { data, error } = await supabaseAdmin
      .from('case_vignettes')
      .update(updateValues)
      .eq('id', id)
      .select('*, exam_track:exam_tracks(name)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ vignette: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const adminUser = await requireAdmin(req);
    if (!adminUser) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing vignette id' }, { status: 400 });
    }

    const { error } = await getSupabaseAdmin()
      .from('case_vignettes')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
