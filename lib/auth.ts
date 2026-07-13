import { supabase } from './supabase';
import { getSiteUrl } from './site-url';

function getPublicSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  const isLocalUrl = configuredUrl?.includes('localhost') || configuredUrl?.includes('127.0.0.1');

  if (configuredUrl && (process.env.NODE_ENV !== 'production' || !isLocalUrl)) {
    return configuredUrl.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') return window.location.origin;
  return getSiteUrl();
}

export async function signUp(email: string, password: string, fullName: string, emailRedirectTo?: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      ...(emailRedirectTo ? { emailRedirectTo } : {}),
    },
  });
  return { data, error };
}

export async function resendVerification(email: string, emailRedirectTo?: string) {
  const { data, error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: emailRedirectTo ? { emailRedirectTo } : undefined,
  });
  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function resetPassword(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getPublicSiteUrl()}/auth/reset-password`,
  });
  return { data, error };
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  return { data, error };
}
