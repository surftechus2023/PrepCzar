'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  BookOpen, Sun, Moon, Menu, X, ChevronDown, LogOut, User, LayoutDashboard, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { signOut } from '@/lib/auth';
import { useLang, Language } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const navLinks = [
  { key: 'nav_exams' as const, href: '#exams' },
  { key: 'nav_features' as const, href: '#features' },
  { key: 'nav_pricing' as const, href: '#pricing' },
  { key: 'nav_faq' as const, href: '#faq' },
];

const langOptions: { code: Language; flag: string; label: string }[] = [
  { code: 'en', flag: '🇺🇸', label: 'EN' },
  { code: 'es', flag: '🇪🇸', label: 'ES' },
  { code: 'fr', flag: '🇫🇷', label: 'FR' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const { lang, setLang, t } = useLang();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  async function handleSignOut() {
    await signOut();
    router.push('/');
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? 'U';

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-sm border-b border-border'
          : 'bg-transparent'
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center group-hover:bg-primary/90 transition-colors">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className={cn(
              'font-bold text-xl transition-colors',
              scrolled ? 'text-foreground' : 'text-white'
            )}>
              PrepCzar
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  scrolled
                    ? 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                )}
              >
                {t(link.key)}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Language switcher */}
            <div className={cn(
              'hidden md:flex items-center gap-0.5 rounded-lg p-0.5',
              scrolled ? 'bg-secondary' : 'bg-white/10'
            )}>
              {langOptions.map((opt) => (
                <button
                  key={opt.code}
                  onClick={() => setLang(opt.code)}
                  title={opt.code === 'en' ? 'English' : opt.code === 'es' ? 'Español' : 'Français'}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold transition-all duration-150',
                    lang === opt.code
                      ? scrolled
                        ? 'bg-white dark:bg-slate-700 text-foreground shadow-sm'
                        : 'bg-white text-slate-900 shadow-sm'
                      : scrolled
                        ? 'text-muted-foreground hover:text-foreground'
                        : 'text-white/70 hover:text-white'
                  )}
                >
                  <span>{opt.flag}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>

            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={cn(
                scrolled ? '' : 'text-white hover:bg-white/10 hover:text-white'
              )}
            >
              {mounted && (theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />)}
            </Button>

            {!loading && (
              <>
                {user ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="flex items-center gap-2 h-9 px-2">
                        <Avatar className="w-7 h-7">
                          <AvatarFallback className="bg-primary text-white text-xs font-semibold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <ChevronDown className="w-3 h-3 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <div className="px-2 py-1.5">
                        <p className="text-sm font-medium">{profile?.full_name || t('nav_student')}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard" className="cursor-pointer">
                          <LayoutDashboard className="w-4 h-4 mr-2" />
                          {t('nav_dashboard')}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard/profile" className="cursor-pointer">
                          <User className="w-4 h-4 mr-2" />
                          {t('nav_profile')}
                        </Link>
                      </DropdownMenuItem>
                      {profile?.role === 'admin' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link href="/admin" className="cursor-pointer">
                              <Shield className="w-4 h-4 mr-2" />
                              {t('nav_admin')}
                            </Link>
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleSignOut} className="text-destructive cursor-pointer">
                        <LogOut className="w-4 h-4 mr-2" />
                        {t('nav_signout')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <div className="hidden md:flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className={cn(
                        scrolled ? '' : 'text-white hover:bg-white/10 hover:text-white'
                      )}
                    >
                      <Link href="/auth/login">{t('nav_signin')}</Link>
                    </Button>
                    <Button size="sm" asChild className={cn(
                      scrolled ? '' : 'bg-white text-primary hover:bg-white/90'
                    )}>
                      <Link href="/auth/signup">{t('nav_get_started')}</Link>
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* Mobile menu toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white dark:bg-slate-900 border-b border-border shadow-lg">
          <div className="px-4 py-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                {t(link.key)}
              </Link>
            ))}
            {/* Mobile language switcher */}
            <div className="pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground px-3 mb-2">Language / Idioma / Langue</p>
              <div className="flex gap-2 px-3">
                {langOptions.map((opt) => (
                  <button
                    key={opt.code}
                    onClick={() => setLang(opt.code)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
                      lang === opt.code
                        ? 'bg-primary text-white border-primary'
                        : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                    )}
                  >
                    <span>{opt.flag}</span>
                    <span>{opt.code === 'en' ? 'English' : opt.code === 'es' ? 'Español' : 'Français'}</span>
                  </button>
                ))}
              </div>
            </div>
            {!user && (
              <div className="pt-3 border-t border-border flex flex-col gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/auth/login">{t('nav_signin')}</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/auth/signup">{t('nav_get_started_free')}</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
