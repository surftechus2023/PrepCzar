import Link from 'next/link';

export const metadata = {
  title: 'Contact Support | PrepCzar',
  description: 'Contact PrepCzar support for account, billing, and product help.',
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-12 sm:px-6">
      <article className="mx-auto max-w-3xl space-y-6">
        <Link href="/" className="text-sm font-medium text-primary">PrepCzar</Link>
        <h1 className="text-3xl font-bold text-foreground">Contact & Support</h1>
        <p>For account, billing, refund, or content questions, email support with your account email and exam track.</p>
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Support email</p>
          <a href="mailto:support@prepczar.com" className="text-lg font-semibold text-primary">support@prepczar.com</a>
        </div>
        <p className="text-sm text-muted-foreground">For billing questions, include the Stripe receipt ID when available.</p>
      </article>
    </main>
  );
}
