'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { BarChart3, BookOpen, Users, LayoutDashboard, HelpCircle, Layers, MessageSquare, ShieldCheck, Sparkles } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const adminNav = [
  { icon: LayoutDashboard, label: 'Overview', href: '/admin' },
  { icon: BookOpen, label: 'Exams', href: '/admin/exams' },
  { icon: Sparkles, label: 'Generate Content', href: '/admin/generate' },
  { icon: HelpCircle, label: 'Questions', href: '/admin/questions' },
  { icon: ShieldCheck, label: 'Question Review', href: '/admin/review-questions' },
  { icon: Layers, label: 'Flashcards', href: '/admin/flashcards' },
  { icon: MessageSquare, label: 'Vignettes', href: '/admin/vignettes' },
  { icon: BarChart3, label: 'Analytics', href: '/admin/analytics' },
  { icon: Users, label: 'Users', href: '/admin/users' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/auth/login');
      else if (profile && profile.role !== 'admin') router.push('/dashboard');
    }
  }, [loading, user, profile, router]);

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (profile.role !== 'admin') return null;

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/auth/login');
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 flex flex-col bg-slate-900 border-r border-slate-800">
        <div className="flex items-center gap-2 px-4 h-16 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm">PrepCzar</p>
            <p className="text-xs text-slate-400">Admin Panel</p>
          </div>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          <div className="space-y-0.5 px-2">
            {adminNav.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="p-3 border-t border-slate-800 space-y-1">
          <Link href="/admin" className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors px-3 py-2">
            <LayoutDashboard className="w-4 h-4" />
            Admin Home
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors px-3 py-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-background">
        {children}
      </main>
    </div>
  );
}
