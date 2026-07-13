import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/server-auth';
import { getSiteUrl } from '@/lib/site-url';
import { EXPECTED_MONTHLY_PRICES, SUBSCRIPTION_ACCESS_STATUSES, getStripePriceIdForTrackSlug } from '@/lib/stripe';
import { enforceRateLimit } from '@/lib/security/rate-limit';

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

    const limited = await enforceRateLimit(req, { keyPrefix: 'stripe:signup-checkout', limit: 5, windowMs: 15 * 60 * 1000 });
    if (limited) return limited;

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

    const { data: syncedProfile } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, preferred_language, role')
      .eq('id', userId)
      .single();

    if (syncedProfile) {
      await supabaseAdmin
        .from('profiles')
        .upsert(syncedProfile, { onConflict: 'id' });
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
      .eq('user_id', userId)
      .eq('exam_track_id', track.id)
      .in('status', [...SUBSCRIPTION_ACCESS_STATUSES])
      .maybeSingle();

    if (activeTrackSubscription) {
      return NextResponse.json({ error: 'This account already has active access to this exam track.' }, { status: 409 });
    }

    const { data: existingSubscription } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .not('stripe_customer_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      ...(existingSubscription?.stripe_customer_id
        ? { customer: existingSubscription.stripe_customer_id }
        : { customer_email: email }),
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      allow_promotion_codes: false,
      success_url: `${siteUrl}/auth/payment-confirmed?track=${track.slug}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/auth/signup?track=${track.slug}&canceled=true`,
      client_reference_id: userId,
      metadata: {
        userId,
        examTrackId: track.id,
        examTrackSlug: track.slug,
        signupCheckout: 'true',
        priceId,
      },
      subscription_data: {
        metadata: {
          userId,
          examTrackId: track.id,
          examTrackSlug: track.slug,
          signupCheckout: 'true',
          priceId,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Signup Stripe checkout error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
