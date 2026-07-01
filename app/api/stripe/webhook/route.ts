import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSupabaseAdmin } from '@/lib/server-auth';
import { syncCheckoutSession } from '@/lib/stripe-sync';

export const dynamic = 'force-dynamic';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-05-27.dahlia' as any })
  : null;

function mapStripeStatus(status: string) {
  if (status === 'active') return 'active';
  if (status === 'trialing') return 'inactive';
  if (status === 'past_due') return 'past_due';
  if (status === 'canceled') return 'canceled';
  return 'inactive';
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
      await syncCheckoutSession(stripe, session);
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
            expires_at: (subscription as any).current_period_end
              ? new Date((subscription as any).current_period_end * 1000).toISOString()
              : null,
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
