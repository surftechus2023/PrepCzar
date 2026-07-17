'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Edit, Loader2, RefreshCw, Send, ShieldCheck, Sparkles, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { authenticatedFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { ExamTrack, Question, QuestionCommitteeReview, QuestionRevision, SocialWorkBlueprintItem, Topic } from '@/types/database';

interface ReviewQuestion extends Question {
  exam_track?: Pick<ExamTrack, 'name' | 'slug' | 'official_source_url' | 'official_exam_description' | 'aswb_exam_level'>;
  topic?: Pick<Topic, 'title' | 'description' | 'official_blueprint_text' | 'official_weight_percent'>;
  subtopic_record?: {
    title?: string | null;
    description?: string | null;
    learning_objective?: string | null;
    official_blueprint_text?: string | null;
  } | null;
  social_work_blueprint_item?: Pick<
    SocialWorkBlueprintItem,
    | 'id'
    | 'exam_level'
    | 'major_content_area'
    | 'percentage_weight'
    | 'competency_section'
    | 'applied_knowledge_statement'
    | 'cognitive_level_guidance'
    | 'official_blueprint_text'
    | 'sample_style_guidance'
  > | null;
  question_revisions?: Pick<QuestionRevision, 'id' | 'revision_number' | 'revision_type' | 'failure_reasons' | 'improvement_notes' | 'model_used' | 'created_at'>[];
  question_committee_reviews?: Pick<QuestionCommitteeReview, 'id' | 'reviewer_role' | 'model_used' | 'vote' | 'score' | 'reason' | 'required_changes' | 'created_at'>[];
}

type EditState = Pick<
  Question,
  | 'question_en'
  | 'option_a_en'
  | 'option_b_en'
  | 'option_c_en'
  | 'option_d_en'
  | 'correct_option'
  | 'rationale_en'
  | 'option_a_rationale_en'
  | 'option_b_rationale_en'
  | 'option_c_rationale_en'
  | 'option_d_rationale_en'
  | 'test_taking_tip_en'
  | 'subtopic'
  | 'learning_objective'
  | 'blueprint_reference_text'
>;

export default function ReviewQuestionsPage() {
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [tracks, setTracks] = useState<ExamTrack[]>([]);
  const [topics, setTopics] = useState<Pick<Topic, 'id' | 'exam_track_id' | 'title'>[]>([]);
  const [filterTrack, setFilterTrack] = useState('');
  const [filterTopic, setFilterTopic] = useState('');
  const [sortBy, setSortBy] = useState<'created' | 'track'>('created');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [improvingId, setImprovingId] = useState<string | null>(null);
  const [pipelineAction, setPipelineAction] = useState<{ questionId: string; action: string } | null>(null);
  const { toast } = useToast();

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    const response = await authenticatedFetch('/api/admin/questions?pendingAi=true');
    const data = await response.json();

    if (!response.ok) {
      toast({ title: 'Could not load questions', description: data.error, variant: 'destructive' });
    } else {
      setQuestions((data.questions as ReviewQuestion[]) || []);
      setTracks((data.tracks as ExamTrack[]) || []);
      setTopics((data.topics as Pick<Topic, 'id' | 'exam_track_id' | 'title'>[]) || []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  async function updateQuestion(id: string, values: Partial<Question>) {
    const response = await authenticatedFetch('/api/admin/questions', {
      method: 'PATCH',
      body: JSON.stringify({ id, values }),
    });
    const data = await response.json();

    if (!response.ok) {
      toast({ title: 'Update failed', description: data.error, variant: 'destructive' });
      return false;
    }

    setQuestions((current) => current.map((question) => question.id === id ? data.question : question));
    return true;
  }

  async function approve(question: ReviewQuestion) {
    if (await updateQuestion(question.id, { reviewed: true })) {
      setQuestions((current) => current.filter((item) => item.id !== question.id));
      toast({ title: 'Question approved' });
    }
  }

  async function publish(question: ReviewQuestion, forceOverride = false) {
    const missingBlueprintMetadata = missingBlueprintFields(question);
    if (missingBlueprintMetadata.length > 0) {
      toast({
        title: 'Missing blueprint metadata',
        description: 'Update topic/subtopic blueprint metadata and rerun integrity before publishing.',
        variant: 'destructive',
      });
      return;
    }

    const canPublish = question.integrity_status === 'passed'
      && question.committee_status === 'approved'
      && (question.blueprint_alignment_score ?? 0) >= 90
      && (question.difficulty_quality_score ?? 0) >= 80
      && (question.integrity_score ?? 0) >= 85
      && question.difficulty !== 'easy'
      && (question.plagiarism_risk_score ?? 0) <= 70;
    let overrideReason: string | undefined;

    if (!canPublish || forceOverride) {
      const reason = window.prompt('Publication gate has not passed. Enter an admin override reason to publish anyway:');
      if (!reason?.trim()) {
        toast({ title: 'Publish canceled', description: 'Override reason is required when the publication gate has not passed.' });
        return;
      }
      overrideReason = reason.trim();
    }

    const response = await authenticatedFetch('/api/admin/publish-question', {
      method: 'POST',
      body: JSON.stringify({ question_id: question.id, override_reason: overrideReason }),
    });
    const data = await response.json();

    if (!response.ok) {
      toast({ title: 'Publish failed', description: data.error, variant: 'destructive' });
      return;
    }

    if (data.question) {
      setQuestions((current) => current.filter((item) => item.id !== question.id));
    }
    toast({ title: data.overridden ? 'Question published with override' : 'Question published' });
  }

  async function reject(question: ReviewQuestion) {
    if (await updateQuestion(question.id, { reviewed: true, active: false, review_notes: `${question.review_notes || ''}\nRejected by admin.`.trim() })) {
      setQuestions((current) => current.filter((item) => item.id !== question.id));
      toast({ title: 'Question rejected', description: 'It remains inactive.' });
    }
  }

  function startEdit(question: ReviewQuestion) {
    setEditingId(question.id);
    setEditState({
      question_en: question.question_en,
      option_a_en: question.option_a_en,
      option_b_en: question.option_b_en,
      option_c_en: question.option_c_en,
      option_d_en: question.option_d_en,
      correct_option: question.correct_option,
      rationale_en: question.rationale_en,
      option_a_rationale_en: question.option_a_rationale_en,
      option_b_rationale_en: question.option_b_rationale_en,
      option_c_rationale_en: question.option_c_rationale_en,
      option_d_rationale_en: question.option_d_rationale_en,
      test_taking_tip_en: question.test_taking_tip_en,
      subtopic: question.subtopic,
      learning_objective: question.learning_objective,
      blueprint_reference_text: question.blueprint_reference_text,
    });
  }

  async function saveEdit(question: ReviewQuestion) {
    if (!editState) return;

    const saved = await updateQuestion(question.id, {
      ...editState,
      correct_rationale_en: editState.rationale_en,
    });

    if (saved) {
      setEditingId(null);
      setEditState(null);
      toast({ title: 'Question updated' });
    }
  }

  async function rerunIntegrityCheck(question: ReviewQuestion) {
    setCheckingId(question.id);
    const response = await authenticatedFetch('/api/admin/check-question-integrity', {
      method: 'POST',
      body: JSON.stringify({ question_id: question.id }),
    });
    const data = await response.json();
    setCheckingId(null);

    if (!response.ok) {
      toast({ title: 'Integrity check failed', description: data.error, variant: 'destructive' });
      return;
    }

    const updatedQuestion = data.results?.[0]?.question as ReviewQuestion | undefined;
    if (updatedQuestion) {
      setQuestions((current) => current.map((item) => item.id === question.id ? updatedQuestion : item));
    }
    toast({ title: 'Integrity check complete', description: `Score ${data.results?.[0]?.score ?? 'n/a'} - ${data.results?.[0]?.status ?? 'unknown'}` });
  }

  async function autoImproveAndRecheck(question: ReviewQuestion) {
    setImprovingId(question.id);
    const response = await authenticatedFetch('/api/admin/improve-question', {
      method: 'POST',
      body: JSON.stringify({ question_id: question.id }),
    });
    const data = await response.json();
    setImprovingId(null);

    if (!response.ok) {
      toast({ title: 'Auto-improvement failed', description: data.error, variant: 'destructive' });
      return;
    }

    if (data.question) {
      setQuestions((current) => current.map((item) => item.id === question.id ? data.question : item));
    }

    toast({ title: 'Auto-improve complete', description: `Score ${data.score ?? 'n/a'} - ${data.status ?? 'unknown'}` });
  }

  async function runPipelineAction(question: ReviewQuestion, endpoint: string, action: string) {
    setPipelineAction({ questionId: question.id, action });
    const response = await authenticatedFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify({ question_id: question.id }),
    });
    const data = await response.json();
    setPipelineAction(null);

    if (!response.ok) {
      toast({ title: `${action} failed`, description: data.error, variant: 'destructive' });
      return;
    }

    const updatedQuestion = data.question || data.review?.question;
    if (updatedQuestion) {
      setQuestions((current) => current.map((item) => item.id === question.id ? updatedQuestion : item));
    } else {
      await loadQuestions();
    }
    toast({ title: `${action} complete`, description: data.status ? `Status: ${data.status}` : undefined });
  }

  function setEditField<K extends keyof EditState>(key: K, value: EditState[K]) {
    setEditState((current) => current ? { ...current, [key]: value } : current);
  }

  function flagList(value: unknown) {
    return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
  }

  function objectValue(value: unknown, key: string) {
    return value && typeof value === 'object' && key in value
      ? (value as Record<string, unknown>)[key]
      : undefined;
  }

  function reviewerSummary(question: ReviewQuestion, key: string) {
    const review = objectValue(question.editorial_review, key);
    if (!review || typeof review !== 'object') return null;
    return review as Record<string, unknown>;
  }

  function integrityBadgeVariant(status: Question['integrity_status']) {
    if (status === 'passed') return 'default';
    if (status === 'failed' || status === 'needs_human_review' || status === 'rejected') return 'destructive';
    return 'secondary';
  }

  function isMissingBlueprintValue(value: unknown) {
    if (typeof value !== 'string') return value === null || value === undefined;
    return !value.trim() || /^legacy item/i.test(value.trim()) || value.trim() === 'Not provided';
  }

  function missingBlueprintFields(question: ReviewQuestion) {
    return [
      ['Official source URL', question.exam_track?.official_source_url],
      ['Exam description', question.exam_track?.official_exam_description],
      ['ASWB exam level', question.exam_track?.aswb_exam_level || question.social_work_blueprint_item?.exam_level],
      ['Major content area', question.blueprint_content_area || question.social_work_blueprint_item?.major_content_area],
      ['Competency section', question.blueprint_competency_section || question.social_work_blueprint_item?.competency_section],
      ['Applied knowledge statement', question.applied_knowledge_statement || question.social_work_blueprint_item?.applied_knowledge_statement],
      ['Cognitive level target', question.intended_cognitive_level || question.cognitive_level],
      ['Difficulty target', question.difficulty],
      ['Question-writing guideline', question.question_writing_guideline || question.social_work_blueprint_item?.sample_style_guidance],
      ['Topic blueprint text', question.topic?.official_blueprint_text],
      ['Subtopic blueprint text', question.subtopic_record?.official_blueprint_text || question.social_work_blueprint_item?.official_blueprint_text],
      ['Blueprint reference text', question.blueprint_reference_text || question.social_work_blueprint_item?.official_blueprint_text],
    ].filter(([, value]) => isMissingBlueprintValue(value)).map(([label]) => label);
  }

  const visibleQuestions = questions
    .filter((question) => (!filterTrack || question.exam_track_id === filterTrack) && (!filterTopic || question.topic_id === filterTopic))
    .sort((left, right) => {
      if (sortBy === 'track') {
        const leftTrack = (left.exam_track as any)?.name || '';
        const rightTrack = (right.exam_track as any)?.name || '';
        return leftTrack.localeCompare(rightTrack) || String(right.created_at || '').localeCompare(String(left.created_at || ''));
      }
      return String(right.created_at || '').localeCompare(String(left.created_at || ''));
    });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Question Review</h1>
        <p className="text-sm text-muted-foreground mt-1">Review generated and imported MCQs before students can see them.</p>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <select
          value={filterTrack}
          onChange={(event) => setFilterTrack(event.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All Exam Tracks</option>
          {tracks.map((track) => (
            <option key={track.id} value={track.id}>{track.name}</option>
          ))}
        </select>
        <select
          value={filterTopic}
          onChange={(event) => setFilterTopic(event.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All Exam Topics</option>
          {topics
            .filter((topic) => !filterTrack || topic.exam_track_id === filterTrack)
            .map((topic) => (
              <option key={topic.id} value={topic.id}>{topic.title}</option>
            ))}
        </select>
        <select
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value as 'created' | 'track')}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="created">Newest First</option>
          <option value="track">Sort by Exam Track</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : visibleQuestions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">No generated or imported questions match this review filter.</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {visibleQuestions.map((question) => {
            const isEditing = editingId === question.id && editState;
            const optionKeys = ['a', 'b', 'c', 'd'] as const;
            const missingBlueprintMetadata = missingBlueprintFields(question);

            return (
              <Card key={question.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle className="text-base">{(question.exam_track as any)?.name || 'Unknown Track'}</CardTitle>
                    <div className="flex flex-wrap gap-2">
                      {(question.topic as any)?.title && <Badge variant="outline">{(question.topic as any).title}</Badge>}
                      {question.subtopic && <Badge variant="secondary">{question.subtopic}</Badge>}
                      <Badge variant="outline">Score {question.quality_score ?? 'n/a'}</Badge>
                      <Badge variant={integrityBadgeVariant(question.integrity_status)}>
                        Integrity {question.integrity_score ?? 0} - {question.integrity_status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div>
                        <Label>Question</Label>
                        <Textarea value={editState.question_en} onChange={(event) => setEditField('question_en', event.target.value)} />
                      </div>
                      <div className="grid md:grid-cols-2 gap-3">
                        {optionKeys.map((option) => (
                          <div key={option}>
                            <Label>Option {option.toUpperCase()}</Label>
                            <Input value={editState[`option_${option}_en`]} onChange={(event) => setEditField(`option_${option}_en`, event.target.value)} />
                          </div>
                        ))}
                      </div>
                      <div>
                        <Label>Correct Option</Label>
                        <select value={editState.correct_option} onChange={(event) => setEditField('correct_option', event.target.value as EditState['correct_option'])} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                          {optionKeys.map((option) => <option key={option} value={option}>{option.toUpperCase()}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label>Correct Rationale</Label>
                        <Textarea value={editState.rationale_en} onChange={(event) => setEditField('rationale_en', event.target.value)} />
                      </div>
                      <div className="grid md:grid-cols-2 gap-3">
                        {optionKeys.map((option) => (
                          <div key={option}>
                            <Label>Option {option.toUpperCase()} Rationale</Label>
                            <Textarea value={editState[`option_${option}_rationale_en`] || ''} onChange={(event) => setEditField(`option_${option}_rationale_en`, event.target.value)} />
                          </div>
                        ))}
                      </div>
                      <div>
                        <Label>Test-Taking Tip</Label>
                        <Textarea value={editState.test_taking_tip_en || ''} onChange={(event) => setEditField('test_taking_tip_en', event.target.value)} />
                      </div>
                      <div className="grid md:grid-cols-2 gap-3">
                        <div>
                          <Label>Subtopic</Label>
                          <Input value={editState.subtopic || ''} onChange={(event) => setEditField('subtopic', event.target.value)} />
                        </div>
                        <div>
                          <Label>Learning Objective</Label>
                          <Input value={editState.learning_objective || ''} onChange={(event) => setEditField('learning_objective', event.target.value)} />
                        </div>
                      </div>
                      <div>
                        <Label>Blueprint Reference Text</Label>
                        <Textarea value={editState.blueprint_reference_text || ''} onChange={(event) => setEditField('blueprint_reference_text', event.target.value)} />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-base font-medium leading-relaxed">{question.question_en}</p>
                      <div className="grid md:grid-cols-2 gap-3">
                        {optionKeys.map((option) => (
                          <div key={option} className={`rounded-md border p-3 text-sm ${question.correct_option === option ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950' : 'border-border'}`}>
                            <p><span className="font-bold">{option.toUpperCase()}.</span> {(question as any)[`option_${option}_en`]}</p>
                            <p className="text-muted-foreground mt-2">{(question as any)[`option_${option}_rationale_en`] || 'No rationale provided.'}</p>
                          </div>
                        ))}
                      </div>
                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="font-medium mb-1">Correct Rationale</p>
                          <p className="text-muted-foreground">{question.correct_rationale_en || question.rationale_en}</p>
                        </div>
                        <div>
                          <p className="font-medium mb-1">Test-Taking Tip</p>
                          <p className="text-muted-foreground">{question.test_taking_tip_en || 'No tip provided.'}</p>
                        </div>
                      </div>
                      <div className="text-sm">
                        <p><span className="font-medium">Learning objective:</span> {question.learning_objective || 'None'}</p>
                        <p><span className="font-medium">Review notes:</span> {question.review_notes || 'None'}</p>
                      </div>
                      <Collapsible className="rounded-md border bg-muted/20 p-4 text-sm">
                        <CollapsibleTrigger className="font-medium text-left">
                          Blueprint context used for generation and integrity check
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3 space-y-2 text-muted-foreground">
                          {missingBlueprintMetadata.length > 0 && (
                            <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                              Missing blueprint metadata — update topic/subtopic before generating or reviewing. Missing: {missingBlueprintMetadata.join(', ')}
                            </p>
                          )}
                          <p><span className="font-medium text-foreground">Exam track:</span> {(question.exam_track as any)?.name || 'Unknown'}</p>
                          <p><span className="font-medium text-foreground">Official source URL:</span> {(question.exam_track as any)?.official_source_url || 'Not provided'}</p>
                          <p><span className="font-medium text-foreground">Exam description:</span> {(question.exam_track as any)?.official_exam_description || 'Not provided'}</p>
                          <p><span className="font-medium text-foreground">ASWB exam level:</span> {(question.exam_track as any)?.aswb_exam_level || question.social_work_blueprint_item?.exam_level || 'Not provided'}</p>
                          <p><span className="font-medium text-foreground">Major content area:</span> {question.blueprint_content_area || question.social_work_blueprint_item?.major_content_area || 'Not provided'}</p>
                          <p><span className="font-medium text-foreground">Weight:</span> {question.social_work_blueprint_item?.percentage_weight ?? (question.topic as any)?.official_weight_percent ?? 'Not provided'}</p>
                          <p><span className="font-medium text-foreground">Competency section:</span> {question.blueprint_competency_section || question.social_work_blueprint_item?.competency_section || 'Not provided'}</p>
                          <p><span className="font-medium text-foreground">Applied knowledge statement:</span> {question.applied_knowledge_statement || question.social_work_blueprint_item?.applied_knowledge_statement || 'Not provided'}</p>
                          <p><span className="font-medium text-foreground">Cognitive level target:</span> {question.intended_cognitive_level || question.cognitive_level || question.social_work_blueprint_item?.cognitive_level_guidance || 'Not provided'}</p>
                          <p><span className="font-medium text-foreground">Difficulty target:</span> {question.difficulty || 'Not provided'}</p>
                          <p><span className="font-medium text-foreground">Question-writing guideline:</span> {question.question_writing_guideline || question.social_work_blueprint_item?.sample_style_guidance || 'Not provided'}</p>
                          <p><span className="font-medium text-foreground">Topic:</span> {(question.topic as any)?.title || 'Unknown'}</p>
                          <p><span className="font-medium text-foreground">Topic description:</span> {(question.topic as any)?.description || 'Not provided'}</p>
                          <p><span className="font-medium text-foreground">Topic blueprint text:</span> {(question.topic as any)?.official_blueprint_text || 'Not provided'}</p>
                          <p><span className="font-medium text-foreground">Topic weight:</span> {(question.topic as any)?.official_weight_percent ?? 'Not provided'}</p>
                          <p><span className="font-medium text-foreground">Subtopic:</span> {(question.subtopic_record as any)?.title || question.subtopic || 'Not provided'}</p>
                          <p><span className="font-medium text-foreground">Subtopic description:</span> {(question.subtopic_record as any)?.description || 'Not provided'}</p>
                          <p><span className="font-medium text-foreground">Subtopic learning objective:</span> {(question.subtopic_record as any)?.learning_objective || 'Not provided'}</p>
                          <p><span className="font-medium text-foreground">Subtopic blueprint text:</span> {(question.subtopic_record as any)?.official_blueprint_text || 'Not provided'}</p>
                          <p><span className="font-medium text-foreground">Question learning objective:</span> {question.learning_objective || 'Not provided'}</p>
                          <div>
                            <p className="font-medium text-foreground">Blueprint reference text</p>
                            <p className="whitespace-pre-wrap">{question.blueprint_reference_text || question.social_work_blueprint_item?.official_blueprint_text || 'Not provided'}</p>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                      <div className="rounded-md border bg-secondary/20 p-4 text-sm">
                        <div className="flex items-center gap-2 font-medium mb-3">
                          <ShieldCheck className="w-4 h-4" />
                          Integrity Review
                        </div>
                        <div className="grid md:grid-cols-2 gap-2">
                          <p><span className="font-medium">Status:</span> {question.integrity_status}</p>
                          <p><span className="font-medium">Integrity score:</span> {question.integrity_score ?? 0}</p>
                          <p><span className="font-medium">Blueprint alignment:</span> {question.blueprint_alignment_score ?? 0}</p>
                          <p><span className="font-medium">Difficulty quality:</span> {question.difficulty_quality_score ?? 0}</p>
                          <p><span className="font-medium">Distractors:</span> {question.distractor_score ?? 0}</p>
                          <p><span className="font-medium">Rationales:</span> {question.rationale_score ?? 0}</p>
                          <p><span className="font-medium">Psychometric:</span> {question.psychometric_score ?? 0}</p>
                          <p><span className="font-medium">Bias/fairness:</span> {question.bias_score ?? 0}</p>
                          <p><span className="font-medium">Security/originality:</span> {question.security_score ?? 0}</p>
                          <p><span className="font-medium">Intended difficulty:</span> {question.difficulty}</p>
                          <p><span className="font-medium">Predicted difficulty:</span> {question.predicted_difficulty || 'Not checked'}</p>
                          <p><span className="font-medium">Intended cognitive level:</span> {question.intended_cognitive_level || question.cognitive_level || 'Not provided'}</p>
                          <p><span className="font-medium">Detected cognitive level:</span> {question.cognitive_level_detected || 'Not checked'}</p>
                          <p><span className="font-medium">Plagiarism risk:</span> {question.plagiarism_risk_score ?? 0}</p>
                          <p><span className="font-medium">Improvement attempts:</span> {question.improvement_attempts ?? 0}/2</p>
                          <p><span className="font-medium">Auto-improved:</span> {question.auto_improved ? 'Yes' : 'No'}</p>
                        </div>
                        <div className="mt-3 space-y-2">
                          {[
                            ['Quality flags', flagList(question.quality_flags)],
                            ['Distractor flags', flagList(question.distractor_flags)],
                            ['Bias flags', flagList(question.bias_flags)],
                            ['Failure reasons', flagList(question.failure_reasons)],
                            ['Rewrite recommendations', flagList(question.rewrite_recommendations)],
                          ].map(([label, flags]) => (
                            <div key={label as string}>
                              <p className="font-medium">{label as string}</p>
                              {(flags as string[]).length ? (
                                <ul className="list-disc pl-5 text-muted-foreground">
                                  {(flags as string[]).map((flag) => <li key={flag}>{flag}</li>)}
                                </ul>
                              ) : (
                                <p className="text-muted-foreground">None</p>
                              )}
                            </div>
                          ))}
                          <div>
                            <p className="font-medium">Integrity notes</p>
                            <p className="text-muted-foreground whitespace-pre-wrap">{question.integrity_review_notes || 'None'}</p>
                          </div>
                          <div>
                            <p className="font-medium">Improvement notes</p>
                            <p className="text-muted-foreground whitespace-pre-wrap">{question.improvement_notes || 'None'}</p>
                          </div>
                          {(question.improvement_attempts ?? 0) >= 2 && question.integrity_status !== 'passed' && (
                            <p className="text-amber-700 dark:text-amber-300">
                              Auto-improvement attempts exhausted. Manual review required.
                            </p>
                          )}
                          {question.integrity_override && (
                            <p className="text-amber-700 dark:text-amber-300">
                              Admin override recorded: {question.integrity_override_reason || 'No reason provided'}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="rounded-md border bg-muted/10 p-4 text-sm">
                        <div className="flex items-center gap-2 font-medium mb-3">
                          <ShieldCheck className="w-4 h-4" />
                          GPT Editorial Pipeline
                        </div>
                        <div className="grid md:grid-cols-2 gap-3">
                          {[
                            ['Blueprint SME', 'blueprint'],
                            ['Difficulty/Cognitive', 'difficulty'],
                            ['Distractor/Rationale', 'distractor'],
                            ['Psychometrician', 'psychometric'],
                            ['Bias/Fairness', 'bias'],
                            ['Security/Originality', 'security'],
                          ].map(([label, key]) => {
                            const review = reviewerSummary(question, key);
                            const score = objectValue(review, 'score')
                              ?? objectValue(review, `${key}_score`)
                              ?? objectValue(review, key === 'blueprint' ? 'blueprint_alignment_score' : 'difficulty_quality_score')
                              ?? 'Not run';
                            return (
                              <div key={key} className="rounded-md border p-3">
                                <p className="font-medium">{label}</p>
                                <p className="text-muted-foreground">
                                  Score: {String(score)}
                                </p>
                                <p className="text-muted-foreground whitespace-pre-wrap">
                                  {String(objectValue(review, 'explanation') || 'No reviewer explanation.')}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                        <div className="grid md:grid-cols-2 gap-2 mt-4">
                          <p><span className="font-medium">Final review status:</span> {question.final_review_status || 'pending'}</p>
                          <p><span className="font-medium">Final integrity:</span> {question.final_integrity_score ?? 0}</p>
                          <p><span className="font-medium">Committee status:</span> {question.committee_status || 'pending'}</p>
                          <p><span className="font-medium">Committee average:</span> {question.committee_average_score ?? 'Not run'}</p>
                        </div>
                        <p className="mt-2 text-muted-foreground whitespace-pre-wrap">{question.final_review_notes || question.committee_review_notes || 'No final or committee notes yet.'}</p>
                      </div>
                      <div className="rounded-md border bg-muted/10 p-4 text-sm">
                        <p className="font-medium mb-2">Revision History</p>
                        {question.question_revisions?.length ? (
                          <ul className="space-y-2 text-muted-foreground">
                            {question.question_revisions.map((revision) => (
                              <li key={revision.id}>
                                Revision {revision.revision_number} — {revision.revision_type} via {revision.model_used || 'unknown model'} on {new Date(revision.created_at).toLocaleString()}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-muted-foreground">No rewrites recorded.</p>
                        )}
                      </div>
                      <div className="rounded-md border bg-muted/10 p-4 text-sm">
                        <p className="font-medium mb-2">Committee Reviews</p>
                        {question.question_committee_reviews?.length ? (
                          <div className="space-y-2">
                            {question.question_committee_reviews.map((review) => (
                              <div key={review.id} className="rounded-md border p-3">
                                <p className="font-medium">{review.reviewer_role}: {review.vote} ({review.score})</p>
                                <p className="text-muted-foreground whitespace-pre-wrap">{review.reason}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted-foreground">No committee review has been run.</p>
                        )}
                      </div>
                      <div className="rounded-md border bg-muted/10 p-4 text-sm">
                        <p className="font-medium mb-2">Publication Checklist</p>
                        <ul className="list-disc pl-5 text-muted-foreground">
                          <li>Blueprint metadata: {missingBlueprintMetadata.length ? 'missing' : 'complete'}</li>
                          <li>Integrity status: {question.integrity_status}</li>
                          <li>Blueprint score ≥ 90: {(question.blueprint_alignment_score ?? 0) >= 90 ? 'yes' : 'no'}</li>
                          <li>Difficulty score ≥ 80: {(question.difficulty_quality_score ?? 0) >= 80 ? 'yes' : 'no'}</li>
                          <li>Integrity score ≥ 85: {(question.integrity_score ?? 0) >= 85 ? 'yes' : 'no'}</li>
                          <li>No easy questions: {question.difficulty !== 'easy' ? 'yes' : 'no'}</li>
                          <li>Duplicate/plagiarism risk ≤ 70: {(question.plagiarism_risk_score ?? 0) <= 70 ? 'yes' : 'no'}</li>
                          <li>Committee approved: {question.committee_status === 'approved' ? 'yes' : 'no'}</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2">
                    {isEditing ? (
                      <>
                        <Button size="sm" onClick={() => saveEdit(question)}>Save Edits</Button>
                        <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setEditState(null); }}>Cancel</Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" onClick={() => approve(question)}>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Approve
                        </Button>
                        <Button size="sm" onClick={() => publish(question)}>
                          <Send className="w-4 h-4 mr-2" />
                          Publish
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => publish(question, true)}>
                          <ShieldCheck className="w-4 h-4 mr-2" />
                          Admin Override
                        </Button>
                        <Button size="sm" variant="outline" disabled={checkingId === question.id} onClick={() => rerunIntegrityCheck(question)}>
                          {checkingId === question.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                          Rerun Integrity
                        </Button>
                        <Button size="sm" variant="outline" disabled={pipelineAction?.questionId === question.id} onClick={() => runPipelineAction(question, '/api/admin/run-editorial-review', 'Editorial review')}>
                          {pipelineAction?.questionId === question.id && pipelineAction.action === 'Editorial review' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                          Run Editorial Review
                        </Button>
                        <Button size="sm" variant="outline" disabled={improvingId === question.id || (question.improvement_attempts ?? 0) >= 2} onClick={() => autoImproveAndRecheck(question)}>
                          {improvingId === question.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                          Auto-Improve and Recheck
                        </Button>
                        <Button size="sm" variant="outline" disabled={pipelineAction?.questionId === question.id || (question.improvement_attempts ?? 0) >= 2} onClick={() => runPipelineAction(question, '/api/admin/auto-rewrite-question', 'Auto rewrite')}>
                          {pipelineAction?.questionId === question.id && pipelineAction.action === 'Auto rewrite' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                          Auto Rewrite
                        </Button>
                        <Button size="sm" variant="outline" disabled={pipelineAction?.questionId === question.id} onClick={() => runPipelineAction(question, '/api/admin/run-final-review', 'Final review')}>
                          {pipelineAction?.questionId === question.id && pipelineAction.action === 'Final review' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                          Run Final Review
                        </Button>
                        <Button size="sm" variant="outline" disabled={pipelineAction?.questionId === question.id} onClick={() => runPipelineAction(question, '/api/admin/run-committee-review', 'Committee review')}>
                          {pipelineAction?.questionId === question.id && pipelineAction.action === 'Committee review' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                          Run Committee Review
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => startEdit(question)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => reject(question)}>
                          <XCircle className="w-4 h-4 mr-2" />
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
