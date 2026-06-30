import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { Toaster } from '@/components/ui/toaster';
import { LangProvider } from '@/lib/i18n';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: {
    default: 'PrepCzar - Professional Exam Prep Platform',
    template: '%s | PrepCzar',
  },
  description:
    'Prepare for EPPP, NCLEX, NCE, LCSW, CCM, and more with track-specific practice questions, flashcards, and case vignettes.',
  keywords: 'exam prep, EPPP, NCLEX, NCE, LCSW, CCM, practice questions, flashcards',
  openGraph: {
    title: 'PrepCzar - Professional Exam Prep Platform',
    description: 'Track-specific professional exam prep with reviewed questions, flashcards, case vignettes, and progress analytics.',
    url: '/',
    siteName: 'PrepCzar',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <LangProvider>
            <AuthProvider>
              {children}
              <Toaster />
            </AuthProvider>
          </LangProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
