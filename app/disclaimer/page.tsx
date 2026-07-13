import Link from 'next/link';

export const metadata = {
  title: 'Exam Prep & AI Disclaimer | PrepCzar',
  description: 'PrepCzar exam-prep, AI content, and official affiliation disclaimers.',
};

export default function DisclaimerPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-12 sm:px-6">
      <article className="mx-auto max-w-3xl space-y-6">
        <Link href="/" className="text-sm font-medium text-primary">PrepCzar</Link>
        <h1 className="text-3xl font-bold text-foreground">Exam Prep & AI Disclaimer</h1>
        <p className="text-sm text-muted-foreground">Last updated: July 13, 2026</p>
        <p>PrepCzar is a study aid. Scores, analytics, and practice performance do not guarantee official exam results, licensure, certification, employment, or credential approval.</p>
        <p>PrepCzar does not provide legal, medical, clinical, nursing, counseling, social work, psychological, or case-management advice. Practice content is educational.</p>
        <p>AI may assist administrators with draft content generation, review, improvement, import cleanup, and translation. AI-created content must be reviewed before publication.</p>
        <p>PrepCzar is not affiliated with or endorsed by ASWB, ASPPB, NBCC, CCMC, NCSBN, or other official exam organizations unless a written authorization is expressly stated.</p>
        <p>Official exam names, category labels, and blueprint references are used only to identify study areas and align preparation materials.</p>
      </article>
    </main>
  );
}
