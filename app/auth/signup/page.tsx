'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  BookOpen,
  CheckCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getUserProfile, resendVerification, signUp } from '@/lib/auth';
import { authenticatedFetch } from '@/lib/api';
import { supabase } from '@/lib/supabase';

interface TrackInfo {
  name: string;
  price: number;
  category: string;
  fullName: string;
}

const TRACK_INFO: Record<string, TrackInfo> = {
  eppp: {
    name: 'EPPP',
    price: 75,
    category: 'Psychology',
    fullName: 'Examination for Professional Practice in Psychology',
  },
  bsw: {
    name: 'BSW',
    price: 50,
    category: 'Social Work',
    fullName: 'Bachelor Social Work Licensing Prep',
  },
  'msw-lmsw': {
    name: 'MSW / LMSW',
    price: 50,
    category: 'Social Work',
    fullName: 'Master Social Work Licensing Prep',
  },
  lcsw: {
    name: 'LCSW',
    price: 50,
    category: 'Social Work',
    fullName: 'Licensed Clinical Social Worker Prep',
  },
  nce: {
    name: 'NCE',
    price: 75,
    category: 'Counseling',
    fullName: 'National Counselor Examination Prep',
  },
  ccm: {
    name: 'CCM',
    price: 50,
    category: 'Case Management',
    fullName: 'Certified Case Manager Exam Prep',
  },
  'nclex-rn': {
    name: 'NCLEX-RN',
    price: 85,
    category: 'Nursing',
    fullName: 'Registered Nurse Licensure Prep',
  },
  'nclex-pn': {
    name: 'NCLEX-PN',
    price: 85,
    category: 'Nursing',
    fullName: 'Practical Nurse Licensure Prep',
  },
};

const planFeatures = [
  'Reviewed exam-specific question bank',
  'Flashcards and case vignettes',
  'Progress analytics',
  'Track-specific study access',
];

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupLoading />}>
      <SignupContent />
    </Suspense>
  );
}

function SignupLoading() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
    </div>
  );
}

function SignupContent() {
  const searchParams = useSearchParams();
  const trackSlug = searchParams.get('track') || '';
  const trackInfo = TRACK_INFO[trackSlug] ?? null;
  const router = useRouter();
  const { toast } = useToast();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function buildRedirectUrl() {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    return `${siteUrl}/auth/verified?track=${trackSlug}`;
  }

  async function startCheckout() {
    const { data: track } = await supabase
      .from('exam_tracks')
      .select('id')
      .eq('slug', trackSlug)
      .single();

    if (!track?.id) {
      throw new Error('Selected exam track is unavailable.');
    }

    const res = await authenticatedFetch('/api/stripe/checkout', {
      method: 'POST',
      body: JSON.stringify({
        examTrackId: track.id,
      }),
    });

    const json = await res.json();
    if (!res.ok || !json.url) {
      throw new Error(json.error || 'Checkout could not be started.');
    }

    window.location.href = json.url;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!trackInfo) {
      toast({
        title: 'Select an exam plan first',
        description: 'Account creation starts from a paid exam track.',
        variant: 'destructive',
      });
      router.push('/#pricing');
      return;
    }

    if (password.length < 8) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 8 characters.',
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Confirm your password before continuing to checkout.',
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

    if (!data.session) {
      setLoading(false);
      setSubmitted(true);
      return;
    }

    const { data: profile } = await getUserProfile(data.user.id);
    if (profile?.role === 'admin') {
      router.push('/admin');
      return;
    }

    try {
      await startCheckout();
    } catch (checkoutError: any) {
      toast({
        title: 'Checkout could not start',
        description: checkoutError.message,
        variant: 'destructive',
      });
      router.push('/dashboard/subscriptions');
    }
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

  if (submitted && trackInfo) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 mb-6">
            <Mail className="w-8 h-8 text-blue-600" />
          </div>

          <h1 className="text-2xl font-bold text-slate-950 mb-2">Check your email</h1>
          <p className="text-slate-600 mb-1">We sent a verification link to</p>
          <p className="text-blue-600 font-medium mb-8">{email}</p>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6 text-left space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-slate-700 text-sm">Verify your email to activate your account</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-slate-700 text-sm">Then continue to Stripe checkout for {trackInfo.name}</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-slate-700 text-sm">No student content unlocks until payment succeeds</p>
            </div>
          </div>

          <Button variant="outline" className="w-full mb-4" onClick={handleResend} disabled={resending}>
            {resending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4 mr-2" />
            )}
            Resend verification email
          </Button>

          <p className="text-sm text-slate-500">
            Wrong email?{' '}
            <button onClick={() => setSubmitted(false)} className="text-blue-600 hover:underline">
              Go back
            </button>
            {' '}or{' '}
            <Link href="/auth/login" className="text-blue-600 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (!trackInfo) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-2xl text-slate-950">PrepCzar</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-950 mb-2">Choose a plan first</h1>
          <p className="text-slate-600 mb-6">
            PrepCzar accounts are created through a selected paid exam track. Pick your exam to see the plan and continue to checkout.
          </p>
          <Button asChild className="w-full">
            <Link href="/#pricing">
              View Exam Plans
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
          <p className="text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-blue-600 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 grid lg:grid-cols-2">
      <section className="bg-blue-600 text-white px-6 py-10 sm:px-10 lg:px-16 lg:py-20 flex items-center">
        <div className="w-full max-w-xl mx-auto">
          <Link href="/" className="inline-flex items-center gap-2 mb-10">
            <BookOpen className="w-7 h-7 text-white" />
            <span className="font-bold text-2xl">PrepCzar</span>
          </Link>

          <h1 className="text-4xl font-bold mb-4">Start Your Exam Prep</h1>
          <p className="text-blue-50 text-lg leading-relaxed mb-8">
            Create your account for the selected exam track and continue to secure checkout.
          </p>

          <div className="rounded-xl bg-blue-700/35 border border-white/10 p-6 mb-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-sm text-blue-100 uppercase tracking-wide font-medium mb-1">{trackInfo.category}</p>
                <h2 className="text-2xl font-bold">{trackInfo.name}</h2>
                <p className="text-blue-100 text-sm mt-1">{trackInfo.fullName}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">${trackInfo.price}</p>
                <p className="text-sm text-blue-100">monthly</p>
              </div>
            </div>
            <ul className="space-y-3">
              {planFeatures.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm text-blue-50">
                  <CheckCircle className="w-4 h-4 text-blue-100 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
            <p className="text-xs text-blue-100 mt-4">Billed monthly. Cancel anytime from the billing portal.</p>
          </div>

          <div className="rounded-xl bg-blue-700/35 border border-white/10 p-6">
            <p className="text-blue-50 leading-relaxed mb-4">
              &ldquo;The question bank helped me focus on the exact exam track I was preparing for. The rationales made each session practical.&rdquo;
            </p>
            <div>
              <p className="font-semibold">David Lee, Ph.D.</p>
              <p className="text-sm text-blue-100">Licensed Psychologist</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-10 sm:px-10 lg:px-16 lg:py-20 flex items-center">
        <div className="w-full max-w-md mx-auto">
          <div className="flex items-center justify-center mb-8">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${step === 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  {step}
                </div>
                {step < 3 && <div className="w-14 h-1 bg-slate-200" />}
              </div>
            ))}
          </div>

          <h2 className="text-3xl font-bold text-slate-950 mb-8">Create Your Account</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-slate-700">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
                className="h-11 bg-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-11 bg-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="h-11 bg-white pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-950 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-slate-700">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="h-11 bg-white"
              />
            </div>

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-base group" disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Lock className="w-4 h-4 mr-2" />
              )}
              Complete Purchase - ${trackInfo.price}
              {!loading && <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />}
            </Button>

            <p className="text-xs text-slate-500 text-center flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Secure checkout follows account verification.
            </p>

            <p className="text-xs text-slate-500 text-center">
              By creating an account you agree to our{' '}
              <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>
              {' '}and{' '}
              <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>
            </p>
          </form>

          <p className="text-sm text-slate-600 text-center mt-8">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-blue-600 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
