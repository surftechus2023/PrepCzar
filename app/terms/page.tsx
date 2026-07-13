import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service | PrepCzar',
  description: 'PrepCzar subscription terms and acceptable use requirements.',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-12 sm:px-6">
      <article className="mx-auto max-w-3xl space-y-6">
        <Link href="/" className="text-sm font-medium text-primary">PrepCzar</Link>
        <h1 className="text-3xl font-bold text-foreground">Terms of Service</h1>
        <p className="text-sm text-muted-foreground">Last updated: July 13, 2026</p>
        <p>PrepCzar provides subscription-based study tools for selected professional exam tracks.</p>
        <p>Access is limited to the exam track attached to an active paid subscription. Sharing accounts, scraping content, or bypassing access controls is prohibited.</p>
        <p>PrepCzar content is for study support only and does not guarantee exam passage, licensure, employment, or credential approval.</p>
        <p>Administrators must review AI-generated content before publishing it to students.</p>
        <p>Subscriptions renew monthly until canceled through the billing portal. Access may be removed when a subscription is canceled, unpaid, or past due.</p>
        <p>PrepCzar is not affiliated with or endorsed by official exam organizations unless a real written authorization exists. Official exam names and blueprint references are used only to identify study categories.</p>
        <p>Users may not upload unlawful, confidential, or infringing content. Admin imports must respect copyright, privacy, and professional confidentiality requirements.</p>
      </article>
    </main>
  );
}
