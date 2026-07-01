'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Edit, Loader2, Send, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { authenticatedFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { ExamTrack, Question, Topic } from '@/types/database';

interface ReviewQuestion extends Question {
  exam_track?: Pick<ExamTrack, 'name' | 'slug'>;
  topic?: Pick<Topic, 'title'>;
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
>;

export default function ReviewQuestionsPage() {
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const { toast } = useToast();

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    const response = await authenticatedFetch('/api/admin/questions?pendingAi=true');
    const data = await response.json();

    if (!response.ok) {
      toast({ title: 'Could not load questions', description: data.error, variant: 'destructive' });
    } else {
      setQuestions((data.questions as ReviewQuestion[]) || []);
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

  async function publish(question: ReviewQuestion) {
    if (await updateQuestion(question.id, { reviewed: true, active: true })) {
      setQuestions((current) => current.filter((item) => item.id !== question.id));
      toast({ title: 'Question published' });
    }
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

  function setEditField<K extends keyof EditState>(key: K, value: EditState[K]) {
    setEditState((current) => current ? { ...current, [key]: value } : current);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">AI Question Review</h1>
        <p className="text-sm text-muted-foreground mt-1">Review generated MCQs before students can see them.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : questions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">No AI-generated questions are pending review.</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {questions.map((question) => {
            const isEditing = editingId === question.id && editState;
            const optionKeys = ['a', 'b', 'c', 'd'] as const;

            return (
              <Card key={question.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle className="text-base">{(question.exam_track as any)?.name || 'Unknown Track'}</CardTitle>
                    <div className="flex flex-wrap gap-2">
                      {(question.topic as any)?.title && <Badge variant="outline">{(question.topic as any).title}</Badge>}
                      {question.subtopic && <Badge variant="secondary">{question.subtopic}</Badge>}
                      <Badge variant="outline">Score {question.quality_score ?? 'n/a'}</Badge>
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
