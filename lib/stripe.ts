import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-05-27.dahlia' as any,
});

export const EXAM_STRIPE_PRICES: Record<string, string> = {
  'eppp': process.env.STRIPE_PRICE_EPPP || '',
  'social-work': process.env.STRIPE_PRICE_SOCIAL_WORK || '',
  'nce': process.env.STRIPE_PRICE_NCE || '',
  'ccm': process.env.STRIPE_PRICE_CCM || '',
  'nclex': process.env.STRIPE_PRICE_NCLEX || '',
};
