import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-05-27.dahlia' as any })
  : null;

export async function POST(req: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured. Please add STRIPE_SECRET_KEY to your environment variables.' },
        { status: 503 }
      );
    }

    const { sessionId } = await req.json();
    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'Missing Stripe checkout session id' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    return NextResponse.json({
      received: true,
      paymentStatus: session.payment_status,
      subscriptionStatus: typeof session.subscription === 'object' ? session.subscription?.status : null,
      accessSource: 'stripe_webhook',
      message: 'Payment status confirmed. Subscription access is granted only after Stripe webhook processing.',
    });
  } catch (err: any) {
    console.error('Confirm checkout error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
