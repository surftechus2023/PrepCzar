'use client';

import { Sparkles, Target, TrendingUp, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useLang, TranslationKey } from '@/lib/i18n';

const benefits: { icon: React.ElementType; titleKey: TranslationKey; descKey: TranslationKey }[] = [
  { icon: Sparkles, titleKey: 'ai_b1_title', descKey: 'ai_b1_desc' },
  { icon: Target, titleKey: 'ai_b2_title', descKey: 'ai_b2_desc' },
  { icon: TrendingUp, titleKey: 'ai_b3_title', descKey: 'ai_b3_desc' },
  { icon: MessageSquare, titleKey: 'ai_b4_title', descKey: 'ai_b4_desc' },
];

const dashboardSignals = [
  { label: 'Weak blueprint topics', detail: 'From missed questions', width: 78, color: 'bg-red-500' },
  { label: 'Score and domain trends', detail: 'From completed sessions', width: 64, color: 'bg-amber-500' },
  { label: 'Recommended next practice', detail: 'Based on weak areas', width: 52, color: 'bg-yellow-500' },
];

export function AiCoachingSection() {
  const { t } = useLang();

  return (
    <section className="py-24 bg-slate-900 text-white relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Visual */}
          <div className="order-2 lg:order-1">
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{t('ai_panel_title')}</p>
                  <p className="text-xs text-slate-400">{t('ai_panel_sub')}</p>
                </div>
              </div>

              <div className="mb-5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  {t('ai_panel_needs')}
                </p>
                <div className="space-y-2">
                  {dashboardSignals.map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300">{item.label}</span>
                        <span className="text-slate-400">{item.detail}</span>
                      </div>
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${item.color} rounded-full`}
                          style={{ width: `${item.width}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-blue-600/20 border border-blue-500/30 rounded-lg p-4">
                <p className="text-xs font-semibold text-blue-300 mb-1">{t('ai_panel_rec_label')}</p>
                <p className="text-sm text-slate-300">{t('ai_panel_rec')}</p>
              </div>
            </div>
          </div>

          {/* Right: Text */}
          <div className="order-1 lg:order-2">
            <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 mb-4">
              {t('ai_badge')}
            </Badge>
            <h2 className="text-4xl font-bold text-white mb-6">
              {t('ai_heading')}
            </h2>
            <p className="text-lg text-slate-300 mb-10 leading-relaxed">
              {t('ai_sub')}
            </p>

            <div className="grid sm:grid-cols-2 gap-5">
              {benefits.map((b) => {
                const Icon = b.icon;
                return (
                  <div key={b.titleKey} className="flex gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white text-sm mb-1">{t(b.titleKey)}</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">{t(b.descKey)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
