import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | PrepCzar',
  description: 'How PrepCzar collects, uses, and protects account, billing, and study data.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-12 sm:px-6">
      <article className="mx-auto max-w-3xl space-y-6">
        <Link href="/" className="text-sm font-medium text-primary">PrepCzar</Link>
        <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: July 13, 2026</p>
        <p>PrepCzar collects account details, subscription status, study activity, and support messages to operate the exam-prep service.</p>
        <p>Payments are processed by Stripe. PrepCzar does not store full card numbers. Authentication and app data are processed through Supabase.</p>
        <p>We use study activity to show progress, scores, weak topics, and product diagnostics. We do not sell personal information.</p>
        <p>AI generation is used by administrators to create draft study content. Student practice answers are not sent to OpenAI during normal practice sessions.</p>
        <p>Uploaded administrator materials are used for parsing, review, and audit workflows. Do not upload sensitive health information, confidential client records, or copyrighted materials unless you have the rights and operational need to do so.</p>
        <p>PrepCzar is not affiliated with or endorsed by ASWB, ASPPB, NBCC, CCMC, NCSBN, or other official exam organizations unless a written authorization is explicitly stated.</p>
        <p>You may request account help, data export, or deletion by contacting support through the contact page.</p>
      </article>
    </main>
  );
}
