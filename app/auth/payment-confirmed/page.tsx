'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PaymentConfirmedPage() {
  return (
    <Suspense fallback={<PaymentConfirmedShell />}>
      <PaymentConfirmedContent />
    </Suspense>
  );
}

function PaymentConfirmedShell() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    </div>
  );
}

function PaymentConfirmedContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [status, setStatus] = useState<'checking' | 'confirmed' | 'error'>(sessionId ? 'checking' : 'confirmed');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId) return;

    let active = true;

    async function confirmCheckout() {
      try {
        const res = await fetch('/api/stripe/confirm-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Could not confirm checkout');
        if (active) setStatus('confirmed');
      } catch (err: any) {
        if (active) {
          setError(err.message || 'Could not confirm checkout');
          setStatus('error');
        }
      }
    }

    confirmCheckout();

    return () => {
      active = false;
    };
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 mb-6">
          <CheckCircle className="h-8 w-8 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-950 mb-2">Payment confirmed</h1>
        <p className="text-slate-600 mb-6">
          Stripe has received your payment. We&apos;ll confirm your subscription and send a sign-in link to the email used at checkout.
        </p>
        {status === 'checking' && (
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-left mb-6">
            <div className="flex gap-3">
              <Loader2 className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0 animate-spin" />
              <p className="text-sm text-slate-700">Checking Stripe payment status. Access is activated by webhook processing.</p>
            </div>
          </div>
        )}
        {status === 'error' && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-left mb-6">
            <p className="text-sm font-medium text-red-800">Payment was received, but access sync needs attention.</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        )}
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-left mb-6">
          <div className="flex gap-3">
            <Mail className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-slate-700">
              You can use the email sign-in link when it arrives, or sign in regularly with your email and password.
            </p>
          </div>
        </div>
        <Button asChild className="w-full">
          <Link href="/auth/login">Sign in with password</Link>
        </Button>
      </div>
    </div>
  );
}
