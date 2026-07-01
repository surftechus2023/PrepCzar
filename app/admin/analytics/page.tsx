'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, Loader2, Search, Target, Users } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
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
        <h1 className="text-2xl font-bold text-foreground">Student Analytics</h1>
        <p className="text-muted-foreground text-sm">
          Track student exam access, attempts, score trends, pass readiness, and weak-area diagnosis.
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
    </div>
  );
}
