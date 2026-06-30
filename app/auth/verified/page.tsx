'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BookOpen, Loader2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { authenticatedFetch } from '@/lib/api';

export default function VerifiedPage() {
  return (
    <Suspense fallback={<VerifiedLoading />}>
      <VerifiedContent />
    </Suspense>
  );
}

function VerifiedLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
    </div>
  );
}

function VerifiedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const trackSlug = searchParams.get('track') || '';
  const code = searchParams.get('code') || '';
  const [status, setStatus] = useState<'verifying' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let redirecting = false;

    async function handleSession() {
      if (redirecting) return;
      redirecting = true;

      if (trackSlug) {
        try {
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
        } catch {
          // fall through to subscriptions
        }
      }

      router.push('/dashboard/subscriptions');
    }

    async function run() {
      // PKCE flow: the email link contains ?code=xxx — exchange it for a session
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setStatus('error');
          setErrorMessage('The verification link may have expired or already been used. Please try signing in or request a new link.');
          return;
        }
        if (data.session?.user) {
          await handleSession();
          return;
        }
      }

      // Fallback: session may already exist (e.g. hash-token flow or already exchanged)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await handleSession();
        return;
      }

      // Listen for auth state changes as last resort (hash-token implicit flow)
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user && !redirecting) {
          subscription.unsubscribe();
          clearTimeout(timeout);
          await handleSession();
        }
      });

      // Timeout — if nothing resolves after 10s, show an error
      const timeout = setTimeout(() => {
        subscription.unsubscribe();
        if (!redirecting) {
          setStatus('error');
          setErrorMessage('The verification link may have expired or already been used. Please try signing in or request a new link.');
        }
      }, 10000);
    }

    run();
  }, [router, trackSlug, code]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-2 justify-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-2xl text-white">PrepCzar</span>
        </Link>

        {status === 'verifying' ? (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/20 border border-blue-500/30 mb-6">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Verifying your email</h1>
            <p className="text-slate-400">Please wait while we confirm your account...</p>
          </>
        ) : (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/30 mb-6">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Verification failed</h1>
            <p className="text-slate-400 mb-8">{errorMessage}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild className="bg-blue-500 hover:bg-blue-600 text-white">
                <Link href="/auth/login">Sign in</Link>
              </Button>
              <Button asChild variant="outline" className="border-white/20 text-slate-300 hover:text-white hover:bg-white/10">
                <Link href="/auth/signup">Create new account</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
