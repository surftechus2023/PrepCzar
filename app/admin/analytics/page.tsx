'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, Download, Loader2, Search, ShieldAlert, Target, Users } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type AnalyticsRow = {
  userId: string;
  studentName: string;
  email: string;
  trackId: string | null;
  trackName: string;
  accessActive: boolean;
  attempts: number;
  completedAttempts: number;
  averageScore: number | null;
  bestScore: number | null;
  passStatus: string;
  diagnosis: string;
  lastActivity: string | null;
};

type AnalyticsData = {
  summary: {
    students: number;
    activeEnrollments: number;
    totalAttempts: number;
    averageScore: number | null;
  };
  rows: AnalyticsRow[];
  contentAnalytics: {
    byTrack: Array<{
      trackId: string;
      trackName: string;
      activeQuestions: number;
      totalQuestions: number;
      reviewed: number;
      pending: number;
      integrityPassRate: number | null;
      averageAlignmentScore: number | null;
      averageDifficultyQualityScore: number | null;
      autoImprovementSuccessRate: number | null;
      rejectedItemCount: number;
    }>;
    coverage: Array<{
      trackName: string;
      topicName: string;
      blueprintWeightPercent: number | null;
      activeQuestionCount: number;
      contentSharePercent: number | null;
      coverageDeltaPercent: number | null;
    }>;
  };
  itemAnalytics: Array<{
    questionId: string;
    trackName: string;
    topicName: string;
    attempts: number;
    percentCorrect: number | null;
    averageResponseTimeSeconds: number | null;
    reliabilityNote: string;
  }>;
  subscriptionSummary: {
    activeSubscriptions: number;
    trialingSubscriptions: number;
    estimatedMonthlyRevenue: number;
  };
  fairnessNotice: string;
};

function formatScore(score: number | null) {
  return score === null ? '—' : `${score}%`;
}

function formatDate(date: string | null) {
  if (!date) return 'No activity';
  return new Date(date).toLocaleDateString();
}

function statusVariant(status: string) {
  if (status === 'Likely pass') return 'default';
  if (status === 'Needs support') return 'destructive';
  return 'secondary';
}

function exportUrl(type: string) {
  return `/api/admin/analytics?export=${type}`;
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    const res = await authenticatedFetch('/api/admin/analytics');
    const payload = await res.json();

    if (!res.ok) {
      toast({ title: 'Could not load analytics', description: payload.error, variant: 'destructive' });
      setLoading(false);
      return;
    }

    setData(payload);
    setLoading(false);
  }

  const filteredRows = useMemo(() => {
    const rows = data?.rows || [];
    const query = search.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((row) => (
      row.studentName.toLowerCase().includes(query) ||
      row.email.toLowerCase().includes(query) ||
      row.trackName.toLowerCase().includes(query) ||
      row.passStatus.toLowerCase().includes(query)
    ));
  }, [data, search]);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const summary = data?.summary || {
    students: 0,
    activeEnrollments: 0,
    totalAttempts: 0,
    averageScore: null,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Analytics & Reporting</h1>
        <p className="text-muted-foreground text-sm">
          Track student performance, content coverage, item behavior, review quality, and exports.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Students', value: summary.students, icon: Users },
          { label: 'Active Enrollments', value: summary.activeEnrollments, icon: Target },
          { label: 'Practice Attempts', value: summary.totalAttempts, icon: Activity },
          { label: 'Average Score', value: formatScore(summary.averageScore), icon: BarChart3 },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="border-border">
              <CardContent className="p-5">
                <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center mb-3">
                  <Icon className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {[
          ['content_inventory', 'Content Inventory'],
          ['blueprint_coverage', 'Blueprint Coverage'],
          ['question_quality', 'Question Quality'],
          ['item_performance', 'Item Performance'],
          ['subscription_revenue', 'Subscription Revenue'],
        ].map(([type, label]) => (
          <Button key={type} variant="outline" size="sm" asChild>
            <a href={exportUrl(type)}>
              <Download className="w-4 h-4 mr-2" />
              {label} CSV
            </a>
          </Button>
        ))}
      </div>

      <Card className="border-border">
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-base">Exam Progress</CardTitle>
            <div className="relative md:w-80">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search student, exam, or status..."
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Exam Track</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Avg / Best</TableHead>
                <TableHead>Readiness</TableHead>
                <TableHead>Diagnosis</TableHead>
                <TableHead>Last Activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow key={`${row.userId}-${row.trackId || 'none'}`}>
                  <TableCell>
                    <div className="font-medium text-foreground">{row.studentName}</div>
                    <div className="text-xs text-muted-foreground">{row.email}</div>
                  </TableCell>
                  <TableCell>{row.trackName}</TableCell>
                  <TableCell>
                    <Badge variant={row.accessActive ? 'default' : 'secondary'}>
                      {row.accessActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.completedAttempts}/{row.attempts}</TableCell>
                  <TableCell>{formatScore(row.averageScore)} / {formatScore(row.bestScore)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(row.passStatus)}>{row.passStatus}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[220px] text-sm text-muted-foreground">{row.diagnosis}</TableCell>
                  <TableCell>{formatDate(row.lastActivity)}</TableCell>
                </TableRow>
              ))}
              {filteredRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    No student analytics match this search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <Card className="border-border lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Admin Content Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exam Track</TableHead>
                  <TableHead>Active / Total</TableHead>
                  <TableHead>Reviewed / Pending</TableHead>
                  <TableHead>Pass Rate</TableHead>
                  <TableHead>Avg Alignment</TableHead>
                  <TableHead>Avg Difficulty Quality</TableHead>
                  <TableHead>Auto-Improve Success</TableHead>
                  <TableHead>Rejected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.contentAnalytics.byTrack || []).map((row) => (
                  <TableRow key={row.trackId}>
                    <TableCell>{row.trackName}</TableCell>
                    <TableCell>{row.activeQuestions}/{row.totalQuestions}</TableCell>
                    <TableCell>{row.reviewed}/{row.pending}</TableCell>
                    <TableCell>{formatScore(row.integrityPassRate)}</TableCell>
                    <TableCell>{formatScore(row.averageAlignmentScore)}</TableCell>
                    <TableCell>{formatScore(row.averageDifficultyQualityScore)}</TableCell>
                    <TableCell>{formatScore(row.autoImprovementSuccessRate)}</TableCell>
                    <TableCell>{row.rejectedItemCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Blueprint Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {(data?.contentAnalytics.coverage || []).slice(0, 20).map((row) => (
                <div key={`${row.trackName}-${row.topicName}`} className="border-b border-border pb-3 last:border-b-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{row.topicName}</p>
                      <p className="text-xs text-muted-foreground">{row.trackName}</p>
                    </div>
                    <Badge variant="secondary">{row.activeQuestionCount} active</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Blueprint: {row.blueprintWeightPercent ?? 'N/A'}% · Content: {row.contentSharePercent ?? 'N/A'}% · Delta: {row.coverageDeltaPercent ?? 'N/A'}%
                  </p>
                </div>
              ))}
              {(data?.contentAnalytics.coverage || []).length === 0 && (
                <p className="text-sm text-muted-foreground">No blueprint coverage data yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Item Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {(data?.itemAnalytics || []).slice(0, 20).map((item) => (
                <div key={item.questionId} className="border-b border-border pb-3 last:border-b-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground truncate">{item.topicName}</p>
                    <Badge variant={item.attempts >= 30 ? 'default' : 'secondary'}>{item.attempts} attempts</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Correct: {formatScore(item.percentCorrect)} · Avg time: {item.averageResponseTimeSeconds ? `${item.averageResponseTimeSeconds}s` : 'N/A'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{item.reliabilityNote}</p>
                </div>
              ))}
              {(data?.itemAnalytics || []).length === 0 && (
                <p className="text-sm text-muted-foreground">Insufficient response data for reliable item statistics.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border lg:col-span-2">
          <CardContent className="p-5 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Fairness and DIF Foundation</p>
              <p className="text-sm text-muted-foreground mt-1">
                {data?.fairnessNotice || 'DIF infrastructure is preparatory only. Do not infer sensitive demographic characteristics or treat AI-only bias review as formal psychometric validation.'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
