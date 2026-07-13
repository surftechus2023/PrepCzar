import Stripe from 'stripe';

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-05-27.dahlia' as any })
  : null;

export const EXAM_STRIPE_PRICES: Record<string, string> = {
  'eppp': process.env.STRIPE_PRICE_EPPP || '',
  'bsw': process.env.STRIPE_PRICE_BSW || '',
  'lmsw': process.env.STRIPE_PRICE_LMSW || '',
  'msw-lmsw': process.env.STRIPE_PRICE_LMSW || '',
  'lcsw': process.env.STRIPE_PRICE_LCSW || '',
  'nce': process.env.STRIPE_PRICE_NCE || '',
  'ccm': process.env.STRIPE_PRICE_CCM || '',
  'nclex-rn': process.env.STRIPE_PRICE_NCLEX_RN || '',
  'nclex-pn': process.env.STRIPE_PRICE_NCLEX_PN || '',
};

export const EXPECTED_MONTHLY_PRICES: Record<string, number> = {
  eppp: 75,
  bsw: 50,
  'msw-lmsw': 50,
  lmsw: 50,
  lcsw: 50,
  nce: 75,
  ccm: 50,
  'nclex-rn': 85,
  'nclex-pn': 85,
};

export const SUBSCRIPTION_ACCESS_STATUSES = ['active', 'trialing'] as const;
export const SUBSCRIPTION_BLOCKED_STATUSES = ['past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'inactive'] as const;

export function getStripePriceIdForTrackSlug(slug: string) {
  return EXAM_STRIPE_PRICES[slug] || '';
}

export function isSubscriptionAccessStatus(status: string | null | undefined) {
  return status === 'active' || status === 'trialing';
}

export function mapStripeSubscriptionStatus(status: string) {
  if (status === 'active') return 'active';
  if (status === 'trialing') return 'trialing';
  if (status === 'past_due') return 'past_due';
  if (status === 'unpaid') return 'unpaid';
  if (status === 'canceled') return 'canceled';
  if (status === 'incomplete') return 'incomplete';
  if (status === 'incomplete_expired') return 'incomplete_expired';
  return 'inactive';
}
