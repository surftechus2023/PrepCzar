'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLang } from '@/lib/i18n';

export function CTASection() {
  const { t } = useLang();

  return (
    <section className="py-24 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `radial-gradient(ellipse at 30% 50%, hsl(213 94% 36% / 0.5) 0%, transparent 60%)`,
        }}
      />
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
          {t('cta_heading')}
        </h2>
        <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">
          {t('cta_sub')}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            className="bg-blue-500 hover:bg-blue-600 text-white px-10 py-6 text-lg shadow-brand-lg group"
            asChild
          >
            <Link href="#pricing">
              {t('cta_trial')}
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-white/30 text-white bg-white/10 hover:bg-white/20 px-10 py-6 text-lg"
            asChild
          >
            <Link href="#pricing">{t('cta_plans')}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
