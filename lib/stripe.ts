import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-05-27.dahlia' as any,
});

export const EXAM_STRIPE_PRICES: Record<string, string> = {
  'eppp': process.env.STRIPE_PRICE_EPPP || '',
  'bsw': process.env.STRIPE_PRICE_BSW || process.env.STRIPE_PRICE_SOCIAL_WORK || '',
  'lmsw': process.env.STRIPE_PRICE_LMSW || process.env.STRIPE_PRICE_SOCIAL_WORK || '',
  'lcsw': process.env.STRIPE_PRICE_LCSW || process.env.STRIPE_PRICE_SOCIAL_WORK || '',
  'social-work': process.env.STRIPE_PRICE_SOCIAL_WORK || process.env.STRIPE_PRICE_BSW || process.env.STRIPE_PRICE_LMSW || process.env.STRIPE_PRICE_LCSW || '',
  'nce': process.env.STRIPE_PRICE_NCE || '',
  'ccm': process.env.STRIPE_PRICE_CCM || '',
  'nclex-rn': process.env.STRIPE_PRICE_NCLEX_RN || process.env.STRIPE_PRICE_NCLEX || '',
  'nclex-pn': process.env.STRIPE_PRICE_NCLEX_PN || process.env.STRIPE_PRICE_NCLEX || '',
  'nclex': process.env.STRIPE_PRICE_NCLEX || process.env.STRIPE_PRICE_NCLEX_RN || process.env.STRIPE_PRICE_NCLEX_PN || '',
};
