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
import type { CaseVignette, ExamTrack } from '@/types/database';

interface VignetteWithMeta extends CaseVignette {
  exam_track?: ExamTrack;
}

export default function AdminVignettesPage() {
  const [vignettes, setVignettes] = useState<VignetteWithMeta[]>([]);
  const [tracks, setTracks] = useState<ExamTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTrack, setFilterTrack] = useState('');
  const [filterReviewed, setFilterReviewed] = useState('all');
  const [selected, setSelected] = useState<VignetteWithMeta | null>(null);
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const res = await authenticatedFetch('/api/admin/vignettes');
    const data = await res.json();

    if (!res.ok) {
      toast({ title: 'Could not load vignettes', description: data.error, variant: 'destructive' });
      setLoading(false);
      return;
    }

    setVignettes((data.vignettes as VignetteWithMeta[]) || []);
    setTracks(data.tracks || []);
    setLoading(false);
  }

  async function updateVignette(id: string, values: Partial<CaseVignette>) {
    const res = await authenticatedFetch('/api/admin/vignettes', {
      method: 'PATCH',
      body: JSON.stringify({ id, values }),
    });
    const data = await res.json();

    if (!res.ok) {
      toast({ title: 'Update failed', description: data.error, variant: 'destructive' });
      return null;
    }

    return data.vignette as VignetteWithMeta;
  }

  function applyUpdatedVignette(updated: VignetteWithMeta) {
    setVignettes(current => current.map(item => item.id === updated.id ? updated : item));
    setSelected(current => current?.id === updated.id ? updated : current);
  }

  async function toggleActive(v: VignetteWithMeta) {
    const updated = await updateVignette(v.id, { active: !v.active });
    if (updated) applyUpdatedVignette(updated);
  }

  async function toggleReviewed(v: VignetteWithMeta) {
    const updated = await updateVignette(v.id, { reviewed: !v.reviewed });
    if (updated) applyUpdatedVignette(updated);
  }

  async function deleteVignette(id: string) {
    if (!confirm('Delete this vignette?')) return;
    const res = await authenticatedFetch(`/api/admin/vignettes?id=${id}`, { method: 'DELETE' });
    const data = await res.json();

    if (!res.ok) {
      toast({ title: 'Delete failed', description: data.error, variant: 'destructive' });
      return;
    }

    setVignettes(vignettes.filter(v => v.id !== id));
    toast({ title: 'Deleted' });
  }

  const filtered = vignettes.filter(v => {
    const matchSearch = !search || v.case_en.toLowerCase().includes(search.toLowerCase());
    const matchTrack = !filterTrack || v.exam_track_id === filterTrack;
    const matchReviewed = filterReviewed === 'all' ||
      (filterReviewed === 'reviewed' && v.reviewed) ||
      (filterReviewed === 'pending' && !v.reviewed);
    return matchSearch && matchTrack && matchReviewed;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Case Vignettes</h1>
        <p className="text-muted-foreground text-sm">{vignettes.length} total vignettes</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search vignettes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select value={filterTrack} onChange={(e) => setFilterTrack(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">All Tracks</option>
          {tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
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
          {filtered.map((v) => (
            <Card key={v.id} className="border-border hover:border-primary/20 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-2 mb-2">
                      <Badge variant="secondary" className="text-xs">{(v.exam_track as any)?.name || v.exam_name || 'Unknown'}</Badge>
                      {v.reviewed ? (
                        <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-300">Reviewed</Badge>
                      ) : (
                        <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-300">Pending Review</Badge>
                      )}
                      {v.active ? (
                        <Badge className="text-xs bg-emerald-600 text-white border-emerald-700">Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Inactive</Badge>
                      )}
                    </div>
                    <p className="text-sm text-foreground line-clamp-2">{v.case_en}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setSelected(v)}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant={v.active ? 'default' : 'outline'}
                      size="sm"
                      className={v.active ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700' : ''}
                      onClick={() => toggleActive(v)}
                    >
                      {v.active ? <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> : <XCircle className="w-3.5 h-3.5 mr-1.5 text-amber-500" />}
                      {v.active ? 'Active' : 'Activate'}
                    </Button>
                    <Button
                      variant={v.reviewed ? 'default' : 'outline'}
                      size="sm"
                      className={v.reviewed ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700' : ''}
                      onClick={() => toggleReviewed(v)}
                    >
                      {v.reviewed ? <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> : <XCircle className="w-3.5 h-3.5 mr-1.5 text-amber-500" />}
                      {v.reviewed ? 'Reviewed' : 'Review'}
                    </Button>
                    <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive" onClick={() => deleteVignette(v.id)}>
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
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Vignette Preview</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Case Scenario</p>
                <p className="text-sm text-foreground">{selected.case_en}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Prompt</p>
                <p className="text-sm text-foreground">{selected.prompt_en}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Ideal Answer</p>
                <p className="text-sm text-muted-foreground">{selected.ideal_answer_en}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Coaching Feedback</p>
                <p className="text-sm text-muted-foreground">{selected.coaching_feedback_en}</p>
              </div>
              <Button
                onClick={() => toggleActive(selected)}
                variant={selected.active ? 'default' : 'outline'}
                className={`w-full ${selected.active ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
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
