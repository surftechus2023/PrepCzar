import Link from 'next/link';
import { CheckCircle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PaymentConfirmedPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 mb-6">
          <CheckCircle className="h-8 w-8 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-950 mb-2">Payment confirmed</h1>
        <p className="text-slate-600 mb-6">
          Stripe has received your payment. We&apos;ll send a confirmation email and a sign-in link to the email used at checkout.
        </p>
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
