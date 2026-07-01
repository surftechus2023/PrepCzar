import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getSupabaseAdmin } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const [categoriesRes, tracksRes, subscriptionsRes] = await Promise.all([
      supabaseAdmin.from('exam_categories').select('*').order('display_order'),
      supabaseAdmin.from('exam_tracks').select('*').eq('active', true).order('display_order'),
      supabaseAdmin.from('subscriptions').select('*').eq('user_id', authUser.id),
    ]);

    const error = categoriesRes.error || tracksRes.error || subscriptionsRes.error;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      categories: categoriesRes.data || [],
      tracks: tracksRes.data || [],
      subscriptions: subscriptionsRes.data || [],
    });
  } catch (err: any) {
    console.error('Dashboard subscriptions error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
