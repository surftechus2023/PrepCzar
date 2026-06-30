'use client';

import { useState, useEffect } from 'react';
import {
  Search, CheckCircle, XCircle, Eye, Trash2, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTrack, setFilterTrack] = useState('');
  const [filterReviewed, setFilterReviewed] = useState('all');
  const [selectedQ, setSelectedQ] = useState<QuestionWithMeta | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [qRes, tracksRes] = await Promise.all([
      supabase
        .from('questions')
        .select('*, exam_track:exam_tracks(name, slug), topic:topics(title)')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('exam_tracks').select('*').order('name'),
    ]);

    setQuestions((qRes.data as QuestionWithMeta[]) || []);
    setTracks(tracksRes.data || []);
    setLoading(false);
  }

  async function toggleActive(q: QuestionWithMeta) {
    await (supabase as any).from('questions').update({ active: !q.active }).eq('id', q.id);
    setQuestions(questions.map(item => item.id === q.id ? { ...item, active: !item.active } : item));
  }

  async function toggleReviewed(q: QuestionWithMeta) {
    await (supabase as any).from('questions').update({ reviewed: !q.reviewed }).eq('id', q.id);
    setQuestions(questions.map(item => item.id === q.id ? { ...item, reviewed: !item.reviewed } : item));
  }

  async function deleteQuestion(id: string) {
    if (!confirm('Delete this question?')) return;
    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setQuestions(questions.filter(q => q.id !== id));
      toast({ title: 'Deleted', description: 'Question deleted.' });
    }
  }

  const filtered = questions.filter(q => {
    const matchSearch = !search || q.question_en.toLowerCase().includes(search.toLowerCase());
    const matchTrack = !filterTrack || q.exam_track_id === filterTrack;
    const matchReviewed = filterReviewed === 'all' ||
      (filterReviewed === 'reviewed' && q.reviewed) ||
      (filterReviewed === 'pending' && !q.reviewed);
    return matchSearch && matchTrack && matchReviewed;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Questions</h1>
          <p className="text-muted-foreground text-sm">{questions.length} total questions</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-48">
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
          onChange={(e) => setFilterTrack(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All Tracks</option>
          {tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
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

      {loading ? (
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
                  <div className="flex items-start gap-4">
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
                      <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setSelectedQ(q)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8"
                        onClick={() => toggleReviewed(q)}
                        title={q.reviewed ? 'Mark as unreviewed' : 'Mark as reviewed'}
                      >
                        {q.reviewed ? <XCircle className="w-3.5 h-3.5 text-amber-500" /> : <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8"
                        onClick={() => toggleActive(q)}
                        title={q.active ? 'Deactivate' : 'Activate'}
                      >
                        {q.active ? (
                          <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 block" />
                        ) : (
                          <span className="w-3.5 h-3.5 rounded-full bg-slate-300 block" />
                        )}
                      </Button>
                      <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive" onClick={() => deleteQuestion(q.id)}>
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
              <div className="grid grid-cols-2 gap-3">
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
              <div className="flex gap-2">
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
