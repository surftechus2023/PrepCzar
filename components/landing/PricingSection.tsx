'use client';

import Link from 'next/link';
import { CheckCircle, Brain, Heart, MessageSquare, ClipboardList, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLang, TranslationKey } from '@/lib/i18n';

const standardFeatures: TranslationKey[] = [
  'pricing_f2', 'pricing_f4', 'pricing_f6', 'pricing_f7', 'pricing_f8', 'pricing_f9',
];

const nclexFeatures: TranslationKey[] = [
  'pricing_f1', 'pricing_f3', 'pricing_f5', 'pricing_f7', 'pricing_f8', 'pricing_f9',
];

interface TrackPlan {
  slug: string;
  name: string;
  price: number;
  popular: boolean;
  featureKeys: TranslationKey[];
  categoryIcon: React.ElementType;
  categoryLabel: string;
}

// Row 1: Psychology, Counseling, Case Management — one card each, shown as 3-col grid
const row1: TrackPlan[] = [
  { slug: 'eppp',  name: 'EPPP', price: 75, popular: false, featureKeys: standardFeatures, categoryIcon: Brain,        categoryLabel: 'Psychology' },
  { slug: 'nce',   name: 'NCE',  price: 75, popular: false, featureKeys: standardFeatures, categoryIcon: MessageSquare, categoryLabel: 'Counseling' },
  { slug: 'ccm',   name: 'CCM',  price: 50, popular: false, featureKeys: standardFeatures, categoryIcon: ClipboardList, categoryLabel: 'Case Management' },
];

// Row 2: Social Work — 3 cards
const row2 = {
  icon: Heart,
  label: 'Social Work',
  tracks: [
    { slug: 'bsw',      name: 'BSW',        price: 50, popular: false, featureKeys: standardFeatures },
    { slug: 'msw-lmsw', name: 'MSW / LMSW', price: 50, popular: false, featureKeys: standardFeatures },
    { slug: 'lcsw',     name: 'LCSW',       price: 50, popular: false, featureKeys: standardFeatures },
  ],
};

// Row 3: Nursing — 2 cards
const row3 = {
  icon: Stethoscope,
  label: 'Nursing',
  tracks: [
    { slug: 'nclex-rn', name: 'NCLEX-RN', price: 85, popular: true,  featureKeys: nclexFeatures },
    { slug: 'nclex-pn', name: 'NCLEX-PN', price: 85, popular: false, featureKeys: nclexFeatures },
  ],
};

function PlanCard({ plan, showCategory = false }: {
  plan: { slug: string; name: string; price: number; popular: boolean; featureKeys: TranslationKey[]; categoryIcon?: React.ElementType; categoryLabel?: string };
  showCategory?: boolean;
}) {
  const { t } = useLang();
  const CatIcon = plan.categoryIcon;

  return (
    <Card
      className={`relative overflow-hidden transition-all duration-200 hover:shadow-card-hover ${
        plan.popular ? 'border-primary ring-2 ring-primary/20' : 'border-border'
      }`}
    >
      {plan.popular && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
      )}
      <CardHeader className="pb-4">
        {showCategory && CatIcon && (
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
              <CatIcon className="w-4 h-4 text-primary" />
            </div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {plan.categoryLabel}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-bold text-lg text-foreground">{plan.name}</h4>
          {plan.popular && (
            <Badge className="bg-primary text-primary-foreground text-xs">
              {t('pricing_popular')}
            </Badge>
          )}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold text-foreground">${plan.price}</span>
          <span className="text-muted-foreground">{t('pricing_mo')}</span>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2.5 mb-6">
          {plan.featureKeys.map((key) => (
            <li key={key} className="flex items-center gap-2.5 text-sm">
              <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span className="text-foreground">{t(key)}</span>
            </li>
          ))}
        </ul>
        <Button
          className="w-full"
          variant={plan.popular ? 'default' : 'outline'}
          asChild
        >
          <Link href={`/auth/signup?track=${plan.slug}`}>
            {t('pricing_cta')}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function CategorySection({ icon: Icon, label, tracks }: typeof row2) {
  const { t } = useLang();
  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <h3 className="text-xl font-bold text-foreground">{label}</h3>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {tracks.map((plan) => (
          <PlanCard key={plan.slug} plan={plan} />
        ))}
      </div>
    </div>
  );
}

export function PricingSection() {
  const { t } = useLang();

  return (
    <section id="pricing" className="py-24 bg-secondary/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4 text-primary font-medium">
            {t('pricing_badge')}
          </Badge>
          <h2 className="text-4xl font-bold text-foreground mb-4">
            {t('pricing_heading')}
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('pricing_sub')}
          </p>
        </div>

        <div className="space-y-12">
          {/* Row 1: Psychology · Counseling · Case Management */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {row1.map((plan) => (
              <PlanCard key={plan.slug} plan={plan} showCategory />
            ))}
          </div>

          {/* Row 2: Social Work */}
          <CategorySection {...row2} />

          {/* Row 3: Nursing */}
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Stethoscope className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Nursing</h3>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 max-w-2xl">
              {row3.tracks.map((plan) => (
                <PlanCard key={plan.slug} plan={plan} />
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-12">
          {t('pricing_note')}
        </p>
      </div>
    </section>
  );
}
