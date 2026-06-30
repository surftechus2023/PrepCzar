'use client';

import { Star, Quote } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useLang, TranslationKey } from '@/lib/i18n';

const testimonials: {
  nameKey: TranslationKey;
  examKey: TranslationKey;
  contentKey: TranslationKey;
  role: string;
  rating: number;
  image: string;
}[] = [
  {
    nameKey: 'test1_name',
    examKey: 'test1_exam',
    contentKey: 'test1_text',
    role: 'Licensed Clinical Social Worker',
    rating: 5,
    image: 'https://images.pexels.com/photos/3756679/pexels-photo-3756679.jpeg?auto=compress&cs=tinysrgb&w=150',
  },
  {
    nameKey: 'test2_name',
    examKey: 'test2_exam',
    contentKey: 'test2_text',
    role: 'Registered Nurse, ICU',
    rating: 5,
    image: 'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=150',
  },
  {
    nameKey: 'test3_name',
    examKey: 'test3_exam',
    contentKey: 'test3_text',
    role: 'Psychologist',
    rating: 5,
    image: 'https://images.pexels.com/photos/3671083/pexels-photo-3671083.jpeg?auto=compress&cs=tinysrgb&w=150',
  },
  {
    nameKey: 'test4_name',
    examKey: 'test4_exam',
    contentKey: 'test4_text',
    role: 'Certified Case Manager',
    rating: 5,
    image: 'https://images.pexels.com/photos/6375904/pexels-photo-6375904.jpeg?auto=compress&cs=tinysrgb&w=150',
  },
];

export function TestimonialsSection() {
  const { t } = useLang();

  return (
    <section className="py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4 text-primary font-medium">
            {t('test_badge')}
          </Badge>
          <h2 className="text-4xl font-bold text-foreground mb-4">
            {t('test_heading')}
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('test_sub')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {testimonials.map((item) => (
            <div
              key={item.nameKey}
              className="bg-card border border-border rounded-xl p-6 hover:border-primary/30 hover:shadow-card-hover transition-all duration-200 relative"
            >
              <Quote className="absolute top-4 right-4 w-8 h-8 text-primary/10" />

              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: item.rating }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>

              <p className="text-foreground leading-relaxed mb-5 italic">
                &ldquo;{t(item.contentKey)}&rdquo;
              </p>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-secondary flex-shrink-0">
                  <img
                    src={item.image}
                    alt={t(item.nameKey)}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">{t(item.nameKey)}</p>
                  <p className="text-xs text-muted-foreground">{item.role}</p>
                </div>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {t(item.examKey)}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
