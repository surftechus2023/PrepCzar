import Link from 'next/link';

export const metadata = {
  title: 'FAQ | PrepCzar',
  description: 'Frequently asked questions about PrepCzar exam prep subscriptions.',
};

const items = [
  ['Is there a free trial?', 'No. Access starts after Stripe confirms an active paid subscription.'],
  ['Does one subscription unlock every exam?', 'No. Each subscription unlocks one selected exam track.'],
  ['Can I cancel anytime?', 'Yes. Use the billing portal from the subscriptions page.'],
  ['Does student practice call OpenAI?', 'No. Student practice uses reviewed content stored in Supabase.'],
];

export default function FAQPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-12 sm:px-6">
      <article className="mx-auto max-w-3xl space-y-6">
        <Link href="/" className="text-sm font-medium text-primary">PrepCzar</Link>
        <h1 className="text-3xl font-bold text-foreground">FAQ</h1>
        <div className="space-y-4">
          {items.map(([question, answer]) => (
            <section key={question} className="rounded-lg border border-border bg-card p-5">
              <h2 className="font-semibold text-foreground">{question}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{answer}</p>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
