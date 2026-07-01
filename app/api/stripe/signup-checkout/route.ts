import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/server-auth';

const signupCheckoutSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8),
  fullName: z.string().trim().min(2),
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

    const { email, password, fullName, examTrackSlug } = parsed.data;
    const supabaseAdmin = getSupabaseAdmin();

    const { data: existingProfile } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .ilike('email', email)
      .maybeSingle();

    let userId = existingProfile?.id;

    if (userId) {
      const { data: authUserData, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (authUserError || authUserData.user?.email?.toLowerCase() !== email) {
        userId = undefined;
      }
    }

    if (!userId) {
      const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

      if (usersError) {
        return NextResponse.json({ error: usersError.message }, { status: 500 });
      }

      userId = usersData.users.find((user) => user.email?.toLowerCase() === email)?.id;
    }

    if (!userId) {
      const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

      if (createUserError || !createdUser.user) {
        return NextResponse.json(
          { error: createUserError?.message || 'Could not create signup user' },
          { status: 500 }
        );
      }

      userId = createdUser.user.id;
    }

    const { error: profileError } = await supabaseAdmin
      .from('users')
      .upsert(
        {
          id: userId,
          email,
          full_name: fullName,
        },
        { onConflict: 'id' }
      );

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
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
