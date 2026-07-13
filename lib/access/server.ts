import type { SupabaseClient } from '@supabase/supabase-js';

export async function userHasActiveExamTrackAccess(
  supabaseAdmin: SupabaseClient,
  userId: string,
  examTrackId: string
) {
  const { data: accessRows, error: accessError } = await supabaseAdmin
    .from('user_exam_access')
    .select('id')
    .eq('user_id', userId)
    .eq('exam_track_id', examTrackId)
    .eq('active', true)
    .limit(1);

  if (accessError) throw new Error(accessError.message);
  if (accessRows?.length) return true;

  const { data: subscriptions, error: subscriptionError } = await supabaseAdmin
    .from('subscriptions')
    .select('id, status, expires_at')
    .eq('user_id', userId)
    .eq('exam_track_id', examTrackId)
    .in('status', ['active', 'trialing']);

  if (subscriptionError) throw new Error(subscriptionError.message);
  const now = Date.now();
  return Boolean((subscriptions || []).some((subscription: any) => (
    !subscription.expires_at || new Date(subscription.expires_at).getTime() > now
  )));
}

export async function assertActiveExamTrackAccess(
  supabaseAdmin: SupabaseClient,
  userId: string,
  examTrackId: string
) {
  const allowed = await userHasActiveExamTrackAccess(supabaseAdmin, userId, examTrackId);
  if (!allowed) {
    const error = new Error('No active subscription access for this exam track.');
    (error as any).status = 403;
    throw error;
  }
}
