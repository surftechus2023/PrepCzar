'use client';

import Link from 'next/link';
import { Brain, Heart, MessageSquare, Briefcase, Stethoscope, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLang, TranslationKey } from '@/lib/i18n';

const exams = [
  {
    icon: Brain,
    slug: 'eppp',
    price: '$75/mo',
    nameKey: 'exam_eppp_name' as TranslationKey,
    descKey: 'exam_eppp_desc' as TranslationKey,
    topicKeys: ['exam_eppp_t1', 'exam_eppp_t2', 'exam_eppp_t3', 'exam_eppp_t4'] as TranslationKey[],
    color: 'from-blue-600 to-blue-700',
    badgeKey: 'exams_popular' as TranslationKey,
  },
  {
    icon: Heart,
    slug: 'social-work',
    price: '$50/mo',
    nameKey: 'exam_sw_name' as TranslationKey,
    descKey: 'exam_sw_desc' as TranslationKey,
    topicKeys: ['exam_sw_t1', 'exam_sw_t2', 'exam_sw_t3', 'exam_sw_t4'] as TranslationKey[],
    color: 'from-rose-600 to-rose-700',
    badgeKey: null,
  },
  {
    icon: MessageSquare,
    slug: 'nce',
    price: '$75/mo',
    nameKey: 'exam_nce_name' as TranslationKey,
    descKey: 'exam_nce_desc' as TranslationKey,
    topicKeys: ['exam_nce_t1', 'exam_nce_t2', 'exam_nce_t3', 'exam_nce_t4'] as TranslationKey[],
    color: 'from-emerald-600 to-emerald-700',
    badgeKey: null,
  },
  {
    icon: Briefcase,
    slug: 'ccm',
    price: '$50/mo',
    nameKey: 'exam_ccm_name' as TranslationKey,
    descKey: 'exam_ccm_desc' as TranslationKey,
    topicKeys: ['exam_ccm_t1', 'exam_ccm_t2', 'exam_ccm_t3', 'exam_ccm_t4'] as TranslationKey[],
    color: 'from-amber-600 to-amber-700',
    badgeKey: null,
  },
  {
    icon: Stethoscope,
    slug: 'nclex',
    price: '$85/mo',
    nameKey: 'exam_nclex_name' as TranslationKey,
    descKey: 'exam_nclex_desc' as TranslationKey,
    topicKeys: ['exam_nclex_t1', 'exam_nclex_t2', 'exam_nclex_t3', 'exam_nclex_t4'] as TranslationKey[],
    color: 'from-cyan-600 to-cyan-700',
    badgeKey: 'exams_new' as TranslationKey,
  },
];

export function ExamCategoriesSection() {
  const { t } = useLang();

  return (
    <section id="exams" className="py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4 text-primary font-medium">
            {t('exams_badge')}
          </Badge>
          <h2 className="text-4xl font-bold text-foreground mb-4">
            {t('exams_heading')}
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('exams_sub')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {exams.map((exam) => {
            const Icon = exam.icon;
            return (
              <Card
                key={exam.slug}
                className="group relative overflow-hidden border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-card-hover cursor-pointer"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${exam.color} flex items-center justify-center shadow-md group-hover:scale-110 transition-transform`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    {exam.badgeKey && (
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                        {t(exam.badgeKey)}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-lg text-foreground">{t(exam.nameKey)}</h3>
                    <span className="text-lg font-bold text-primary">{exam.price}</span>
                  </div>

                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                    {t(exam.descKey)}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {exam.topicKeys.map((key) => (
                      <span
                        key={key}
                        className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-md font-medium"
                      >
                        {t(key)}
                      </span>
                    ))}
                  </div>

                  <Button
                    className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                    variant="outline"
                    asChild
                  >
                    <Link href="#pricing">
                      {t('exams_cta')}
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
