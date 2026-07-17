'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Users, HelpCircle, Layers, MessageSquare, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { authenticatedFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const response = await authenticatedFetch('/api/admin/stats');
    const data = await response.json();

    if (!response.ok) {
      toast({ title: 'Could not load admin stats', description: data.error, variant: 'destructive' });
      setLoading(false);
      return;
    }

    setStats({
      questions: data.questions || 0,
      flashcards: data.flashcards || 0,
      vignettes: data.vignettes || 0,
      users: data.users || 0,
      subscriptions: data.subscriptions || 0,
      pendingReview: data.pendingReview || 0,
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
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/ai-settings">AI Settings</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/content-import">Import Content</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/generate">Generate Content</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/content-generation">AI Question Generation</Link>
          </Button>
        </div>
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

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: 'AI Question Generation', href: '/admin/content-generation', desc: 'Create blueprint-aware Social Work MCQs' },
              { label: 'Generate Content', href: '/admin/generate', desc: 'Create questions, flashcards and vignettes' },
              { label: 'AI Model Settings', href: '/admin/ai-settings', desc: 'Configure models, provider settings, and AI cost controls' },
              { label: 'Import / Manual Authoring', href: '/admin/content-import', desc: 'Import files, paste text, or manually author drafts' },
              { label: 'Manage Questions', href: '/admin/questions', desc: 'Review, edit and publish questions' },
              { label: 'MCQ Integrity Review', href: '/admin/review-questions', desc: 'Validate, score, flag and publish generated MCQs' },
              { label: 'Review Flashcards', href: '/admin/flashcards', desc: 'Filter, preview, mark reviewed, and activate flashcards' },
              { label: 'Review Vignettes', href: '/admin/vignettes', desc: 'Filter, preview, mark reviewed, and activate case vignettes' },
              { label: 'Student Analytics', href: '/admin/analytics', desc: 'Review attempts, scores and exam readiness' },
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
            <CardTitle className="text-base">Admin Flow</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>• Use Generate Content to create questions, flashcards, and vignettes.</p>
              <p>• Review MCQs in Integrity Review; review flashcards and vignettes in their content pages before students see them.</p>
              <p>• Set <code className="bg-secondary px-1 rounded">active: true</code> and <code className="bg-secondary px-1 rounded">reviewed: true</code> to publish.</p>
              <p>• Exams define categories, tracks, and topics used by generated content.</p>
              <p>• Analytics shows student attempts, scores, readiness, and weak areas.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
