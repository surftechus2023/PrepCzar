import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';
import { getAuthenticatedUser, getSupabaseAdmin } from '@/lib/server-auth';
import { getSiteUrl } from '@/lib/site-url';

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

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: user.email || undefined,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `PrepCzar - ${trackName}`,
              description: `Monthly subscription for ${trackName} exam preparation`,
            },
            unit_amount: Math.round(Number(track.monthly_price) * 100),
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/dashboard/subscriptions?success=true&track=${track.id}`,
      cancel_url: `${siteUrl}/dashboard/subscriptions?canceled=true`,
      metadata: {
        userId: user.id,
        examTrackId: track.id,
        examTrackSlug: track.slug,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Stripe checkout error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
