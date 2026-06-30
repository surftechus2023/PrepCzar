'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Users, HelpCircle, Layers, MessageSquare, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function AdminOverviewPage() {
  const [stats, setStats] = useState({
    questions: 0,
    flashcards: 0,
    vignettes: 0,
    users: 0,
    subscriptions: 0,
    pendingReview: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const [questionsRes, flashRes, vigRes, usersRes, subsRes, pendingRes] = await Promise.all([
      supabase.from('questions').select('id', { count: 'exact', head: true }),
      supabase.from('flashcards').select('id', { count: 'exact', head: true }),
      supabase.from('case_vignettes').select('id', { count: 'exact', head: true }),
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('questions').select('id', { count: 'exact', head: true }).eq('reviewed', false),
    ]);

    setStats({
      questions: questionsRes.count || 0,
      flashcards: flashRes.count || 0,
      vignettes: vigRes.count || 0,
      users: usersRes.count || 0,
      subscriptions: subsRes.count || 0,
      pendingReview: pendingRes.count || 0,
    });
    setLoading(false);
  }

  const statCards = [
    { label: 'Total Questions', value: stats.questions, icon: HelpCircle, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-950', href: '/admin/questions' },
    { label: 'Flashcards', value: stats.flashcards, icon: Layers, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-950', href: '/admin/flashcards' },
    { label: 'Vignettes', value: stats.vignettes, icon: MessageSquare, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-950', href: '/admin/vignettes' },
    { label: 'Registered Users', value: stats.users, icon: Users, color: 'text-cyan-600', bg: 'bg-cyan-100 dark:bg-cyan-950', href: '/admin/users' },
    { label: 'Active Subscriptions', value: stats.subscriptions, icon: TrendingUp, color: 'text-rose-600', bg: 'bg-rose-100 dark:bg-rose-950', href: '/admin/users' },
    { label: 'Pending Review', value: stats.pendingReview, icon: BookOpen, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-950', href: '/admin/questions' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Overview</h1>
          <p className="text-muted-foreground mt-1">Platform health and content statistics</p>
        </div>
        <Button asChild>
          <Link href="/admin/generate">Generate AI Content</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href}>
              <Card className="border-border hover:border-primary/30 hover:shadow-card-hover transition-all cursor-pointer">
                <CardContent className="p-5">
                  <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
                    <Icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                  <div className="text-2xl font-bold text-foreground">{loading ? '--' : stat.value.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                  {stat.label === 'Pending Review' && stats.pendingReview > 0 && (
                    <Badge className="mt-2 bg-orange-100 text-orange-700 border-orange-300 text-xs">
                      Needs attention
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: 'Manage Questions', href: '/admin/questions', desc: 'Review, edit and publish questions' },
              { label: 'Generate AI Content', href: '/admin/generate', desc: 'Use AI to create new questions' },
              { label: 'Manage Flashcards', href: '/admin/flashcards', desc: 'Add and edit flashcard content' },
              { label: 'Manage Vignettes', href: '/admin/vignettes', desc: 'Manage clinical case scenarios' },
            ].map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors group"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{action.label}</p>
                  <p className="text-xs text-muted-foreground">{action.desc}</p>
                </div>
                <span className="text-muted-foreground group-hover:text-foreground transition-colors">→</span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Content Guidelines</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>• AI-generated content starts with <code className="bg-secondary px-1 rounded">reviewed: false</code></p>
              <p>• Review and approve each question before publishing</p>
              <p>• Set <code className="bg-secondary px-1 rounded">active: true</code> to make content available to students</p>
              <p>• All content must include English — Spanish and French are optional</p>
              <p>• Verify clinical accuracy before approving any question</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
