'use client';

import { useCallback, useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CreditCard, CheckCircle, Brain, Heart, MessageSquare, ClipboardList,
  Stethoscope, Loader2, ExternalLink, AlertCircle, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { authenticatedFetch } from '@/lib/api';
import type { ExamCategory, ExamTrack, Subscription } from '@/types/database';

const categoryIcons: Record<string, React.ElementType> = {
  'psychology': Brain,
  'social-work': Heart,
  'counseling': MessageSquare,
  'case-management': ClipboardList,
  'nursing': Stethoscope,
};

const examFeatures = [
  '1,000+ practice questions',
  'Detailed answer rationales',
  'Flashcard review system',
  'Clinical case vignettes',
  'Voice practice mode',
  'Progress analytics',
  'Multilingual (EN/ES/FR)',
];

interface TrackWithSub extends ExamTrack {
  subscription?: Subscription;
}

interface CategoryWithTracks extends ExamCategory {
  tracks: TrackWithSub[];
}

export default function SubscriptionsPage() {
  const { profile, loading: authLoading } = useAuth();
  const [categories, setCategories] = useState<CategoryWithTracks[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    if (authLoading) return;
    if (!profile) {
      setLoading(false);
      return;
    }

    const res = await authenticatedFetch('/api/dashboard/subscriptions');
    const json = await res.json();

    if (!res.ok) {
      toast({
        title: 'Could not load subscriptions',
        description: json.error || 'Please refresh the page.',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    const cats = (json.categories || []) as ExamCategory[];
    const tracks = (json.tracks || []) as ExamTrack[];
    const subs = (json.subscriptions || []) as Subscription[];

    const tracksByCat: Record<string, TrackWithSub[]> = {};
    tracks.forEach(track => {
      if (!tracksByCat[track.category_id]) tracksByCat[track.category_id] = [];
      tracksByCat[track.category_id].push({
        ...track,
        subscription: subs.find(s => s.exam_track_id === track.id),
      });
    });

    setCategories(cats.map(c => ({ ...c, tracks: tracksByCat[c.id] || [] })));
    setLoading(false);
  }, [authLoading, profile, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSubscribe(track: TrackWithSub) {
    setCheckingOut(track.id);

    try {
      const response = await authenticatedFetch('/api/stripe/checkout', {
        method: 'POST',
        body: JSON.stringify({
          examTrackId: track.id,
        }),
      });

      const { url, error } = await response.json();

      if (error) throw new Error(error);
      if (url) window.location.href = url;
    } catch (err: any) {
      toast({
        title: 'Checkout failed',
        description: err.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setCheckingOut(null);
    }
  }

  async function handleManageBilling() {
    try {
      const response = await authenticatedFetch('/api/stripe/portal', {
        method: 'POST',
      });
      const { url, error } = await response.json();
      if (error) throw new Error(error);
      if (url) window.location.href = url;
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }

  const hasStripeCustomer = categories
    .flatMap(c => c.tracks)
    .some(t => t.subscription?.stripe_customer_id);
  const activeTracks = categories
    .flatMap(c => c.tracks)
    .filter(t => t.subscription?.status === 'active');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Exam Subscriptions</h1>
        <p className="text-muted-foreground mt-1">
          Subscribe to individual exam tracks. Each track has its own dedicated question bank.
        </p>
      </div>

      {hasStripeCustomer && (
        <div className="flex items-center gap-3 p-4 bg-secondary rounded-lg border border-border mb-8">
          <CreditCard className="w-5 h-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Manage billing</p>
            <p className="text-xs text-muted-foreground">Update payment method or cancel subscriptions</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleManageBilling}>
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            Billing Portal
          </Button>
        </div>
      )}

      {activeTracks.length > 0 && (
        <div className="mb-8 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-950/30">
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-3">
            Your current subscription{activeTracks.length > 1 ? 's' : ''}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {activeTracks.map((track) => (
              <div key={track.id} className="rounded-lg border border-emerald-200 bg-white p-4 dark:border-emerald-800 dark:bg-slate-950">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-foreground">{track.name}</h2>
                    <p className="text-sm text-muted-foreground">{track.full_name}</p>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400">
                    <CheckCircle className="w-3 h-3 mr-1" />Active
                  </Badge>
                </div>
                <Button className="mt-4 w-full" asChild>
                  <Link href={`/dashboard/practice/mcq?exam=${track.id}`}>Start Practicing</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-10">
        {categories.map((cat) => {
          if (cat.tracks.length === 0) return null;
          const Icon = categoryIcons[cat.slug] || Brain;

          return (
            <div key={cat.id}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">{cat.name}</h2>
                  <p className="text-sm text-muted-foreground">{cat.description}</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cat.tracks.map((track) => {
                  const isActive = track.subscription?.status === 'active';

                  return (
                    <Card
                      key={track.id}
                      className={`relative border transition-all ${isActive ? 'border-emerald-300 dark:border-emerald-700' : 'border-border hover:border-primary/30 hover:shadow-card-hover'}`}
                    >
                      {isActive && (
                        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500 rounded-t-lg" />
                      )}
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold text-lg text-foreground">{track.name}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">{track.full_name}</p>
                          </div>
                          {isActive ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400">
                              <CheckCircle className="w-3 h-3 mr-1" />Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Available</Badge>
                          )}
                        </div>
                        <div className="flex items-baseline gap-1 mt-2">
                          <span className="text-3xl font-bold text-foreground">${track.monthly_price}</span>
                          <span className="text-muted-foreground text-sm">/month</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{track.description}</p>
                      </CardHeader>

                      <CardContent>
                        <ul className="space-y-1.5 mb-5">
                          {examFeatures.slice(0, 5).map((f) => (
                            <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                              {f}
                            </li>
                          ))}
                        </ul>

                        {isActive ? (
                          <div className="space-y-2">
                            <Button className="w-full" asChild>
                              <Link href={`/dashboard/practice/mcq?exam=${track.id}`}>
                                Start Practicing
                              </Link>
                            </Button>
                            <p className="text-xs text-center text-muted-foreground">
                              Active — manage via billing portal
                            </p>
                          </div>
                        ) : (
                          <Button
                            className="w-full"
                            onClick={() => handleSubscribe(track)}
                            disabled={checkingOut === track.id}
                          >
                            {checkingOut === track.id ? (
                              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading...</>
                            ) : (
                              <>Subscribe — ${track.monthly_price}/mo</>
                            )}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-10 p-4 bg-secondary/50 border border-border rounded-lg flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-foreground">Subscription notes</p>
          <p className="text-sm text-muted-foreground mt-1">
            Each subscription provides access to one specific exam track. An LCSW subscription does not include BSW or MSW content.
            All subscriptions are billed monthly and can be canceled at any time from the billing portal.
            Access continues until the end of the current billing period after cancellation.
          </p>
        </div>
      </div>
    </div>
  );
}
