'use client';

import { useState, useEffect } from 'react';
import {
  Search, CheckCircle, XCircle, Eye, Trash2, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { authenticatedFetch } from '@/lib/api';
import type { Question, ExamTrack, Topic } from '@/types/database';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface QuestionWithMeta extends Question {
  exam_track?: ExamTrack;
  topic?: Topic;
}

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<QuestionWithMeta[]>([]);
  const [tracks, setTracks] = useState<ExamTrack[]>([]);
  const [topics, setTopics] = useState<Pick<Topic, 'id' | 'exam_track_id' | 'title'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTrack, setFilterTrack] = useState('');
  const [filterTopic, setFilterTopic] = useState('');
  const [filterReviewed, setFilterReviewed] = useState('all');
  const [selectedQ, setSelectedQ] = useState<QuestionWithMeta | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData(1);
  }, []);

  async function loadData(nextPage = 1) {
    setLoading(true);
    const res = await authenticatedFetch(`/api/admin/questions?page=${nextPage}&limit=50`);
    const data = await res.json();

    if (!res.ok) {
      toast({ title: 'Could not load questions', description: data.error, variant: 'destructive' });
      setLoading(false);
      return;
    }

    const nextQuestions = (data.questions as QuestionWithMeta[]) || [];
    setQuestions((current) => (nextPage === 1 ? nextQuestions : [...current, ...nextQuestions]));
    setTracks(data.tracks || []);
    setTopics(data.topics || []);
    setPage(nextPage);
    setHasMore(Boolean(data.pagination?.hasMore));
    setLoading(false);
  }

  async function updateQuestion(id: string, values: Partial<Question>) {
    const res = await authenticatedFetch('/api/admin/questions', {
      method: 'PATCH',
      body: JSON.stringify({ id, values }),
    });
    const data = await res.json();

    if (!res.ok) {
      toast({ title: 'Update failed', description: data.error, variant: 'destructive' });
      return null;
    }

    return data.question as QuestionWithMeta;
  }

  async function toggleActive(q: QuestionWithMeta) {
    const updated = await updateQuestion(q.id, { active: !q.active });
    if (updated) setQuestions(questions.map(item => item.id === q.id ? updated : item));
  }

  async function toggleReviewed(q: QuestionWithMeta) {
    const updated = await updateQuestion(q.id, { reviewed: !q.reviewed });
    if (updated) setQuestions(questions.map(item => item.id === q.id ? updated : item));
  }

  async function deleteQuestion(id: string) {
    if (!confirm('Delete this question?')) return;
    const res = await authenticatedFetch(`/api/admin/questions?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      toast({ title: 'Error', description: data.error, variant: 'destructive' });
    } else {
      setQuestions(questions.filter(q => q.id !== id));
      toast({ title: 'Deleted', description: 'Question deleted.' });
    }
  }

  const filtered = questions.filter(q => {
    const matchSearch = !search || q.question_en.toLowerCase().includes(search.toLowerCase());
    const matchTrack = !filterTrack || q.exam_track_id === filterTrack;
    const matchTopic = !filterTopic || q.topic_id === filterTopic;
    const matchReviewed = filterReviewed === 'all' ||
      (filterReviewed === 'reviewed' && q.reviewed) ||
      (filterReviewed === 'pending' && !q.reviewed);
    return matchSearch && matchTrack && matchTopic && matchReviewed;
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Questions</h1>
          <p className="text-muted-foreground text-sm">{questions.length} total questions</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:flex-wrap">
        <div className="relative flex-1 min-w-0 sm:min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search questions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={filterTrack}
          onChange={(e) => { setFilterTrack(e.target.value); setFilterTopic(''); }}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All Tracks</option>
          {tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select
          value={filterTopic}
          onChange={(e) => setFilterTopic(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All Exam Topics</option>
          {topics
            .filter((topic) => !filterTrack || topic.exam_track_id === filterTrack)
            .map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
        </select>
        <select
          value={filterReviewed}
          onChange={(e) => setFilterReviewed(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">All</option>
          <option value="reviewed">Reviewed</option>
          <option value="pending">Pending Review</option>
        </select>
      </div>

      {loading && questions.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No questions found</p>
          ) : (
            filtered.map((q) => (
              <Card key={q.id} className="border-border hover:border-primary/20 transition-colors">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-2 mb-2">
                        <Badge variant="secondary" className="text-xs">{(q.exam_track as any)?.name || 'Unknown'}</Badge>
                        {(q.topic as any)?.title && <Badge variant="outline" className="text-xs">{(q.topic as any).title}</Badge>}
                        <Badge variant="outline" className="text-xs capitalize">{q.difficulty}</Badge>
                        {q.reviewed ? (
                          <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-300">Reviewed</Badge>
                        ) : (
                          <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-300">Pending Review</Badge>
                        )}
                        {q.active ? (
                          <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-300">Active</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Inactive</Badge>
                        )}
                      </div>
                      <p className="text-sm text-foreground line-clamp-2">{q.question_en}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setSelectedQ(q)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10"
                        onClick={() => toggleReviewed(q)}
                        title={q.reviewed ? 'Mark as unreviewed' : 'Mark as reviewed'}
                      >
                        {q.reviewed ? <XCircle className="w-3.5 h-3.5 text-amber-500" /> : <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10"
                        onClick={() => toggleActive(q)}
                        title={q.active ? 'Deactivate' : 'Activate'}
                      >
                        {q.active ? (
                          <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 block" />
                        ) : (
                          <span className="w-3.5 h-3.5 rounded-full bg-slate-300 block" />
                        )}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive" onClick={() => deleteQuestion(q.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {!loading && hasMore && (
        <div className="flex justify-center pt-6">
          <Button variant="outline" onClick={() => loadData(page + 1)}>
            Load More Questions
          </Button>
        </div>
      )}

      <Dialog open={!!selectedQ} onOpenChange={() => setSelectedQ(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Question Preview</DialogTitle>
          </DialogHeader>
          {selectedQ && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Question (EN)</p>
                <p className="text-foreground">{selectedQ.question_en}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {(['a', 'b', 'c', 'd'] as const).map(opt => (
                  <div key={opt} className={`p-3 rounded-lg border text-sm ${selectedQ.correct_option === opt ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950' : 'border-border'}`}>
                    <span className="font-bold mr-2">{opt.toUpperCase()}.</span>
                    {(selectedQ as any)[`option_${opt}_en`]}
                    {selectedQ.correct_option === opt && <CheckCircle className="inline w-3.5 h-3.5 ml-1 text-emerald-600" />}
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Rationale</p>
                <p className="text-sm text-muted-foreground">{selectedQ.rationale_en}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  size="sm"
                  variant={selectedQ.reviewed ? 'outline' : 'default'}
                  onClick={() => { toggleReviewed(selectedQ); setSelectedQ({ ...selectedQ, reviewed: !selectedQ.reviewed }); }}
                >
                  {selectedQ.reviewed ? 'Mark Unreviewed' : 'Mark Reviewed'}
                </Button>
                <Button
                  size="sm"
                  variant={selectedQ.active ? 'outline' : 'default'}
                  onClick={() => { toggleActive(selectedQ); setSelectedQ({ ...selectedQ, active: !selectedQ.active }); }}
                >
                  {selectedQ.active ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
