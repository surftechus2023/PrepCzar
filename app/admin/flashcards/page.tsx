'use client';

import { useState, useEffect } from 'react';
import { Search, CheckCircle, XCircle, Trash2, Loader2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import type { Flashcard, ExamTrack } from '@/types/database';

interface FlashcardWithMeta extends Flashcard {
  exam_track?: ExamTrack;
}

export default function AdminFlashcardsPage() {
  const [cards, setCards] = useState<FlashcardWithMeta[]>([]);
  const [tracks, setTracks] = useState<ExamTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTrack, setFilterTrack] = useState('');
  const [selected, setSelected] = useState<FlashcardWithMeta | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [cardsRes, tracksRes] = await Promise.all([
      supabase.from('flashcards').select('*, exam_track:exam_tracks(name)').order('created_at', { ascending: false }).limit(200),
      supabase.from('exam_tracks').select('*').order('name'),
    ]);
    setCards((cardsRes.data as FlashcardWithMeta[]) || []);
    setTracks(tracksRes.data || []);
    setLoading(false);
  }

  async function toggleActive(card: FlashcardWithMeta) {
    await (supabase as any).from('flashcards').update({ active: !card.active }).eq('id', card.id);
    setCards(cards.map(c => c.id === card.id ? { ...c, active: !c.active } : c));
  }

  async function toggleReviewed(card: FlashcardWithMeta) {
    await (supabase as any).from('flashcards').update({ reviewed: !card.reviewed }).eq('id', card.id);
    setCards(cards.map(c => c.id === card.id ? { ...c, reviewed: !c.reviewed } : c));
  }

  async function deleteCard(id: string) {
    if (!confirm('Delete this flashcard?')) return;
    await supabase.from('flashcards').delete().eq('id', id);
    setCards(cards.filter(c => c.id !== id));
    toast({ title: 'Deleted' });
  }

  const filtered = cards.filter(c => {
    const matchSearch = !search || c.front_en.toLowerCase().includes(search.toLowerCase());
    const matchTrack = !filterTrack || c.exam_track_id === filterTrack;
    return matchSearch && matchTrack;
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
        <select value={filterTrack} onChange={(e) => setFilterTrack(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">All Tracks</option>
          {tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
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
                      <Badge variant="secondary" className="text-xs">{(card.exam_track as any)?.name || 'Unknown'}</Badge>
                      {card.reviewed ? (
                        <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-300">Reviewed</Badge>
                      ) : (
                        <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-300">Pending Review</Badge>
                      )}
                      {card.active ? (
                        <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-300">Active</Badge>
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
                    <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => toggleActive(card)}>
                      {card.active ? <XCircle className="w-3.5 h-3.5 text-amber-500" /> : <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => toggleReviewed(card)}>
                      {card.reviewed ? <XCircle className="w-3.5 h-3.5 text-amber-500" /> : <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
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
              <Button onClick={() => toggleActive(selected)} className="w-full">
                {selected.active ? 'Deactivate' : 'Activate'}
              </Button>
              <Button onClick={() => toggleReviewed(selected)} variant="outline" className="w-full">
                {selected.reviewed ? 'Mark Unreviewed' : 'Mark Reviewed'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
