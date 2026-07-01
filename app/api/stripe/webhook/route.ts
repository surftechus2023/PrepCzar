import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSupabaseAdmin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-05-27.dahlia' as any })
  : null;

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

async function sendPostPaymentSignInLink(email: string | null | undefined) {
  if (!email) return;

  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await (supabaseAdmin.auth as any).signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${siteUrl}/auth/verified`,
      },
    });

    if (error) {
      console.error('Could not send post-payment sign-in link:', error.message);
    }
  } catch (err: any) {
    console.error('Could not send post-payment sign-in link:', err.message);
  }
}

export async function POST(req: NextRequest) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe webhook is not configured' }, { status: 503 });
  }

  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const examTrackId = session.metadata?.examTrackId;

      if (userId && examTrackId && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        const status = mapStripeStatus(subscription.status);

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
      }
      break;
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const status = event.type === 'customer.subscription.deleted'
        ? 'canceled'
        : mapStripeStatus(subscription.status);

      const { data, error } = await supabaseAdmin
        .from('subscriptions')
        .update({
          status,
          expires_at: toIsoDate((subscription as any).current_period_end),
        })
        .eq('stripe_subscription_id', subscription.id)
        .select('id, user_id, exam_track_id')
        .maybeSingle();

      if (error) throw new Error(error.message);

      if (data?.exam_track_id) {
        await supabaseAdmin.from('user_exam_access').upsert({
          user_id: data.user_id,
          exam_track_id: data.exam_track_id,
          subscription_id: data.id,
          active: status === 'active',
          revoked_at: status === 'active' ? null : new Date().toISOString(),
        }, { onConflict: 'user_id,exam_track_id' });
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = (invoice as any).subscription;
      if (subscriptionId) {
        const { data } = await supabaseAdmin
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('stripe_subscription_id', String(subscriptionId))
          .select('id, user_id, exam_track_id')
          .maybeSingle();

        if (data?.exam_track_id) {
          await supabaseAdmin.from('user_exam_access').upsert({
            user_id: data.user_id,
            exam_track_id: data.exam_track_id,
            subscription_id: data.id,
            active: false,
            revoked_at: new Date().toISOString(),
          }, { onConflict: 'user_id,exam_track_id' });
        }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
