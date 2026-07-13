import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getSupabaseAdmin } from '@/lib/server-auth';
import { SUBSCRIPTION_ACCESS_STATUSES } from '@/lib/stripe';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    let { data, error } = await supabaseAdmin
      .from('user_exam_access')
      .select('*, exam_track:exam_tracks(*)')
      .eq('user_id', authUser.id)
      .eq('active', true)
      .order('granted_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data?.length) {
      const { data: activeSubscriptions, error: subscriptionsError } = await supabaseAdmin
        .from('subscriptions')
        .select('id,user_id,exam_track_id,status,expires_at')
        .eq('user_id', authUser.id)
        .in('status', [...SUBSCRIPTION_ACCESS_STATUSES])
        .not('exam_track_id', 'is', null);

      if (subscriptionsError) {
        return NextResponse.json({ error: subscriptionsError.message }, { status: 500 });
      }

      const now = Date.now();
      const accessRows = (activeSubscriptions || [])
        .filter((subscription) => !subscription.expires_at || new Date(subscription.expires_at).getTime() > now)
        .map((subscription) => ({
          user_id: authUser.id,
          exam_track_id: subscription.exam_track_id,
          subscription_id: subscription.id,
          active: true,
          revoked_at: null,
        }));

      if (accessRows.length > 0) {
        const { error: upsertError } = await supabaseAdmin
          .from('user_exam_access')
          .upsert(accessRows, { onConflict: 'user_id,exam_track_id' });

        if (upsertError) {
          return NextResponse.json({ error: upsertError.message }, { status: 500 });
        }

        const refreshed = await supabaseAdmin
          .from('user_exam_access')
          .select('*, exam_track:exam_tracks(*)')
          .eq('user_id', authUser.id)
          .eq('active', true)
          .order('granted_at', { ascending: false });

        data = refreshed.data;
        error = refreshed.error;

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ access: data || [] });
  } catch (err: any) {
    console.error('Dashboard access error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
