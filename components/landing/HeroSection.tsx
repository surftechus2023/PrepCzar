'use client';

import Link from 'next/link';
import { ArrowRight, Star, CheckCircle, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLang, Language } from '@/lib/i18n';

const languages: { code: Language; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
];

const stats = [
  { value: '50,000+', key: 'hero_stat_questions' as const },
  { value: '12,000+', key: 'hero_stat_students' as const },
  { value: '94%', key: 'hero_stat_rate' as const },
  { value: '5', key: 'hero_stat_exams' as const },
];

export function HeroSection() {
  const { lang, setLang, t } = useLang();

  return (
    <section className="relative min-h-[100vh] flex items-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900" />
      <div className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `radial-gradient(ellipse at 20% 50%, hsl(213 94% 36% / 0.4) 0%, transparent 60%),
                            radial-gradient(ellipse at 80% 20%, hsl(195 80% 40% / 0.3) 0%, transparent 60%)`,
        }}
      />
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `linear-gradient(hsl(0 0% 100% / 0.1) 1px, transparent 1px),
                            linear-gradient(90deg, hsl(0 0% 100% / 0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="flex justify-center mb-6">
            <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 px-4 py-1.5 text-sm font-medium">
              <Star className="w-3.5 h-3.5 mr-1.5 fill-current" />
              {t('hero_badge')}
            </Badge>
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-[1.1]">
            {t('hero_headline_1')}
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
              {t('hero_headline_2')}
            </span>
            {t('hero_headline_3')}
          </h1>

          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto leading-relaxed">
            {t('hero_sub')}
          </p>

          {/* Key benefits */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            {(['hero_benefit_1', 'hero_benefit_2', 'hero_benefit_3', 'hero_benefit_4'] as const).map((key) => (
              <div key={key} className="flex items-center gap-2 text-slate-300 text-sm">
                <CheckCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                {t(key)}
              </div>
            ))}
          </div>

          {/* Language selector */}
          <div className="flex flex-col items-center gap-3 mb-10">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Globe className="w-4 h-4" />
              <span>{t('hero_lang_label')}</span>
            </div>
            <div className="flex items-center gap-2 p-1 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
              {languages.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    lang === l.code
                      ? 'bg-white text-slate-900 shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span>{l.flag}</span>
                  <span>{l.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button
              size="lg"
              className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-6 text-lg shadow-brand-lg group"
              asChild
            >
              <Link href="#pricing">
                {t('hero_cta_trial')}
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/30 text-white bg-white/10 hover:bg-white/20 px-8 py-6 text-lg backdrop-blur-sm"
              asChild
            >
              <Link href="#pricing">{t('hero_cta_pricing')}</Link>
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat) => (
              <div key={stat.key} className="text-center">
                <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-sm text-slate-400">{t(stat.key)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
