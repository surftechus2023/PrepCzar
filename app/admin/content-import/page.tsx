'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileUp, Loader2, Save, Wand2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { authenticatedFetch } from '@/lib/api';
import type { ExamCategory, ExamTrack, SocialWorkBlueprintItem, Subtopic, Topic } from '@/types/database';

type ContentType = 'mcq' | 'flashcards' | 'vignettes';
type CleanupMode = 'parse_only' | 'parse_structure' | 'structure_improve' | 'structure_improve_review';

interface PreviewItem {
  id: string;
  contentType: ContentType;
  originalText: string;
  confidence: number;
  include: boolean;
  validationErrors: string[];
  missingFields: string[];
  fields: Record<string, string>;
}

const contentTypes: Array<{ value: ContentType; label: string }> = [
  { value: 'mcq', label: 'MCQs' },
  { value: 'flashcards', label: 'Flashcards' },
  { value: 'vignettes', label: 'Case Vignettes' },
];

const cleanupModes: Array<{ value: CleanupMode; label: string }> = [
  { value: 'parse_only', label: 'Parse only' },
  { value: 'parse_structure', label: 'Parse and structure' },
  { value: 'structure_improve', label: 'Structure and improve' },
  { value: 'structure_improve_review', label: 'Structure, improve, and review' },
];

function emptyManualItem(contentType: ContentType): PreviewItem {
  let fields: Record<string, string>;
  if (contentType === 'mcq') {
    fields = { question: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'a', rationale: '' };
  } else if (contentType === 'flashcards') {
    fields = { front: '', back: '' };
  } else {
    fields = { case: '', prompt: '', ideal_answer: '', coaching_feedback: '' };
  }

  return {
    id: crypto.randomUUID(),
    contentType,
    originalText: 'Manual entry',
    confidence: 100,
    include: true,
    validationErrors: [],
    missingFields: [],
    fields,
  };
}

export default function AdminContentImportPage() {
  const [categories, setCategories] = useState<ExamCategory[]>([]);
  const [tracks, setTracks] = useState<ExamTrack[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
  const [blueprintItems, setBlueprintItems] = useState<SocialWorkBlueprintItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTrack, setSelectedTrack] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedSubtopic, setSelectedSubtopic] = useState('');
  const [selectedBlueprintItem, setSelectedBlueprintItem] = useState('');
  const [contentType, setContentType] = useState<ContentType>('mcq');
  const [cleanupMode, setCleanupMode] = useState<CleanupMode>('parse_only');
  const [difficulty, setDifficulty] = useState<'medium' | 'hard'>('medium');
  const [cognitiveLevel, setCognitiveLevel] = useState('application');
  const [pastedText, setPastedText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [runIntegrity, setRunIntegrity] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadOptions();
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

  async function loadOptions(params: { categoryId?: string; trackId?: string; topicId?: string } = {}) {
    const query = new URLSearchParams();
    if (params.categoryId) query.set('categoryId', params.categoryId);
    if (params.trackId) query.set('trackId', params.trackId);
    if (params.topicId) query.set('topicId', params.topicId);
    const response = await authenticatedFetch(`/api/admin/generation-options?${query.toString()}`);
    const data = await response.json();
    if (!response.ok) {
      toast({ title: 'Could not load blueprint options', description: data.error, variant: 'destructive' });
      return;
    }
    setCategories(data.categories || []);
    if (params.categoryId && !params.trackId) {
      setTracks(data.tracks || []);
      setSelectedTrack('');
      setTopics([]);
      setSubtopics([]);
      setBlueprintItems([]);
      setSelectedTopic('');
      setSelectedSubtopic('');
      setSelectedBlueprintItem('');
    }
    if (params.trackId) {
      setTopics(data.topics || []);
      setBlueprintItems(data.socialWorkBlueprintItems || []);
      if (!params.topicId) {
        setSubtopics([]);
        setSelectedTopic('');
        setSelectedSubtopic('');
        setSelectedBlueprintItem('');
      }
    }
    if (params.topicId) {
      setSubtopics(data.subtopics || []);
      setBlueprintItems(data.socialWorkBlueprintItems || []);
      setSelectedSubtopic('');
      setSelectedBlueprintItem('');
    }
  }

  const selectedTopicObj = topics.find((topic) => topic.id === selectedTopic);
  const selectedSubtopicObj = subtopics.find((subtopic) => subtopic.id === selectedSubtopic);
  const selectedBlueprint = blueprintItems.find((item) => item.id === selectedBlueprintItem);
  const selectableBlueprintItems = useMemo(() => {
    if (!selectedTopic) return blueprintItems;
    const topicTitle = selectedTopicObj?.title?.toLowerCase() || '';
    return blueprintItems.filter((item) => item.topic_id === selectedTopic || item.major_content_area.toLowerCase().includes(topicTitle));
  }, [blueprintItems, selectedTopic, selectedTopicObj]);

  function mappingPayload() {
    return {
      contentType,
      examTrackId: selectedTrack,
      topicId: selectedTopic,
      subtopicId: selectedSubtopic || null,
      socialWorkBlueprintItemId: selectedBlueprintItem || null,
      blueprintContentArea: selectedBlueprint?.major_content_area || selectedTopicObj?.title || null,
      blueprintCompetencySection: selectedBlueprint?.competency_section || selectedSubtopicObj?.title || null,
      appliedKnowledgeStatement: selectedBlueprint?.applied_knowledge_statement || selectedSubtopicObj?.learning_objective || null,
      questionWritingGuideline: selectedBlueprint?.sample_style_guidance || null,
      blueprintReferenceText: selectedBlueprint?.official_blueprint_text || selectedSubtopicObj?.official_blueprint_text || selectedTopicObj?.official_blueprint_text || null,
      learningObjective: selectedBlueprint?.applied_knowledge_statement || selectedSubtopicObj?.learning_objective || null,
      difficulty,
      cognitiveLevel,
    };
  }

  function requireMapping() {
    if (!selectedTrack || !selectedTopic) {
      toast({ title: 'Select exam track and blueprint topic first', variant: 'destructive' });
      return false;
    }
    return true;
  }

  async function previewImport() {
    if (!requireMapping()) return;
    if (!file && !pastedText.trim()) {
      toast({ title: 'Upload a file or paste text first', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const form = new FormData();
    Object.entries(mappingPayload()).forEach(([key, value]) => {
      if (value !== null && value !== undefined) form.set(key, String(value));
    });
    form.set('cleanupMode', cleanupMode);
    form.set('pastedText', pastedText);
    if (file) form.set('file', file);

    const response = await authenticatedFetch('/api/admin/content-import', { method: 'POST', body: form });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      toast({ title: 'Import preview failed', description: data.error, variant: 'destructive' });
      return;
    }
    setPreviewItems(data.items || []);
    setBatchId(data.batch?.id || null);
    setWarnings(data.warnings || []);
    toast({ title: 'Preview ready', description: `${data.items?.length || 0} item(s) detected.` });
  }

  function addManualItem() {
    if (!requireMapping()) return;
    setPreviewItems((current) => [emptyManualItem(contentType), ...current]);
    setBatchId(null);
  }

  function updateItemField(itemId: string, field: string, value: string) {
    setPreviewItems((current) => current.map((item) => item.id === itemId ? { ...item, fields: { ...item.fields, [field]: value } } : item));
  }

  function toggleInclude(itemId: string) {
    setPreviewItems((current) => current.map((item) => item.id === itemId ? { ...item, include: !item.include } : item));
  }

  async function importSelected() {
    if (!requireMapping()) return;
    setImporting(true);
    const response = await authenticatedFetch('/api/admin/content-import', {
      method: 'PUT',
      body: JSON.stringify({
        ...mappingPayload(),
        batchId,
        source: batchId ? 'preview' : 'manual',
        filename: file?.name || null,
        runIntegrity,
        items: previewItems,
      }),
    });
    const data = await response.json();
    setImporting(false);
    if (!response.ok) {
      toast({ title: 'Import failed', description: data.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Import complete', description: `${data.inserted} item(s) saved as inactive drafts.` });
    setPreviewItems([]);
    setBatchId(null);
  }

  const fieldLabels = contentType === 'mcq'
    ? [['question', 'Question'], ['option_a', 'Option A'], ['option_b', 'Option B'], ['option_c', 'Option C'], ['option_d', 'Option D'], ['correct_option', 'Answer'], ['rationale', 'Rationale']]
    : contentType === 'flashcards'
      ? [['front', 'Front'], ['back', 'Back']]
      : [['case', 'Case'], ['prompt', 'Prompt'], ['ideal_answer', 'Ideal answer'], ['coaching_feedback', 'Coaching feedback']];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FileUp className="w-6 h-6 text-primary" />
          Content Import and Manual Authoring
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Import or manually author inactive drafts mapped to stored blueprint metadata.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Blueprint Mapping</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-4 gap-3">
            <div>
              <Label>Category</Label>
              <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Select...</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Exam Track</Label>
              <select value={selectedTrack} onChange={(event) => setSelectedTrack(event.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Select...</option>
                {tracks.map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Domain / Topic</Label>
              <select value={selectedTopic} onChange={(event) => setSelectedTopic(event.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Select...</option>
                {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
              </select>
            </div>
            <div>
              <Label>Competency / Subtopic</Label>
              <select value={selectedSubtopic} onChange={(event) => setSelectedSubtopic(event.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Optional...</option>
                {subtopics.map((subtopic) => <option key={subtopic.id} value={subtopic.id}>{subtopic.title}</option>)}
              </select>
            </div>
          </div>
          {blueprintItems.length > 0 && (
            <div>
              <Label>Applied Knowledge Statement</Label>
              <select value={selectedBlueprintItem} onChange={(event) => setSelectedBlueprintItem(event.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Optional...</option>
                {selectableBlueprintItems.map((item) => (
                  <option key={item.id} value={item.id}>{item.major_content_area} — {item.competency_section} — {item.applied_knowledge_statement}</option>
                ))}
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Input</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-5 gap-3">
            <div>
              <Label>Content Type</Label>
              <select value={contentType} onChange={(event) => { const next = event.target.value as ContentType; setContentType(next); setPreviewItems([]); }} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                {contentTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <div>
              <Label>Cleanup Mode</Label>
              <select value={cleanupMode} onChange={(event) => setCleanupMode(event.target.value as CleanupMode)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                {cleanupModes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <div>
              <Label>Difficulty</Label>
              <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as 'medium' | 'hard')} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <Label>Cognitive Level</Label>
              <Input value={cognitiveLevel} onChange={(event) => setCognitiveLevel(event.target.value)} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={runIntegrity} onChange={(event) => setRunIntegrity(event.target.checked)} />
                Run integrity review
              </label>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Upload PDF, DOCX, TXT, or CSV</Label>
              <Input type="file" accept=".pdf,.docx,.txt,.csv" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            </div>
            <div>
              <Label>Paste Text</Label>
              <Textarea rows={6} value={pastedText} onChange={(event) => setPastedText(event.target.value)} placeholder="Question:\nA. ...\nB. ...\nAnswer: B\nRationale: ..." />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={previewImport} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
              Parse Preview
            </Button>
            <Button variant="outline" onClick={addManualItem}>Add Manual {contentType === 'mcq' ? 'MCQ' : contentType === 'flashcards' ? 'Flashcard' : 'Vignette'}</Button>
          </div>
          {warnings.map((warning) => <p key={warning} className="text-sm text-amber-700">{warning}</p>)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Import Preview</CardTitle>
            <Badge variant="secondary">{previewItems.filter((item) => item.include).length}/{previewItems.length} selected</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {previewItems.length === 0 && <p className="text-sm text-muted-foreground">No preview items yet.</p>}
          {previewItems.map((item) => (
            <div key={item.id} className="rounded-md border p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={item.include} onChange={() => toggleInclude(item.id)} />
                  Include item
                </label>
                <div className="flex gap-2">
                  <Badge variant={item.validationErrors.length ? 'destructive' : 'secondary'}>{item.validationErrors.length ? 'Needs edits' : 'Valid'}</Badge>
                  <Badge variant="outline">Confidence {item.confidence}%</Badge>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {fieldLabels.map(([field, label]) => (
                  <div key={field} className={field === 'question' || field === 'case' || field === 'rationale' || field === 'ideal_answer' ? 'md:col-span-2' : ''}>
                    <Label>{label}</Label>
                    <Textarea value={item.fields[field] || ''} onChange={(event) => updateItemField(item.id, field, event.target.value)} rows={field === 'question' || field === 'case' ? 3 : 2} />
                  </div>
                ))}
              </div>
              {item.validationErrors.length > 0 && <p className="text-sm text-destructive">{item.validationErrors.join('; ')}</p>}
              <details className="text-xs text-muted-foreground">
                <summary>Original extracted text</summary>
                <pre className="mt-2 whitespace-pre-wrap rounded bg-muted p-2">{item.originalText}</pre>
              </details>
            </div>
          ))}
          {previewItems.length > 0 && (
            <Button onClick={importSelected} disabled={importing || previewItems.every((item) => !item.include)}>
              {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Import Selected as Drafts
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
