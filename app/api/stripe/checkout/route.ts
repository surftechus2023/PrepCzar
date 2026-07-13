import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';
import { getAuthenticatedUser, getSupabaseAdmin } from '@/lib/server-auth';
import { getSiteUrl } from '@/lib/site-url';
import { EXPECTED_MONTHLY_PRICES, SUBSCRIPTION_ACCESS_STATUSES, getStripePriceIdForTrackSlug } from '@/lib/stripe';
import { enforceRateLimit } from '@/lib/security/rate-limit';

const checkoutSchema = z.object({
  examTrackId: z.string().uuid(),
});

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

    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const limited = await enforceRateLimit(req, { keyPrefix: 'stripe:checkout', actorId: user.id, limit: 10, windowMs: 15 * 60 * 1000 });
    if (limited) return limited;

    const parsed = checkoutSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid checkout request' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: track } = await supabaseAdmin
      .from('exam_tracks')
      .select('id, slug, name, full_name, monthly_price, active')
      .eq('id', parsed.data.examTrackId)
      .eq('active', true)
      .maybeSingle();

    if (!track) {
      return NextResponse.json({ error: 'Invalid exam track' }, { status: 400 });
    }

    const siteUrl = getSiteUrl();
    const trackName = track.full_name || track.name;
    const priceId = getStripePriceIdForTrackSlug(track.slug);
    const expectedPrice = EXPECTED_MONTHLY_PRICES[track.slug];

    if (!priceId) {
      return NextResponse.json({ error: `Stripe price is not configured for ${track.slug}.` }, { status: 503 });
    }

    if (expectedPrice && Number(track.monthly_price) !== expectedPrice) {
      return NextResponse.json({ error: `Configured monthly price for ${track.slug} must be $${expectedPrice}.` }, { status: 500 });
    }

    const { data: activeTrackSubscription } = await supabaseAdmin
      .from('subscriptions')
      .select('id,status')
      .eq('user_id', user.id)
      .eq('exam_track_id', track.id)
      .in('status', [...SUBSCRIPTION_ACCESS_STATUSES])
      .maybeSingle();

    if (activeTrackSubscription) {
      return NextResponse.json({ error: 'You already have active access to this exam track.' }, { status: 409 });
    }

    const { data: existingSubscription } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .not('stripe_customer_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      ...(existingSubscription?.stripe_customer_id
        ? { customer: existingSubscription.stripe_customer_id }
        : { customer_email: user.email || undefined }),
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      allow_promotion_codes: false,
      success_url: `${siteUrl}/dashboard/subscriptions?success=true&track=${track.id}`,
      cancel_url: `${siteUrl}/dashboard/subscriptions?canceled=true`,
      client_reference_id: user.id,
      metadata: {
        userId: user.id,
        examTrackId: track.id,
        examTrackSlug: track.slug,
        priceId,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          examTrackId: track.id,
          examTrackSlug: track.slug,
          priceId,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Stripe checkout error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
