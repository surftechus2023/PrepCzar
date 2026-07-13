import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSupabaseAdmin } from '@/lib/server-auth';
import { stripe } from '@/lib/stripe';
import { syncCheckoutSession, syncStripeSubscription } from '@/lib/stripe-sync';

export const dynamic = 'force-dynamic';

async function markEventProcessing(event: Stripe.Event) {
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await (supabaseAdmin as any)
    .from('stripe_processed_events')
    .insert({
      id: event.id,
      event_type: event.type,
      payload_created_at: event.created ? new Date(event.created * 1000).toISOString() : null,
      livemode: event.livemode,
    });

  if (!error) return true;
  if (error.code === '23505') return false;
  throw new Error(error.message);
}

async function unmarkEvent(eventId: string) {
  await (getSupabaseAdmin() as any)
    .from('stripe_processed_events')
    .delete()
    .eq('id', eventId);
}

async function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice) {
  return typeof (invoice as any).subscription === 'string'
    ? (invoice as any).subscription
    : (invoice as any).subscription?.id || null;
}

export async function POST(req: NextRequest) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe webhook is not configured' }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const shouldProcess = await markEventProcessing(event);
  if (!shouldProcess) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await syncCheckoutSession(stripe, session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await syncStripeSubscription(subscription);
        break;
      }

      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = await getSubscriptionIdFromInvoice(invoice);
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncStripeSubscription(subscription);
        }
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    await unmarkEvent(event.id);
    console.error('Stripe webhook processing error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
