import Stripe from 'stripe';
import { getSupabaseAdmin } from '@/lib/server-auth';
import { getSiteUrl } from '@/lib/site-url';
import { isSubscriptionAccessStatus, mapStripeSubscriptionStatus } from '@/lib/stripe';

function toIsoDate(seconds?: number | null) {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
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

export async function syncStripeSubscription(
  subscription: Stripe.Subscription,
  fallback?: { customerId?: string | null; userId?: string | null; examTrackId?: string | null; customerEmail?: string | null }
) {
  const userId = subscription.metadata?.userId || fallback?.userId;
  const examTrackId = subscription.metadata?.examTrackId || fallback?.examTrackId;

  if (!userId || !examTrackId) {
    return { synced: false, reason: 'Missing subscription metadata' };
  }

  const status = mapStripeSubscriptionStatus(subscription.status);
  const supabaseAdmin = getSupabaseAdmin();
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id || fallback?.customerId || null;

  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .upsert({
      user_id: userId,
      exam_track_id: examTrackId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      status: status as any,
      started_at: toIsoDate((subscription as any).current_period_start) || new Date().toISOString(),
      expires_at: toIsoDate((subscription as any).current_period_end),
    }, { onConflict: 'stripe_subscription_id' })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  const hasAccess = isSubscriptionAccessStatus(status);
  await supabaseAdmin.from('user_exam_access').upsert({
    user_id: userId,
    exam_track_id: examTrackId,
    subscription_id: data.id,
    active: hasAccess,
    revoked_at: hasAccess ? null : new Date().toISOString(),
  }, { onConflict: 'user_id,exam_track_id' });

  return { synced: true, status };
}

export async function syncCheckoutSession(stripe: Stripe, session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const examTrackId = session.metadata?.examTrackId;

  if (!userId || !examTrackId || !session.subscription) {
    return { synced: false, reason: 'Missing checkout metadata or subscription' };
  }

  const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
  const result = await syncStripeSubscription(subscription, {
    customerId: String(session.customer || ''),
    userId,
    examTrackId,
    customerEmail: session.customer_details?.email || session.customer_email || null,
  });

  if (result.status === 'active') {
    await sendPostPaymentSignInLink(session.customer_details?.email || session.customer_email);
  }

  return result;
}
