import Link from 'next/link';

export const metadata = {
  title: 'Accessibility Statement | PrepCzar',
  description: 'PrepCzar accessibility goals and support contact.',
};

export default function AccessibilityPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-12 sm:px-6">
      <article className="mx-auto max-w-3xl space-y-6">
        <Link href="/" className="text-sm font-medium text-primary">PrepCzar</Link>
        <h1 className="text-3xl font-bold text-foreground">Accessibility Statement</h1>
        <p className="text-sm text-muted-foreground">Last updated: July 13, 2026</p>
        <p>PrepCzar aims to provide accessible exam-prep tools with keyboard-friendly navigation, readable layouts, responsive design, and manual alternatives to voice features.</p>
        <p>Voice mode uses browser speech features where available. It is optional and should not be used as a safety feature for active driving.</p>
        <p>If you encounter an accessibility barrier, contact support with the page URL, browser/device, and a short description of the issue.</p>
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Accessibility support</p>
          <a href="mailto:support@prepczar.com" className="text-lg font-semibold text-primary">support@prepczar.com</a>
        </div>
      </article>
    </main>
  );
}
