'use client';

import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useLang, TranslationKey } from '@/lib/i18n';

const faqs: { qKey: TranslationKey; aKey: TranslationKey }[] = [
  { qKey: 'faq_q1', aKey: 'faq_a1' },
  { qKey: 'faq_q2', aKey: 'faq_a2' },
  { qKey: 'faq_q3', aKey: 'faq_a3' },
  { qKey: 'faq_q4', aKey: 'faq_a4' },
  { qKey: 'faq_q5', aKey: 'faq_a5' },
  { qKey: 'faq_q6', aKey: 'faq_a6' },
  { qKey: 'faq_q7', aKey: 'faq_a7' },
  { qKey: 'faq_q8', aKey: 'faq_a8' },
];

export function FAQSection() {
  const { t } = useLang();

  return (
    <section id="faq" className="py-24 bg-secondary/30">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4 text-primary font-medium">
            {t('faq_badge')}
          </Badge>
          <h2 className="text-4xl font-bold text-foreground mb-4">
            {t('faq_heading')}
          </h2>
          <p className="text-xl text-muted-foreground">
            {t('faq_sub')}
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-2">
          {faqs.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="bg-card border border-border rounded-lg px-5 data-[state=open]:border-primary/30"
            >
              <AccordionTrigger className="text-left font-semibold hover:no-underline py-4">
                {t(faq.qKey)}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed pb-4">
                {t(faq.aKey)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
