'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { BookOpen, Eye, EyeOff, Loader2, ArrowRight, Lock, Mail, RotateCcw, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { signUp, getUserProfile, resendVerification } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { authenticatedFetch } from '@/lib/api';

interface TrackInfo {
  name: string;
  price: number;
  category: string;
}

const TRACK_INFO: Record<string, TrackInfo> = {
  'eppp':     { name: 'EPPP', price: 75, category: 'Psychology' },
  'bsw':      { name: 'BSW', price: 50, category: 'Social Work' },
  'msw-lmsw': { name: 'MSW / LMSW', price: 50, category: 'Social Work' },
  'lcsw':     { name: 'LCSW', price: 50, category: 'Social Work' },
  'nce':      { name: 'NCE', price: 75, category: 'Counseling' },
  'ccm':      { name: 'CCM', price: 50, category: 'Case Management' },
  'nclex-rn': { name: 'NCLEX-RN', price: 85, category: 'Nursing' },
  'nclex-pn': { name: 'NCLEX-PN', price: 85, category: 'Nursing' },
};

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupLoading />}>
      <SignupContent />
    </Suspense>
  );
}

function SignupLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
    </div>
  );
}

function SignupContent() {
  const searchParams = useSearchParams();
  const trackSlug = searchParams.get('track') || '';
  const trackInfo = TRACK_INFO[trackSlug] ?? null;

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  function buildRedirectUrl() {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    return `${siteUrl}/auth/verified${trackSlug ? `?track=${trackSlug}` : ''}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < 8) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 8 characters.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    const { data, error } = await signUp(email, password, fullName, buildRedirectUrl());

    if (error) {
      toast({
        title: 'Sign up failed',
        description: error.message,
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    if (!data?.user) {
      setLoading(false);
      return;
    }

    // Email confirmation required — session is null until user verifies
    if (!data.session) {
      setLoading(false);
      setSubmitted(true);
      return;
    }

    // Email confirmation disabled — session returned immediately
    const { data: profile } = await getUserProfile(data.user.id);
    if (profile?.role === 'admin') {
      router.push('/admin');
      return;
    }

    if (trackSlug && trackInfo) {
      const { data: track } = await supabase
        .from('exam_tracks')
        .select('id')
        .eq('slug', trackSlug)
        .single();

      if (track?.id) {
        const res = await authenticatedFetch('/api/stripe/checkout', {
          method: 'POST',
          body: JSON.stringify({
            examTrackId: track.id,
          }),
        });
        const json = await res.json();
        if (json.url) {
          window.location.href = json.url;
          return;
        }
      }
    }

    router.push('/dashboard/subscriptions');
  }

  async function handleResend() {
    setResending(true);
    const { error } = await resendVerification(email, buildRedirectUrl());
    setResending(false);
    if (error) {
      toast({ title: 'Could not resend', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Email resent', description: 'Check your inbox for the new verification link.' });
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/20 border border-blue-500/30 mb-6">
            <Mail className="w-8 h-8 text-blue-400" />
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">Check your email</h1>
          <p className="text-slate-300 mb-1">We sent a verification link to</p>
          <p className="text-blue-400 font-medium mb-8">{email}</p>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-6 text-left space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-slate-300 text-sm">Click the link in the email to verify your account</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-slate-300 text-sm">The link expires in 24 hours</p>
            </div>
            {trackInfo && (
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-slate-300 text-sm">
                  After verification you&apos;ll be taken to Stripe to complete your {trackInfo.name} subscription
                </p>
              </div>
            )}
          </div>

          <Button
            variant="outline"
            className="w-full border-white/20 text-slate-300 hover:text-white hover:bg-white/10 mb-4"
            onClick={handleResend}
            disabled={resending}
          >
            {resending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4 mr-2" />
            )}
            Resend verification email
          </Button>

          <p className="text-sm text-slate-500">
            Wrong email?{' '}
            <button
              onClick={() => setSubmitted(false)}
              className="text-blue-400 hover:underline"
            >
              Go back
            </button>
            {' '}or{' '}
            <Link href="/auth/login" className="text-blue-400 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-2xl text-white">PrepCzar</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          {trackInfo ? (
            <p className="text-slate-300 mt-1">
              Subscribe to {trackInfo.category} — {trackInfo.name}
            </p>
          ) : (
            <p className="text-slate-300 mt-1">Choose your exam track after signing up</p>
          )}
        </div>

        {/* Track preview */}
        {trackInfo && (
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">{trackInfo.category}</p>
              <p className="text-white font-semibold text-lg">{trackInfo.name}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-white">${trackInfo.price}</p>
              <p className="text-xs text-slate-400">/month</p>
            </div>
          </div>
        )}

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-slate-200">Full name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Jane Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
                className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:border-blue-400"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-200">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:border-blue-400"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-200">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:border-blue-400 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-6 text-base group"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Lock className="w-4 h-4 mr-2" />
              )}
              {trackInfo
                ? `Create Account & Subscribe`
                : 'Create Account'}
              {!loading && <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />}
            </Button>

            {trackInfo && (
              <p className="text-xs text-slate-400 text-center flex items-center justify-center gap-1">
                <Lock className="w-3 h-3" />
                You&apos;ll be redirected to secure Stripe checkout after verifying your email
              </p>
            )}

            <p className="text-xs text-slate-400 text-center">
              By creating an account you agree to our{' '}
              <Link href="/terms" className="text-blue-400 hover:underline">Terms of Service</Link>
              {' '}and{' '}
              <Link href="/privacy" className="text-blue-400 hover:underline">Privacy Policy</Link>
            </p>
          </form>

          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <p className="text-sm text-slate-400">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-blue-400 font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {!trackInfo && (
          <p className="text-center text-sm text-slate-500 mt-4">
            Not sure which exam?{' '}
            <Link href="/#pricing" className="text-blue-400 hover:underline">See all exam tracks</Link>
          </p>
        )}
      </div>
    </div>
  );
}
