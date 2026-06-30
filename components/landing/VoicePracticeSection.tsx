'use client';

import { Mic, Volume2, Brain, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useLang, TranslationKey } from '@/lib/i18n';

const steps: { icon: React.ElementType; titleKey: TranslationKey; descKey: TranslationKey }[] = [
  { icon: Volume2, titleKey: 'voice_step1_title', descKey: 'voice_step1_desc' },
  { icon: Mic, titleKey: 'voice_step2_title', descKey: 'voice_step2_desc' },
  { icon: Brain, titleKey: 'voice_step3_title', descKey: 'voice_step3_desc' },
];

const featKeys: TranslationKey[] = ['voice_feat1', 'voice_feat2', 'voice_feat3'];

export function VoicePracticeSection() {
  const { t } = useLang();

  const options = [
    { key: 'voice_opt_a' as TranslationKey, correct: false },
    { key: 'voice_opt_b' as TranslationKey, correct: true },
    { key: 'voice_opt_c' as TranslationKey, correct: false },
    { key: 'voice_opt_d' as TranslationKey, correct: false },
  ];

  return (
    <section className="py-24 bg-background overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Text content */}
          <div>
            <Badge variant="secondary" className="mb-4 text-primary font-medium">
              {t('voice_badge')}
            </Badge>
            <h2 className="text-4xl font-bold text-foreground mb-6">
              {t('voice_heading').split('Voice Practice Mode')[0]}
              <span className="block text-primary">Voice Practice Mode</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              {t('voice_sub')}
            </p>

            <div className="space-y-4 mb-8">
              {steps.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.titleKey} className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">{t(step.titleKey)}</h4>
                      <p className="text-sm text-muted-foreground">{t(step.descKey)}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-3">
              {featKeys.map((key) => (
                <div key={key} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  {t(key)}
                </div>
              ))}
            </div>
          </div>

          {/* Visual mockup */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-cyan-500/20 rounded-3xl blur-2xl" />

            <div className="relative bg-card border border-border rounded-2xl p-8 shadow-card-hover">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <Badge className="bg-primary/10 text-primary border-primary/20">Question 23 of 100</Badge>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Volume2 className="w-4 h-4 text-primary animate-pulse-slow" />
                    <span>{t('voice_reading')}</span>
                  </div>
                </div>
                <p className="text-foreground font-medium leading-relaxed text-sm">
                  {t('voice_question')}
                </p>
              </div>

              <div className="space-y-2 mb-6">
                {options.map(({ key, correct }) => (
                  <div
                    key={key}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-sm transition-colors ${
                      correct
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-700 dark:text-emerald-300'
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    {correct && <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                    <span>{t(key)}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-xl border border-primary/20">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center animate-pulse-slow">
                  <Mic className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{t('voice_listening')}</p>
                  <p className="text-xs text-muted-foreground">{t('voice_hint')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
