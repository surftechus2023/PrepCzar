'use client';

import { useCallback, useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Target, Clock, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { authenticatedFetch } from '@/lib/api';
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

interface PerformanceSlice {
  label: string;
  attempts: number;
  score: number;
  averageResponseTimeSeconds: number | null;
}

interface ProgressDiagnostics {
  completionRate: number;
  averageResponseTimeSeconds: number | null;
  domainPerformance: PerformanceSlice[];
  competencyPerformance: PerformanceSlice[];
  difficultyPerformance: PerformanceSlice[];
  cognitiveLevelPerformance: PerformanceSlice[];
  weakAreas: PerformanceSlice[];
  strengths: PerformanceSlice[];
}

export default function ProgressPage() {
  const { profile } = useAuth();
  const [scores, setScores] = useState<ScoreWithTrack[]>([]);
  const [sessions, setSessions] = useState<SessionWithTrack[]>([]);
  const [diagnostics, setDiagnostics] = useState<ProgressDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!profile) return;

    const res = await authenticatedFetch('/api/dashboard/progress?scoreLimit=30&sessionLimit=20');
    const json = await res.json();

    setScores(res.ok ? (json.scores as ScoreWithTrack[]) || [] : []);
    setSessions(res.ok ? (json.sessions as SessionWithTrack[]) || [] : []);
    setDiagnostics(res.ok ? json.diagnostics || null : null);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    if (profile) loadData();
  }, [loadData, profile]);

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
          { label: 'Completion Rate', value: `${diagnostics?.completionRate || 0}%`, icon: BarChart3, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-950' },
          { label: 'Average Score', value: `${avgScore}%`, icon: Target, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-950' },
          { label: 'Avg Response Time', value: diagnostics?.averageResponseTimeSeconds ? `${diagnostics.averageResponseTimeSeconds}s` : '--', icon: Clock, color: 'text-rose-600', bg: 'bg-rose-100 dark:bg-rose-950' },
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

        <PerformanceCard title="Domain Performance" items={diagnostics?.domainPerformance || []} empty="Answer MCQs to see domain performance." />
        <PerformanceCard title="Competency Performance" items={diagnostics?.competencyPerformance || []} empty="Answer MCQs to see competency performance." />
        <PerformanceCard title="Difficulty Performance" items={diagnostics?.difficultyPerformance || []} empty="Answer MCQs to see difficulty performance." />
        <PerformanceCard title="Cognitive-Level Performance" items={diagnostics?.cognitiveLevelPerformance || []} empty="Answer MCQs to see cognitive-level performance." />

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Weak Areas</CardTitle>
          </CardHeader>
          <CardContent>
            {(diagnostics?.weakAreas || []).length > 0 ? (
              <div className="space-y-2">
                {diagnostics!.weakAreas.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground truncate">{item.label}</span>
                    <Badge variant="destructive">{item.score}%</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No reliable weak areas yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Strengths</CardTitle>
          </CardHeader>
          <CardContent>
            {(diagnostics?.strengths || []).length > 0 ? (
              <div className="space-y-2">
                {diagnostics!.strengths.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground truncate">{item.label}</span>
                    <Badge>{item.score}%</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Strengths appear after more response data is available.</p>
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

function PerformanceCard({ title, items, empty }: { title: string; items: PerformanceSlice[]; empty: string }) {
  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length > 0 ? (
          <div className="space-y-4">
            {items.slice(0, 6).map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-foreground truncate max-w-[65%]">{item.label}</span>
                  <span className="text-sm font-bold text-foreground">{item.score}%</span>
                </div>
                <Progress value={item.score} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {item.attempts} attempts{item.averageResponseTimeSeconds ? ` · ${item.averageResponseTimeSeconds}s avg` : ''}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">{empty}</p>
        )}
      </CardContent>
    </Card>
  );
}
