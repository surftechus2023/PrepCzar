'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Loader2, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { authenticatedFetch } from '@/lib/api';
import type { ExamCategory, ExamTrack, SocialWorkBlueprintItem, Subtopic, Topic } from '@/types/database';

type ContentType = 'mcq' | 'flashcards' | 'vignettes';
type LanguageTarget = 'en' | 'es' | 'fr' | 'all';

interface GenerationJob {
  status: 'idle' | 'running' | 'done' | 'error';
  result?: string;
  error?: string;
  details?: {
    batchId?: string;
    quantityRequested?: number;
    quantityGenerated?: number;
    quantityInserted?: number;
    quantityRejected?: number;
    modelUsed?: string;
    estimatedCost?: number;
    rejectedReasons?: string[];
  };
}

interface BatchHistoryItem {
  id: string;
  content_type: ContentType;
  quantity_requested: number;
  quantity_generated: number;
  quantity_inserted: number;
  quantity_rejected: number;
  status: string;
  model_used: string | null;
  error_message: string | null;
  created_at: string;
  exam_track?: { name: string | null; slug: string | null } | null;
  topic?: { title: string | null } | null;
}

function normalizeBlueprintLabel(value: string | null | undefined) {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function labelsOverlap(left: string | null | undefined, right: string | null | undefined) {
  const normalizedLeft = normalizeBlueprintLabel(left);
  const normalizedRight = normalizeBlueprintLabel(right);
  return Boolean(
    normalizedLeft &&
    normalizedRight &&
    (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft))
  );
}

export default function AdminGeneratePage() {
  const [categories, setCategories] = useState<ExamCategory[]>([]);
  const [tracks, setTracks] = useState<ExamTrack[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
  const [socialWorkBlueprintItems, setSocialWorkBlueprintItems] = useState<SocialWorkBlueprintItem[]>([]);
  const [batchHistory, setBatchHistory] = useState<BatchHistoryItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTrack, setSelectedTrack] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedSubtopic, setSelectedSubtopic] = useState('');
  const [selectedBlueprintItem, setSelectedBlueprintItem] = useState('');
  const [contentType, setContentType] = useState<ContentType>('mcq');
  const [count, setCount] = useState(5);
  const [intendedDifficulty, setIntendedDifficulty] = useState<'medium' | 'hard'>('medium');
  const [intendedCognitiveLevel, setIntendedCognitiveLevel] = useState('application');
  const [language, setLanguage] = useState<LanguageTarget>('all');
  const [job, setJob] = useState<GenerationJob>({ status: 'idle' });
  const { toast } = useToast();

  useEffect(() => {
    loadOptions();
    loadBatchHistory();
  }, []);

  useEffect(() => {
    if (selectedCategory) loadOptions({ categoryId: selectedCategory });
  }, [selectedCategory]);

  useEffect(() => {
    if (selectedTrack) loadOptions({ categoryId: selectedCategory, trackId: selectedTrack });
  }, [selectedTrack]);

  useEffect(() => {
    if (selectedTopic) loadOptions({ categoryId: selectedCategory, trackId: selectedTrack, topicId: selectedTopic });
  }, [selectedTopic]);

  async function loadBatchHistory() {
    const res = await authenticatedFetch('/api/admin/generate');
    const data = await res.json();
    if (res.ok) setBatchHistory(data.batches || []);
  }

  async function loadOptions(params: { categoryId?: string; trackId?: string; topicId?: string } = {}) {
    const query = new URLSearchParams();
    if (params.categoryId) query.set('categoryId', params.categoryId);
    if (params.trackId) query.set('trackId', params.trackId);
    if (params.topicId) query.set('topicId', params.topicId);

    const res = await authenticatedFetch(`/api/admin/generation-options?${query.toString()}`);
    const data = await res.json();

    if (!res.ok) {
      toast({ title: 'Could not load generation options', description: data.error, variant: 'destructive' });
      return;
    }

    setCategories(data.categories || []);

    if (params.categoryId && !params.trackId) {
      setTracks(data.tracks || []);
      setSelectedTrack('');
      setTopics([]);
      setSubtopics([]);
      setSocialWorkBlueprintItems([]);
      setSelectedTopic('');
      setSelectedSubtopic('');
      setSelectedBlueprintItem('');
    }

    if (params.trackId) {
      setTopics(data.topics || []);
      setSocialWorkBlueprintItems(data.socialWorkBlueprintItems || []);
      if (!params.topicId) {
        setSubtopics([]);
        setSelectedTopic('');
        setSelectedSubtopic('');
        setSelectedBlueprintItem('');
      }
    }

    if (params.topicId) {
      setSubtopics(data.subtopics || []);
      setSocialWorkBlueprintItems(data.socialWorkBlueprintItems || []);
      setSelectedSubtopic('');
      setSelectedBlueprintItem('');
    }
  }

  async function handleGenerate() {
    if (!selectedTrack || !selectedTopic || !selectedSubtopic) {
      toast({ title: 'Select category, track, topic, and blueprint objective first', variant: 'destructive' });
      return;
    }

    if (socialWorkBlueprintItems.length > 0 && !selectedBlueprintItem) {
      toast({ title: 'Select a Social Work applied knowledge statement first', variant: 'destructive' });
      return;
    }

    setJob({ status: 'running' });

    try {
      const res = await authenticatedFetch('/api/admin/generate', {
        method: 'POST',
        body: JSON.stringify({
          type: contentType,
          examTrackId: selectedTrack,
          topicId: selectedTopic,
          subtopicId: selectedSubtopic,
          socialWorkBlueprintItemId: selectedBlueprintItem || null,
          count,
          intendedDifficulty,
          intendedCognitiveLevel,
          language,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');

      setJob({
        status: 'done',
        result: `Inserted ${data.quantityInserted} of ${data.quantityRequested} requested ${contentType} items.`,
        details: data,
      });
      await loadBatchHistory();
      toast({ title: 'Generation complete', description: `${data.quantityInserted} items saved as inactive drafts.` });
    } catch (err: any) {
      setJob({ status: 'error', error: err.message });
      toast({ title: 'Generation failed', description: err.message, variant: 'destructive' });
    }
  }

  const selectedTrackObj = tracks.find((track) => track.id === selectedTrack);
  const selectedTopicObj = topics.find((topic) => topic.id === selectedTopic);
  const selectedSubtopicObj = subtopics.find((subtopic) => subtopic.id === selectedSubtopic);
  const itemMatchesSelectedTopic = (item: SocialWorkBlueprintItem) => {
    if (!selectedTopic) return true;
    return item.topic_id === selectedTopic || labelsOverlap(item.major_content_area, selectedTopicObj?.title);
  };
  const itemMatchesSelectedSubtopic = (item: SocialWorkBlueprintItem) => {
    if (!selectedSubtopic) return true;
    return (
      item.subtopic_id === selectedSubtopic ||
      labelsOverlap(item.competency_section, selectedSubtopicObj?.title) ||
      labelsOverlap(item.applied_knowledge_statement, selectedSubtopicObj?.title) ||
      labelsOverlap(item.official_blueprint_text, selectedSubtopicObj?.learning_objective)
    );
  };
  const exactBlueprintItems = socialWorkBlueprintItems.filter((item) => {
    if (selectedTopic && item.topic_id !== selectedTopic) return false;
    if (selectedSubtopic && item.subtopic_id !== selectedSubtopic) return false;
    return true;
  });
  const matchedBlueprintItems = socialWorkBlueprintItems.filter((item) => (
    itemMatchesSelectedTopic(item) && itemMatchesSelectedSubtopic(item)
  ));
  const topicBlueprintItems = socialWorkBlueprintItems.filter((item) => {
    return itemMatchesSelectedTopic(item);
  });
  const selectableBlueprintItems = exactBlueprintItems.length
    ? exactBlueprintItems
    : matchedBlueprintItems.length
      ? matchedBlueprintItems
      : topicBlueprintItems.length
        ? topicBlueprintItems
        : socialWorkBlueprintItems;
  const usingBlueprintFallback = socialWorkBlueprintItems.length > 0 && topicBlueprintItems.length === 0;

  const contentTypes: { value: ContentType; label: string; desc: string }[] = [
    { value: 'mcq', label: 'MCQ Questions', desc: 'Blueprint-grounded questions with rationales and integrity review' },
    { value: 'flashcards', label: 'Flashcards', desc: 'Concise front/back study cards linked to blueprint objectives' },
    { value: 'vignettes', label: 'Case Vignettes', desc: 'Scenarios with prompts, rubric, ideal answer, and coaching feedback' },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          Generate Content
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generate blueprint-grounded content once into Supabase. Student practice never calls OpenAI.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-6">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Generation Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Content Type</label>
              <div className="space-y-2">
                {contentTypes.map((item) => (
                  <label key={item.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${contentType === item.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                    <input type="radio" value={item.value} checked={contentType === item.value} onChange={() => setContentType(item.value)} className="mt-0.5" />
                    <span>
                      <span className="block text-sm font-medium text-foreground">{item.label}</span>
                      <span className="block text-xs text-muted-foreground">{item.desc}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Exam Category</label>
                <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Select category...</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Exam Track</label>
                <select value={selectedTrack} onChange={(event) => setSelectedTrack(event.target.value)} disabled={!selectedCategory || tracks.length === 0} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50">
                  <option value="">Select track...</option>
                  {tracks.map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Blueprint Domain / Topic</label>
                <select value={selectedTopic} onChange={(event) => setSelectedTopic(event.target.value)} disabled={!selectedTrack || topics.length === 0} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50">
                  <option value="">Select topic...</option>
                  {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}{topic.official_weight_percent ? ` (${topic.official_weight_percent}%)` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Competency / Applied Knowledge</label>
                <select value={selectedSubtopic} onChange={(event) => setSelectedSubtopic(event.target.value)} disabled={!selectedTopic || subtopics.length === 0} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50">
                  <option value="">Select blueprint objective...</option>
                  {subtopics.map((subtopic) => <option key={subtopic.id} value={subtopic.id}>{subtopic.title}</option>)}
                </select>
                {selectedTopic && subtopics.length === 0 && (
                  <p className="text-xs text-destructive mt-1">No blueprint objective is linked to this topic. Fix it in Admin &gt; Blueprints before generating.</p>
                )}
              </div>
            </div>

            {selectedSubtopicObj && (
              <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Learning objective</p>
                <p className="mt-1">{selectedSubtopicObj.learning_objective}</p>
              </div>
            )}

            {socialWorkBlueprintItems.length > 0 && (
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Social Work Applied Knowledge Statement</label>
                <select
                  value={selectedBlueprintItem}
                  onChange={(event) => {
                    const blueprintItemId = event.target.value;
                    setSelectedBlueprintItem(blueprintItemId);
                  }}
                  disabled={!selectedTrack || selectableBlueprintItems.length === 0}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
                >
                  <option value="">Select applied knowledge statement...</option>
                  {selectableBlueprintItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.major_content_area} — {item.competency_section} — {item.applied_knowledge_statement}
                    </option>
                  ))}
                </select>
                {usingBlueprintFallback && (
                  <p className="text-xs text-amber-700 mt-1">
                    No exact applied statement is linked to this topic/objective yet. Showing available Social Work blueprint statements for this track.
                  </p>
                )}
                {selectedBlueprintItem && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {socialWorkBlueprintItems.find((item) => item.id === selectedBlueprintItem)?.official_blueprint_text}
                  </p>
                )}
              </div>
            )}

            <div className="grid md:grid-cols-4 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Quantity</label>
                <input type="number" min={1} max={100} value={count} onChange={(event) => setCount(Number(event.target.value))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Difficulty</label>
                <select value={intendedDifficulty} onChange={(event) => setIntendedDifficulty(event.target.value as 'medium' | 'hard')} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Cognitive Level</label>
                <select value={intendedCognitiveLevel} onChange={(event) => setIntendedCognitiveLevel(event.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="application">Application</option>
                  <option value="reasoning">Reasoning</option>
                  <option value="analysis">Analysis</option>
                  <option value="clinical judgment">Clinical judgment</option>
                  <option value="ethics">Ethics</option>
                  <option value="safety">Safety</option>
                  <option value="prioritization">Prioritization</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Language</label>
                <select value={language} onChange={(event) => setLanguage(event.target.value as LanguageTarget)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="all">All</option>
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                </select>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleGenerate}
              disabled={job.status === 'running' || !selectedTrack || !selectedTopic || !selectedSubtopic || (socialWorkBlueprintItems.length > 0 && !selectedBlueprintItem)}
            >
              {job.status === 'running' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Generate {count} {contentType === 'mcq' ? 'Questions' : contentType === 'flashcards' ? 'Flashcards' : 'Vignettes'}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className={`border ${job.status === 'done' ? 'border-emerald-400' : job.status === 'error' ? 'border-destructive' : 'border-border'}`}>
            <CardHeader>
              <CardTitle className="text-base">Generation Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                {job.status === 'running' && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
                {job.status === 'done' && <CheckCircle className="w-5 h-5 text-emerald-600" />}
                {job.status === 'error' && <AlertCircle className="w-5 h-5 text-destructive" />}
                <Badge variant={job.status === 'error' ? 'destructive' : 'secondary'}>{job.status}</Badge>
              </div>
              {job.status === 'running' && (
                <p className="text-sm text-muted-foreground">
                  Generating {contentType} for {selectedTrackObj?.name} — {selectedTopicObj?.title}.
                </p>
              )}
              {job.result && <p className="text-sm text-foreground">{job.result}</p>}
              {job.error && <p className="text-sm text-destructive">{job.error}</p>}
              {job.details && (
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>Batch: {job.details.batchId}</p>
                  <p>Generated: {job.details.quantityGenerated} · Inserted: {job.details.quantityInserted} · Rejected: {job.details.quantityRejected}</p>
                  <p>Model: {job.details.modelUsed} · Estimated cost: ${job.details.estimatedCost ?? 0}</p>
                  {Boolean(job.details.rejectedReasons?.length) && <p className="text-destructive">Rejected: {job.details.rejectedReasons?.join('; ')}</p>}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">Recent Batch History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {batchHistory.length === 0 && <p className="text-sm text-muted-foreground">No generation batches yet.</p>}
              {batchHistory.slice(0, 8).map((batch) => (
                <div key={batch.id} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{batch.content_type} · {batch.exam_track?.name || 'Track'}</span>
                    <Badge variant={batch.status === 'failed' ? 'destructive' : 'secondary'}>{batch.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{batch.topic?.title || 'No topic'} · {batch.model_used || 'model not logged'}</p>
                  <p className="text-xs text-muted-foreground">Inserted {batch.quantity_inserted}/{batch.quantity_requested}; rejected {batch.quantity_rejected}</p>
                  {batch.error_message && <p className="text-xs text-destructive mt-1">{batch.error_message}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
