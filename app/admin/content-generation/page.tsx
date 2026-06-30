'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { authenticatedFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { ExamCategory, ExamTrack, Topic } from '@/types/database';

interface GenerationResult {
  batchId: string;
  quantityRequested: number;
  quantityGenerated: number;
  quantityInserted: number;
  quantityRejected: number;
  error?: string;
}

export default function ContentGenerationPage() {
  const [categories, setCategories] = useState<ExamCategory[]>([]);
  const [tracks, setTracks] = useState<ExamTrack[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTrack, setSelectedTrack] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [subtopic, setSubtopic] = useState('');
  const [learningObjective, setLearningObjective] = useState('');
  const [quantity, setQuantity] = useState(25);
  const [difficultyMix, setDifficultyMix] = useState({ easy: 30, medium: 50, hard: 20 });
  const [cognitiveLevelMix, setCognitiveLevelMix] = useState({ recall: 20, application: 40, analysis: 40 });
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [result, setResult] = useState<GenerationResult | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    supabase
      .from('exam_categories')
      .select('*')
      .order('display_order')
      .then(({ data }) => setCategories(data || []));
  }, []);

  useEffect(() => {
    if (!selectedCategory) return;

    supabase
      .from('exam_tracks')
      .select('*')
      .eq('category_id', selectedCategory)
      .order('display_order')
      .then(({ data }) => {
        setTracks(data || []);
        setSelectedTrack('');
        setTopics([]);
        setSelectedTopic('');
      });
  }, [selectedCategory]);

  useEffect(() => {
    if (!selectedTrack) return;

    supabase
      .from('topics')
      .select('*')
      .eq('exam_track_id', selectedTrack)
      .order('display_order')
      .then(({ data }) => {
        setTopics(data || []);
        setSelectedTopic('');
      });
  }, [selectedTrack]);

  function updateDifficultyMix(key: keyof typeof difficultyMix, value: number) {
    setDifficultyMix((current) => ({ ...current, [key]: value }));
  }

  function updateCognitiveMix(key: keyof typeof cognitiveLevelMix, value: number) {
    setCognitiveLevelMix((current) => ({ ...current, [key]: value }));
  }

  async function handleGenerate() {
    if (!selectedTrack || !selectedTopic || !subtopic.trim() || !learningObjective.trim()) {
      toast({ title: 'Complete all required fields', variant: 'destructive' });
      return;
    }

    setStatus('running');
    setResult(null);

    try {
      const response = await authenticatedFetch('/api/admin/generate-questions', {
        method: 'POST',
        body: JSON.stringify({
          examTrackId: selectedTrack,
          topicId: selectedTopic,
          subtopic,
          learningObjective,
          quantity,
          difficultyMix,
          cognitiveLevelMix,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Question generation failed.');

      setResult(data);
      setStatus('completed');
      toast({ title: 'Generation complete', description: `${data.quantityInserted} questions inserted for review.` });
    } catch (err: any) {
      setStatus('failed');
      setResult({ batchId: '', quantityRequested: quantity, quantityGenerated: 0, quantityInserted: 0, quantityRejected: 0, error: err.message });
      toast({ title: 'Generation failed', description: err.message, variant: 'destructive' });
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          AI Question Generation
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate original MCQs into inactive, unreviewed database records for admin review.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generation Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label>Exam Category</Label>
                <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Select category</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Exam Track</Label>
                <select value={selectedTrack} onChange={(event) => setSelectedTrack(event.target.value)} disabled={!selectedCategory} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50">
                  <option value="">Select track</option>
                  {tracks.map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Topic</Label>
                <select value={selectedTopic} onChange={(event) => setSelectedTopic(event.target.value)} disabled={!selectedTrack} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50">
                  <option value="">Select topic</option>
                  {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
                </select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="subtopic">Subtopic</Label>
                <Input id="subtopic" value={subtopic} onChange={(event) => setSubtopic(event.target.value)} placeholder="Example: crisis intervention priorities" />
              </div>
              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <Input id="quantity" type="number" min={1} max={100} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
              </div>
            </div>

            <div>
              <Label htmlFor="learning-objective">Learning Objective</Label>
              <Textarea id="learning-objective" value={learningObjective} onChange={(event) => setLearningObjective(event.target.value)} placeholder="Students can identify the safest first intervention in..." />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Difficulty Mix</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(['easy', 'medium', 'hard'] as const).map((key) => (
                    <div key={key} className="grid grid-cols-[80px_1fr_64px] items-center gap-3">
                      <Label className="capitalize">{key}</Label>
                      <input type="range" min={0} max={100} value={difficultyMix[key]} onChange={(event) => updateDifficultyMix(key, Number(event.target.value))} />
                      <Input type="number" min={0} max={100} value={difficultyMix[key]} onChange={(event) => updateDifficultyMix(key, Number(event.target.value))} />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Cognitive Level Mix</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(['recall', 'application', 'analysis'] as const).map((key) => (
                    <div key={key} className="grid grid-cols-[88px_1fr_64px] items-center gap-3">
                      <Label className="capitalize">{key}</Label>
                      <input type="range" min={0} max={100} value={cognitiveLevelMix[key]} onChange={(event) => updateCognitiveMix(key, Number(event.target.value))} />
                      <Input type="number" min={0} max={100} value={cognitiveLevelMix[key]} onChange={(event) => updateCognitiveMix(key, Number(event.target.value))} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Button onClick={handleGenerate} disabled={status === 'running'} className="w-full">
              {status === 'running' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Generate Questions
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generation Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              {status === 'running' && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
              {status === 'completed' && <CheckCircle className="w-5 h-5 text-emerald-600" />}
              {status === 'failed' && <AlertCircle className="w-5 h-5 text-destructive" />}
              <Badge variant={status === 'failed' ? 'destructive' : 'secondary'} className="capitalize">{status}</Badge>
            </div>

            {result && (
              <div className="space-y-3 text-sm">
                {result.batchId && <p><span className="font-medium">Batch:</span> {result.batchId}</p>}
                <p><span className="font-medium">Requested:</span> {result.quantityRequested}</p>
                <p><span className="font-medium">Generated:</span> {result.quantityGenerated}</p>
                <p><span className="font-medium">Inserted:</span> {result.quantityInserted}</p>
                <p><span className="font-medium">Rejected:</span> {result.quantityRejected}</p>
                {result.error && <p className="text-destructive">{result.error}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
