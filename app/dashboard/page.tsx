'use client';

import { useCallback, useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpen, Layers, MessageSquare, BarChart3, Clock, TrendingUp,
  ArrowRight, Plus, Trophy, Target, Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { getActiveTrackAccess, type ActiveTrackAccess } from '@/lib/access';
import type { ExamTrack, PracticeSession, Score } from '@/types/database';

interface SessionWithTrack extends PracticeSession {
  exam_track?: ExamTrack;
  exam?: ExamTrack;
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const [trackAccess, setTrackAccess] = useState<ActiveTrackAccess[]>([]);
  const [recentSessions, setRecentSessions] = useState<SessionWithTrack[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      return;
    }

    const [accessRes, sessionsRes, scoresRes] = await Promise.all([
      getActiveTrackAccess(profile.id),
      supabase
        .from('practice_sessions')
        .select('*, exam_track:exam_tracks(*)')
        .eq('user_id', profile.id)
        .order('started_at', { ascending: false })
        .limit(5),
      supabase
        .from('scores')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    setTrackAccess(accessRes.data);
    setRecentSessions((sessionsRes.data as SessionWithTrack[]) || []);
    setScores(scoresRes.data || []);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((acc, s) => acc + s.score, 0) / scores.length)
    : 0;

  const incompleteSessions = recentSessions.filter(s => !s.completed);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">
          {greeting()}, {profile?.full_name?.split(' ')[0] || 'there'}!
        </h1>
        <p className="text-muted-foreground mt-1">
          {trackAccess.length > 0
            ? `You have ${trackAccess.length} active exam track${trackAccess.length > 1 ? 's' : ''}. Keep up the great work!`
            : 'Subscribe to an exam to start practicing.'}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: 'Active Exams',
            value: trackAccess.length,
            icon: BookOpen,
            color: 'text-blue-600',
            bg: 'bg-blue-100 dark:bg-blue-950',
          },
          {
            label: 'Sessions Completed',
            value: recentSessions.filter(s => s.completed).length,
            icon: Trophy,
            color: 'text-emerald-600',
            bg: 'bg-emerald-100 dark:bg-emerald-950',
          },
          {
            label: 'Avg. Score',
            value: avgScore ? `${avgScore}%` : '--',
            icon: Target,
            color: 'text-amber-600',
            bg: 'bg-amber-100 dark:bg-amber-950',
          },
          {
            label: 'In Progress',
            value: incompleteSessions.length,
            icon: Zap,
            color: 'text-rose-600',
            bg: 'bg-rose-100 dark:bg-rose-950',
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                </div>
                <div className="text-2xl font-bold text-foreground">{loading ? '--' : stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Active subscriptions */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Your Exams</h2>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/subscriptions">
                <Plus className="w-4 h-4 mr-1.5" />
                Add Exam
              </Link>
            </Button>
          </div>

          {trackAccess.length === 0 ? (
            <Card className="border-dashed border-2 border-border">
              <CardContent className="py-12 text-center">
                <BookOpen className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
                <h3 className="font-semibold text-foreground mb-2">No active subscriptions</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Subscribe to an exam to start practicing with thousands of questions.
                </p>
                <Button asChild>
                  <Link href="/dashboard/subscriptions">Browse Exams</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {trackAccess.map((access) => (
                <Card key={access.id} className="border-border hover:border-primary/30 hover:shadow-card-hover transition-all">
                  <CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                      <div>
                        <h3 className="font-semibold text-foreground">{access.exam_track.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950 border-emerald-200">
                            Active
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            ${access.exam_track.monthly_price}/mo
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button size="sm" asChild>
                        <Link href={`/dashboard/practice/mcq?exam=${access.exam_track_id}`}>
                          <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                          Practice MCQ
                        </Link>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/dashboard/practice/flashcards?exam=${access.exam_track_id}`}>
                          <Layers className="w-3.5 h-3.5 mr-1.5" />
                          Flashcards
                        </Link>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/dashboard/practice/vignettes?exam=${access.exam_track_id}`}>
                          <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                          Vignettes
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Recent sessions + scores */}
        <div className="space-y-6">
          {/* Recent sessions */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Recent Sessions</h2>
            {recentSessions.length === 0 ? (
              <Card className="border-border">
                <CardContent className="py-8 text-center">
                  <Clock className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No sessions yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {recentSessions.slice(0, 4).map((session) => (
                  <div key={session.id} className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${session.completed ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {(session as SessionWithTrack).exam_track?.name || 'Unknown'}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {session.mode} • {session.completed ? 'Done' : 'In progress'}
                        </p>
                      </div>
                    </div>
                    {session.score_percent !== null && (
                      <span className="text-sm font-semibold text-foreground flex-shrink-0 ml-2">
                        {Math.round(session.score_percent)}%
                      </span>
                    )}
                    {!session.completed && (
                      <Button size="sm" variant="ghost" asChild className="ml-2 flex-shrink-0">
                        <Link href={`/dashboard/practice/${session.mode}?session=${session.id}`}>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick stats */}
          {scores.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Score History</h2>
              <Card className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-muted-foreground">Average Score</span>
                    <span className="text-2xl font-bold text-foreground">{avgScore}%</span>
                  </div>
                  <Progress value={avgScore} className="h-2 mb-3" />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                    Based on {scores.length} completed session{scores.length > 1 ? 's' : ''}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
