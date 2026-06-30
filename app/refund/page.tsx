import Link from 'next/link';

export const metadata = {
  title: 'Refund Policy | PrepCzar',
  description: 'PrepCzar refund and cancellation policy.',
};

export default function RefundPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-12 sm:px-6">
      <article className="mx-auto max-w-3xl space-y-6">
        <Link href="/" className="text-sm font-medium text-primary">PrepCzar</Link>
        <h1 className="text-3xl font-bold text-foreground">Refund Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: June 23, 2026</p>
        <p>Subscriptions can be canceled at any time from the billing portal.</p>
        <p>When a subscription is canceled, access continues until the end of the paid billing period unless Stripe reports the subscription as unpaid, past due, or canceled immediately.</p>
        <p>Refunds are reviewed case by case for duplicate charges, billing errors, or account access issues.</p>
        <p>To request a refund review, contact support with the account email, Stripe receipt, and reason for the request.</p>
      </article>
    </main>
  );
}
