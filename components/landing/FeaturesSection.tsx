'use client';

import {
  Brain, Mic, BarChart3, Globe, RefreshCw, BookOpen, Zap, Shield, Clock
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useLang, TranslationKey } from '@/lib/i18n';

const features: { icon: React.ElementType; titleKey: TranslationKey; descKey: TranslationKey; color: string }[] = [
  { icon: Brain, titleKey: 'feat_ai_title', descKey: 'feat_ai_desc', color: 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400' },
  { icon: Mic, titleKey: 'feat_voice_title', descKey: 'feat_voice_desc', color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400' },
  { icon: Globe, titleKey: 'feat_lang_title', descKey: 'feat_lang_desc', color: 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400' },
  { icon: BarChart3, titleKey: 'feat_analytics_title', descKey: 'feat_analytics_desc', color: 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400' },
  { icon: BookOpen, titleKey: 'feat_vignettes_title', descKey: 'feat_vignettes_desc', color: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400' },
  { icon: RefreshCw, titleKey: 'feat_rotation_title', descKey: 'feat_rotation_desc', color: 'bg-teal-100 text-teal-600 dark:bg-teal-950 dark:text-teal-400' },
  { icon: Zap, titleKey: 'feat_rationales_title', descKey: 'feat_rationales_desc', color: 'bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400' },
  { icon: Shield, titleKey: 'feat_accurate_title', descKey: 'feat_accurate_desc', color: 'bg-teal-100 text-teal-600 dark:bg-teal-950 dark:text-teal-400' },
  { icon: Clock, titleKey: 'feat_resume_title', descKey: 'feat_resume_desc', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
];

export function FeaturesSection() {
  const { t } = useLang();

  return (
    <section id="features" className="py-24 bg-secondary/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4 text-primary font-medium">
            {t('features_badge')}
          </Badge>
          <h2 className="text-4xl font-bold text-foreground mb-4">
            {t('features_heading')}
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('features_sub')}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.titleKey}
                className="bg-card rounded-xl p-6 border border-border hover:border-primary/30 hover:shadow-card-hover transition-all duration-200 group"
              >
                <div className={`w-11 h-11 rounded-lg ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{t(feature.titleKey)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t(feature.descKey)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
