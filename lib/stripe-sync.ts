import Stripe from 'stripe';
import { getSupabaseAdmin } from '@/lib/server-auth';
import { getSiteUrl } from '@/lib/site-url';

function toIsoDate(seconds?: number | null) {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

function mapStripeStatus(status: string) {
  if (status === 'active') return 'active';
  if (status === 'trialing') return 'inactive';
  if (status === 'past_due') return 'past_due';
  if (status === 'canceled') return 'canceled';
  return 'inactive';
}

export async function sendPostPaymentSignInLink(email: string | null | undefined) {
  if (!email) return;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await (supabaseAdmin.auth as any).signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${getSiteUrl()}/auth/login`,
      },
    });

    if (error) {
      console.error('Could not send post-payment sign-in link:', error.message);
    }
  } catch (err: any) {
    console.error('Could not send post-payment sign-in link:', err.message);
  }
}

export async function syncCheckoutSession(stripe: Stripe, session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const examTrackId = session.metadata?.examTrackId;

  if (!userId || !examTrackId || !session.subscription) {
    return { synced: false, reason: 'Missing checkout metadata or subscription' };
  }

  const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
  const status = mapStripeStatus(subscription.status);
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .upsert({
      user_id: userId,
      exam_track_id: examTrackId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: String(session.customer),
      status,
      started_at: toIsoDate((subscription as any).current_period_start) || new Date().toISOString(),
      expires_at: toIsoDate((subscription as any).current_period_end),
    }, { onConflict: 'stripe_subscription_id' })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  await supabaseAdmin.from('user_exam_access').upsert({
    user_id: userId,
    exam_track_id: examTrackId,
    subscription_id: data.id,
    active: status === 'active',
    revoked_at: status === 'active' ? null : new Date().toISOString(),
  }, { onConflict: 'user_id,exam_track_id' });

  if (status === 'active') {
    await sendPostPaymentSignInLink(session.customer_details?.email || session.customer_email);
  }

  return { synced: true, status };
}
