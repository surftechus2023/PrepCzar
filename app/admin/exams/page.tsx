'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Loader2, Plus, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { authenticatedFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { ExamCategory, ExamTrack, Topic } from '@/types/database';

interface TrackWithTopics extends ExamTrack {
  topics: Topic[];
}

interface CategoryWithTracks extends ExamCategory {
  tracks: TrackWithTopics[];
}

export default function AdminExamsPage() {
  const [categories, setCategories] = useState<CategoryWithTracks[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTopicText, setNewTopicText] = useState('');
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const res = await authenticatedFetch('/api/admin/exams');
    const data = await res.json();

    if (!res.ok) {
      toast({ title: 'Could not load exams', description: data.error, variant: 'destructive' });
      setLoading(false);
      return;
    }

    setCategories(data.categories || []);
    setLoading(false);
  }

  async function addTopic(trackId: string) {
    if (!newTopicText.trim()) return;

    const res = await authenticatedFetch('/api/admin/exams', {
      method: 'POST',
      body: JSON.stringify({ trackId, title: newTopicText }),
    });
    const data = await res.json();

    if (!res.ok) {
      toast({ title: 'Error', description: data.error, variant: 'destructive' });
    } else {
      setCategories(prev => prev.map(cat => ({
        ...cat,
        tracks: cat.tracks.map(t =>
          t.id === trackId ? { ...t, topics: [...t.topics, data.topic] } : t
        ),
      })));
      setNewTopicText('');
      toast({ title: 'Topic added' });
    }
  }

  async function toggleTrack(track: ExamTrack) {
    const res = await authenticatedFetch('/api/admin/exams', {
      method: 'PATCH',
      body: JSON.stringify({ trackId: track.id, active: !track.active }),
    });
    const data = await res.json();

    if (!res.ok) {
      toast({ title: 'Error', description: data.error, variant: 'destructive' });
      return;
    }

    setCategories(prev => prev.map(cat => ({
      ...cat,
      tracks: cat.tracks.map(t => t.id === track.id ? { ...t, active: !t.active } : t),
    })));
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Exam Tracks & Topics</h1>
        <p className="text-muted-foreground text-sm">Manage exam tracks grouped by category and their topic areas</p>
      </div>

      <div className="space-y-8">
        {categories.map((cat) => (
          <div key={cat.id}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-lg font-semibold text-foreground">{cat.name}</h2>
              <Badge variant="secondary" className="text-xs">{cat.tracks.length} tracks</Badge>
            </div>

            <div className="space-y-3 pl-4 border-l-2 border-border">
              {cat.tracks.map((track) => (
                <Card key={track.id} className="border-border">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <BookOpen className="w-5 h-5 text-primary" />
                        <div>
                          <CardTitle className="text-base">{track.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">${track.monthly_price}/mo · {track.slug}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={track.active ? 'default' : 'secondary'}>
                          {track.active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Button variant="ghost" size="sm" onClick={() => toggleTrack(track)}>
                          {track.active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Topics ({track.topics.length})</p>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {track.topics.map(topic => (
                          <Badge key={topic.id} variant="secondary" className="text-xs">
                            {topic.title}{topic.official_weight_percent ? ` · ${topic.official_weight_percent}%` : ''}
                          </Badge>
                        ))}
                        {track.topics.length === 0 && (
                          <p className="text-xs text-muted-foreground">No topics yet</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add topic..."
                          value={selectedTrack === track.id ? newTopicText : ''}
                          onChange={(e) => { setSelectedTrack(track.id); setNewTopicText(e.target.value); }}
                          onFocus={() => setSelectedTrack(track.id)}
                          className="h-8 text-sm"
                          onKeyDown={(e) => e.key === 'Enter' && addTopic(track.id)}
                        />
                        <Button size="sm" onClick={() => addTopic(track.id)} className="h-8 px-3">
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
