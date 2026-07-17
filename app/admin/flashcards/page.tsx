'use client';

import { useState, useEffect } from 'react';
import { Search, CheckCircle, XCircle, Trash2, Loader2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { authenticatedFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { Flashcard, ExamTrack, Topic } from '@/types/database';

interface FlashcardWithMeta extends Flashcard {
  exam_track?: ExamTrack;
}

export default function AdminFlashcardsPage() {
  const [cards, setCards] = useState<FlashcardWithMeta[]>([]);
  const [tracks, setTracks] = useState<ExamTrack[]>([]);
  const [topics, setTopics] = useState<Pick<Topic, 'id' | 'exam_track_id' | 'title'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTrack, setFilterTrack] = useState('');
  const [filterTopic, setFilterTopic] = useState('');
  const [filterReviewed, setFilterReviewed] = useState('all');
  const [selected, setSelected] = useState<FlashcardWithMeta | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const res = await authenticatedFetch('/api/admin/flashcards');
    const data = await res.json();

    if (!res.ok) {
      toast({ title: 'Could not load flashcards', description: data.error, variant: 'destructive' });
      setLoading(false);
      return;
    }

    setCards((data.flashcards as FlashcardWithMeta[]) || []);
    setTracks(data.tracks || []);
    setTopics(data.topics || []);
    setLoading(false);
  }

  async function updateCard(id: string, values: Partial<Flashcard>) {
    const res = await authenticatedFetch('/api/admin/flashcards', {
      method: 'PATCH',
      body: JSON.stringify({ id, values }),
    });
    const data = await res.json();

    if (!res.ok) {
      toast({ title: 'Update failed', description: data.error, variant: 'destructive' });
      return null;
    }

    return data.flashcard as FlashcardWithMeta;
  }

  function applyUpdatedCard(updated: FlashcardWithMeta) {
    setCards(current => current.map(c => c.id === updated.id ? updated : c));
    setSelected(current => current?.id === updated.id ? updated : current);
  }

  async function toggleActive(card: FlashcardWithMeta) {
    const updated = await updateCard(card.id, { active: !card.active });
    if (updated) applyUpdatedCard(updated);
  }

  async function toggleReviewed(card: FlashcardWithMeta) {
    const updated = await updateCard(card.id, { reviewed: !card.reviewed });
    if (updated) applyUpdatedCard(updated);
  }

  async function deleteCard(id: string) {
    if (!confirm('Delete this flashcard?')) return;
    const res = await authenticatedFetch(`/api/admin/flashcards?id=${id}`, { method: 'DELETE' });
    const data = await res.json();

    if (!res.ok) {
      toast({ title: 'Delete failed', description: data.error, variant: 'destructive' });
      return;
    }

    setCards(cards.filter(c => c.id !== id));
    toast({ title: 'Deleted' });
  }

  const filtered = cards.filter(c => {
    const matchSearch = !search || c.front_en.toLowerCase().includes(search.toLowerCase());
    const matchTrack = !filterTrack || c.exam_track_id === filterTrack;
    const matchTopic = !filterTopic || c.topic_id === filterTopic;
    const matchReviewed = filterReviewed === 'all' ||
      (filterReviewed === 'reviewed' && c.reviewed) ||
      (filterReviewed === 'pending' && !c.reviewed);
    return matchSearch && matchTrack && matchTopic && matchReviewed;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Flashcards</h1>
          <p className="text-muted-foreground text-sm">{cards.length} total flashcards</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search flashcards..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select value={filterTrack} onChange={(e) => { setFilterTrack(e.target.value); setFilterTopic(''); }} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">All Tracks</option>
          {tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={filterTopic} onChange={(e) => setFilterTopic(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">All Exam Topics</option>
          {topics
            .filter((topic) => !filterTrack || topic.exam_track_id === filterTrack)
            .map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
        </select>
        <select value={filterReviewed} onChange={(e) => setFilterReviewed(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">All Review Statuses</option>
          <option value="pending">Pending Review</option>
          <option value="reviewed">Reviewed</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map((card) => (
            <Card key={card.id} className="border-border hover:border-primary/20 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-2 mb-2">
                      <Badge variant="secondary" className="text-xs">{(card.exam_track as any)?.name || card.exam_name || 'Unknown'}</Badge>
                      {card.reviewed ? (
                        <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-300">Reviewed</Badge>
                      ) : (
                        <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-300">Pending Review</Badge>
                      )}
                      {card.active ? (
                        <Badge className="text-xs bg-emerald-600 text-white border-emerald-700">Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Inactive</Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{card.front_en}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{card.back_en}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setSelected(card)}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant={card.active ? 'default' : 'outline'}
                      size="sm"
                      className={card.active ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700' : ''}
                      onClick={() => toggleActive(card)}
                    >
                      {card.active ? <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> : <XCircle className="w-3.5 h-3.5 mr-1.5 text-amber-500" />}
                      {card.active ? 'Active' : 'Activate'}
                    </Button>
                    <Button
                      variant={card.reviewed ? 'default' : 'outline'}
                      size="sm"
                      className={card.reviewed ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700' : ''}
                      onClick={() => toggleReviewed(card)}
                    >
                      {card.reviewed ? <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> : <XCircle className="w-3.5 h-3.5 mr-1.5 text-amber-500" />}
                      {card.reviewed ? 'Reviewed' : 'Review'}
                    </Button>
                    <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive" onClick={() => deleteCard(card.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Flashcard Preview</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="p-4 bg-primary/5 border border-primary/30 rounded-lg">
                <p className="text-xs text-muted-foreground uppercase mb-1">Front (EN)</p>
                <p className="font-medium text-foreground">{selected.front_en}</p>
              </div>
              <div className="p-4 bg-secondary rounded-lg">
                <p className="text-xs text-muted-foreground uppercase mb-1">Back (EN)</p>
                <p className="text-foreground">{selected.back_en}</p>
              </div>
              <Button
                onClick={() => toggleActive(selected)}
                className={`w-full ${selected.active ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                variant={selected.active ? 'default' : 'outline'}
              >
                {selected.active ? 'Deactivate' : 'Activate'}
              </Button>
              <Button
                onClick={() => toggleReviewed(selected)}
                variant={selected.reviewed ? 'default' : 'outline'}
                className={`w-full ${selected.reviewed ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
              >
                {selected.reviewed ? 'Mark Unreviewed' : 'Mark Reviewed'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
