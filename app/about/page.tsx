import Link from 'next/link';

export const metadata = {
  title: 'About PrepCzar',
  description: 'PrepCzar helps students prepare for professional licensing and certification exams.',
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-12 sm:px-6">
      <article className="mx-auto max-w-3xl space-y-6">
        <Link href="/" className="text-sm font-medium text-primary">PrepCzar</Link>
        <h1 className="text-3xl font-bold text-foreground">About PrepCzar</h1>
        <p>PrepCzar is an exam-prep SaaS platform for professional licensing and certification tracks.</p>
        <p>The platform combines reviewed practice questions, flashcards, case vignettes, voice-enabled study tools, and progress analytics.</p>
        <p>Each exam track is isolated so students see only the content included with their active subscription.</p>
      </article>
    </main>
  );
}
