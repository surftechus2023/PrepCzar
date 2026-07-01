import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/server-auth';

const signupCheckoutSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  examTrackSlug: z.string().min(1),
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

    const parsed = signupCheckoutSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid signup checkout request' }, { status: 400 });
    }

    const { userId, email, examTrackSlug } = parsed.data;
    const supabaseAdmin = getSupabaseAdmin();

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userError || userData.user?.email?.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: 'Invalid signup user' }, { status: 403 });
    }

    const { data: track } = await supabaseAdmin
      .from('exam_tracks')
      .select('id, slug, name, full_name, monthly_price, active')
      .eq('slug', examTrackSlug)
      .eq('active', true)
      .maybeSingle();

    if (!track) {
      return NextResponse.json({ error: 'Invalid exam track' }, { status: 400 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const trackName = track.full_name || track.name;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
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
      success_url: `${siteUrl}/auth/payment-confirmed?track=${track.slug}`,
      cancel_url: `${siteUrl}/auth/signup?track=${track.slug}&canceled=true`,
      metadata: {
        userId,
        examTrackId: track.id,
        examTrackSlug: track.slug,
        signupCheckout: 'true',
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Signup Stripe checkout error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
