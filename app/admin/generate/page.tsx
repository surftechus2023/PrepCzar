'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Loader2, CheckCircle, AlertCircle, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { authenticatedFetch } from '@/lib/api';
import type { ExamCategory, ExamTrack, Topic } from '@/types/database';

type ContentType = 'mcq' | 'flashcards' | 'vignettes';

interface GenerationJob {
  type: ContentType;
  examTrackId: string;
  topicId: string;
  count: number;
  status: 'idle' | 'running' | 'done' | 'error';
  result?: string;
}

export default function AdminGeneratePage() {
  const [categories, setCategories] = useState<ExamCategory[]>([]);
  const [tracks, setTracks] = useState<ExamTrack[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTrack, setSelectedTrack] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [contentType, setContentType] = useState<ContentType>('mcq');
  const [count, setCount] = useState(10);
  const [job, setJob] = useState<GenerationJob | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    supabase.from('exam_categories').select('*').order('display_order').then(({ data }) => setCategories(data || []));
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      supabase.from('exam_tracks').select('*').eq('category_id', selectedCategory).order('display_order').then(({ data }) => {
        setTracks(data || []);
        setSelectedTrack('');
        setTopics([]);
        setSelectedTopic('');
      });
    }
  }, [selectedCategory]);

  useEffect(() => {
    if (selectedTrack) {
      supabase.from('topics').select('*').eq('exam_track_id', selectedTrack).order('display_order').then(({ data }) => {
        setTopics(data || []);
        setSelectedTopic('');
      });
    }
  }, [selectedTrack]);

  async function handleGenerate() {
    if (!selectedTrack || !selectedTopic) {
      toast({ title: 'Select a track and topic first', variant: 'destructive' });
      return;
    }

    setJob({ type: contentType, examTrackId: selectedTrack, topicId: selectedTopic, count, status: 'running' });

    try {
      const res = await authenticatedFetch('/api/admin/generate', {
        method: 'POST',
        body: JSON.stringify({
          type: contentType,
          examTrackId: selectedTrack,
          topicId: selectedTopic,
          count,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Generation failed');

      setJob(prev => prev ? { ...prev, status: 'done', result: `Generated ${data.count} ${contentType} items successfully.` } : null);

      toast({
        title: 'Generation complete!',
        description: `${data.count} ${contentType} items created and pending review.`,
      });
    } catch (err: any) {
      setJob(prev => prev ? { ...prev, status: 'error', result: err.message } : null);
      toast({ title: 'Generation failed', description: err.message, variant: 'destructive' });
    }
  }

  const selectedTrackObj = tracks.find(t => t.id === selectedTrack);
  const selectedTopicObj = topics.find(t => t.id === selectedTopic);

  const contentTypes: { value: ContentType; label: string; desc: string }[] = [
    { value: 'mcq', label: 'MCQ Questions', desc: 'Multiple choice questions with rationales in 3 languages' },
    { value: 'flashcards', label: 'Flashcards', desc: 'Front/back study cards in 3 languages' },
    { value: 'vignettes', label: 'Case Vignettes', desc: 'Clinical case scenarios with coaching feedback' },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          AI Content Generation
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generate exam-specific content using GPT-4. All content is saved as pending review before students can access it.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Generation Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Content type */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Content Type</label>
              <div className="space-y-2">
                {contentTypes.map((ct) => (
                  <label
                    key={ct.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${contentType === ct.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}
                  >
                    <input
                      type="radio"
                      value={ct.value}
                      checked={contentType === ct.value}
                      onChange={() => setContentType(ct.value)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium text-foreground">{ct.label}</p>
                      <p className="text-xs text-muted-foreground">{ct.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select category...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Track */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Exam Track</label>
              <select
                value={selectedTrack}
                onChange={(e) => setSelectedTrack(e.target.value)}
                disabled={!selectedCategory || tracks.length === 0}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
              >
                <option value="">Select exam track...</option>
                {tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            {/* Topic */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Topic</label>
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                disabled={!selectedTrack || topics.length === 0}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
              >
                <option value="">Select topic...</option>
                {topics.map(t => <option key={t.id} value={t.id}>{t.title}{t.official_weight_percent ? ` (${t.official_weight_percent}%)` : ''}</option>)}
              </select>
              {selectedTrack && topics.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">No topics found for this track.</p>
              )}
            </div>

            {/* Count */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                Number to Generate: <span className="text-primary font-bold">{count}</span>
              </label>
              <input
                type="range"
                min={contentType === 'vignettes' ? 2 : 5}
                max={contentType === 'vignettes' ? 10 : contentType === 'flashcards' ? 20 : 25}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Minimum</span>
                <span>Maximum</span>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleGenerate}
              disabled={job?.status === 'running' || !selectedTrack || !selectedTopic}
            >
              {job?.status === 'running' ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" />Generate {count} {contentType === 'mcq' ? 'Questions' : contentType === 'flashcards' ? 'Flashcards' : 'Vignettes'}</>
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {job && (
            <Card className={`border ${job.status === 'done' ? 'border-emerald-400' : job.status === 'error' ? 'border-destructive' : 'border-primary'}`}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  {job.status === 'running' && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
                  {job.status === 'done' && <CheckCircle className="w-5 h-5 text-emerald-600" />}
                  {job.status === 'error' && <AlertCircle className="w-5 h-5 text-destructive" />}
                  <span className="font-medium text-foreground capitalize">
                    {job.status === 'running' ? 'Generating...' : job.status === 'done' ? 'Complete!' : 'Failed'}
                  </span>
                </div>
                {job.status === 'running' && (
                  <p className="text-sm text-muted-foreground">
                    Calling GPT-4o-mini for {selectedTrackObj?.name} — {selectedTopicObj?.title}.
                    This may take 15-30 seconds...
                  </p>
                )}
                {job.result && (
                  <p className="text-sm text-foreground">{job.result}</p>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">How It Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex gap-2">
                <span className="font-bold text-foreground">1.</span>
                <p>Select category → exam track → topic → content type</p>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-foreground">2.</span>
                <p>GPT-4o-mini generates track-specific content in English, Spanish, and French</p>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-foreground">3.</span>
                <p>Content is saved as <Badge variant="outline" className="text-xs">pending review</Badge> and <Badge variant="outline" className="text-xs">inactive</Badge></p>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-foreground">4.</span>
                <p>Review each item in the Questions/Flashcards/Vignettes manager</p>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-foreground">5.</span>
                <p>Set <code className="bg-secondary px-1 rounded">reviewed</code> and <code className="bg-secondary px-1 rounded">active</code> to publish to students</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
