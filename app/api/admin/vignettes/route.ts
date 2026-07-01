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
    const [vignettesRes, tracksRes] = await Promise.all([
      supabaseAdmin
        .from('case_vignettes')
        .select('*, exam_track:exam_tracks(name)')
        .order('created_at', { ascending: false })
        .limit(200),
      supabaseAdmin.from('exam_tracks').select('*').order('name'),
    ]);

    const error = vignettesRes.error || tracksRes.error;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      vignettes: vignettesRes.data || [],
      tracks: tracksRes.data || [],
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

    const { data, error } = await getSupabaseAdmin()
      .from('case_vignettes')
      .update(values)
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
