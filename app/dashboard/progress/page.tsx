'use client';

import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Target, Clock, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Score, PracticeSession, ExamTrack } from '@/types/database';

interface SessionWithTrack extends PracticeSession {
  exam_track?: ExamTrack;
  exam?: ExamTrack;
}

interface ScoreWithTrack extends Score {
  exam_track?: ExamTrack;
  exam?: ExamTrack;
}

export default function ProgressPage() {
  const { profile } = useAuth();
  const [scores, setScores] = useState<ScoreWithTrack[]>([]);
  const [sessions, setSessions] = useState<SessionWithTrack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) loadData();
  }, [profile]);

  async function loadData() {
    const [scoresRes, sessionsRes] = await Promise.all([
      supabase
        .from('scores')
        .select('*, exam_track:exam_tracks(*)')
        .eq('user_id', profile!.id)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('practice_sessions')
        .select('*, exam_track:exam_tracks(*)')
        .eq('user_id', profile!.id)
        .order('started_at', { ascending: false })
        .limit(20),
    ]);

    setScores((scoresRes.data as ScoreWithTrack[]) || []);
    setSessions((sessionsRes.data as SessionWithTrack[]) || []);
    setLoading(false);
  }

  const completedSessions = sessions.filter(s => s.completed);
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((acc, s) => acc + s.score, 0) / scores.length)
    : 0;

  // Chart data — last 10 scores
  const chartData = scores.slice(0, 10).reverse().map((s, i) => ({
    name: `#${i + 1}`,
    score: Math.round(s.score),
    exam: s.exam_track?.name?.split(' ')[0] || s.exam?.name?.split(' ')[0] || 'Exam',
  }));

  // Per-track stats
  const trackStats: Record<string, { name: string; scores: number[]; sessions: number }> = {};
  scores.forEach((s) => {
    const trackId = s.exam_track_id || s.exam_id || 'unknown';
    if (!trackStats[trackId]) {
      trackStats[trackId] = { name: s.exam_track?.name || s.exam?.name || 'Unknown', scores: [], sessions: 0 };
    }
    trackStats[trackId].scores.push(s.score);
  });
  completedSessions.forEach((s) => {
    const trackId = s.exam_track_id || s.exam_id || 'unknown';
    if (trackStats[trackId]) {
      trackStats[trackId].sessions++;
    }
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Progress & Analytics</h1>
        <p className="text-muted-foreground mt-1">Track your performance across all exams</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Sessions Done', value: completedSessions.length, icon: Trophy, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-950' },
          { label: 'Total Questions', value: scores.length * 100, icon: BarChart3, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-950' },
          { label: 'Average Score', value: `${avgScore}%`, icon: Target, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-950' },
          { label: 'Study Streak', value: '5 days', icon: TrendingUp, color: 'text-rose-600', bg: 'bg-rose-100 dark:bg-rose-950' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="border-border">
              <CardContent className="p-5">
                <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <div className="text-2xl font-bold text-foreground">{loading ? '--' : stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Score trend chart */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Score Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`${value}%`, 'Score']}
                  />
                  <Bar dataKey="score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                Complete sessions to see your score trend
              </div>
            )}
          </CardContent>
        </Card>

        {/* Per-exam breakdown */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">By Exam</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(trackStats).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(trackStats).map(([id, data]) => {
                  const avg = Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length);
                  return (
                    <div key={id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-foreground truncate max-w-[60%]">
                          {data.name}
                        </span>
                        <span className="text-sm font-bold text-foreground">{avg}%</span>
                      </div>
                      <Progress value={avg} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">
                        {data.sessions} sessions · {data.scores.length} score records
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground text-sm">
                No exam data yet. Start practicing!
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent sessions */}
        <Card className="border-border lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            {sessions.length > 0 ? (
              <div className="space-y-2">
                {sessions.slice(0, 8).map((session) => (
                  <div key={session.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${session.completed ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {session.exam_track?.name || session.exam?.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {session.mode.toUpperCase()} · {new Date(session.started_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      {session.score_percent !== null && (
                        <span className="text-sm font-bold text-foreground">
                          {Math.round(session.score_percent)}%
                        </span>
                      )}
                      <Badge variant={session.completed ? 'secondary' : 'outline'} className="text-xs">
                        {session.completed ? 'Done' : 'In Progress'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground text-sm py-6">
                No sessions yet. Start a practice session from the dashboard.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
