import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getSupabaseAdmin } from '@/lib/server-auth';

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const email = authUser.email;
    if (!email) {
      return NextResponse.json({ error: 'Authenticated user has no email' }, { status: 400 });
    }

    const fullName = String(authUser.user_metadata?.full_name || '');
    const supabaseAdmin = getSupabaseAdmin();
    const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (existingProfileError) {
      return NextResponse.json({ error: existingProfileError.message }, { status: 500 });
    }

    const profilePayload = {
      id: authUser.id,
      email,
      full_name: fullName,
      preferred_language: 'en',
      role: 'student',
    };

    if (!existingProfile) {
      const { error: userError } = await supabaseAdmin
        .from('users')
        .insert(profilePayload);

      if (userError) {
        return NextResponse.json({ error: userError.message }, { status: 500 });
      }
    }

    await supabaseAdmin
      .from('profiles')
      .upsert(existingProfile || profilePayload, { onConflict: 'id' });

    const { data: activeSubscriptions, error: subscriptionsError } = await supabaseAdmin
      .from('subscriptions')
      .select('id, exam_track_id, status, expires_at')
      .eq('user_id', authUser.id)
      .eq('status', 'active');

    if (subscriptionsError) {
      return NextResponse.json({ error: subscriptionsError.message }, { status: 500 });
    }

    const accessRows = (activeSubscriptions || [])
      .filter((subscription) => {
        if (!subscription.exam_track_id) return false;
        if (!subscription.expires_at) return true;
        return new Date(subscription.expires_at).getTime() > Date.now();
      })
      .map((subscription) => ({
        user_id: authUser.id,
        exam_track_id: subscription.exam_track_id,
        subscription_id: subscription.id,
        active: true,
        revoked_at: null,
      }));

    if (accessRows.length > 0) {
      const { error: accessError } = await supabaseAdmin
        .from('user_exam_access')
        .upsert(accessRows, { onConflict: 'user_id,exam_track_id' });

      if (accessError) {
        return NextResponse.json({ error: accessError.message }, { status: 500 });
      }
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({ profile });
  } catch (err: any) {
    console.error('Ensure profile error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
