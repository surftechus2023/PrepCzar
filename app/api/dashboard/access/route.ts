import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getSupabaseAdmin } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('user_exam_access')
      .select('*, exam_track:exam_tracks(*)')
      .eq('user_id', authUser.id)
      .eq('active', true)
      .order('granted_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ access: data || [] });
  } catch (err: any) {
    console.error('Dashboard access error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
