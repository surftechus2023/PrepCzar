'use client';

import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { useLang, TranslationKey } from '@/lib/i18n';

export function Footer() {
  const { t } = useLang();

  const footerLinks: { categoryKey: TranslationKey; links: { labelKey: TranslationKey; href: string }[] }[] = [
    {
      categoryKey: 'footer_platform',
      links: [
        { labelKey: 'footer_features', href: '#features' },
        { labelKey: 'footer_pricing', href: '#pricing' },
        { labelKey: 'footer_faq', href: '#faq' },
        { labelKey: 'footer_dashboard', href: '/dashboard' },
      ],
    },
    {
      categoryKey: 'footer_exams',
      links: [
        { labelKey: 'exam_eppp_name', href: '/auth/signup?track=eppp' },
        { labelKey: 'exam_sw_name', href: '/auth/signup?track=lcsw' },
        { labelKey: 'exam_nce_name', href: '/auth/signup?track=nce' },
        { labelKey: 'exam_ccm_name', href: '/auth/signup?track=ccm' },
        { labelKey: 'exam_nclex_name', href: '/auth/signup?track=nclex-rn' },
      ],
    },
    {
      categoryKey: 'footer_account',
      links: [
        { labelKey: 'footer_signup', href: '/auth/signup' },
        { labelKey: 'footer_signin', href: '/auth/login' },
        { labelKey: 'footer_forgot', href: '/auth/forgot-password' },
        { labelKey: 'footer_profile', href: '/dashboard/profile' },
      ],
    },
  ];

  const legalLinks: { labelKey: TranslationKey; href: string }[] = [
    { labelKey: 'footer_privacy', href: '/privacy' },
    { labelKey: 'footer_terms', href: '/terms' },
    { labelKey: 'footer_contact', href: '/contact' },
  ];

  return (
    <footer className="bg-slate-900 text-slate-300 py-16 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-xl text-white">PrepCzar</span>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              {t('footer_tagline')}
            </p>
            <p className="text-xs text-slate-500">
              {t('footer_languages')}
            </p>
          </div>

          {footerLinks.map((section) => (
            <div key={section.categoryKey}>
              <h4 className="font-semibold text-white text-sm mb-4 uppercase tracking-wider">
                {t(section.categoryKey)}
              </h4>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.labelKey}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-400 hover:text-white transition-colors"
                    >
                      {t(link.labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} PrepCzar. {t('footer_rights')}
          </p>
          <div className="flex gap-6">
            {legalLinks.map((link) => (
              <Link
                key={link.labelKey}
                href={link.href}
                className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
              >
                {t(link.labelKey)}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
