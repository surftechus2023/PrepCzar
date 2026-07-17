'use client';

import { Suspense, useCallback, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronRight, ArrowLeft, RefreshCw, Trophy, Send, BookOpen, ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { authenticatedFetch } from '@/lib/api';
import type { CaseVignette, Exam, PracticeSession } from '@/types/database';

export default function VignettesPage() {
  return (
    <Suspense fallback={<VignettesLoading />}>
      <VignettesContent />
    </Suspense>
  );
}

function VignettesLoading() {
  return (
    <div className="flex items-center justify-center py-24">
      <RefreshCw className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

function VignettesContent() {
  const searchParams = useSearchParams();
  const examId = searchParams.get('exam');
  const sessionId = searchParams.get('session');
  const startNew = searchParams.get('start') === 'new';
  const router = useRouter();
  const { profile } = useAuth();

  const [exam, setExam] = useState<Exam | null>(null);
  const [vignettes, setVignettes] = useState<CaseVignette[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [completed, setCompleted] = useState(false);
  const [lang, setLang] = useState<'en' | 'es' | 'fr'>('en');
  const [showIdeal, setShowIdeal] = useState(false);
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [resumableSession, setResumableSession] = useState<PracticeSession | null>(null);

  useEffect(() => {
    if (profile?.preferred_language) setLang((profile.preferred_language as any) || 'en');
  }, [profile]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setResumableSession(null);
    setCompleted(false);
    setVignettes([]);
    setAnswer('');
    setSubmitted(false);
    setShowIdeal(false);

    if (!profile) {
      setLoading(false);
      return;
    }

    let targetExamId = examId;
    let resumedSession: PracticeSession | null = null;

    if (sessionId) {
      const sessionRes = await authenticatedFetch(`/api/dashboard/practice-session?sessionId=${sessionId}`);
      const sessionJson = await sessionRes.json();
      const sess = sessionRes.ok ? sessionJson.session as PracticeSession | null : null;
      if (!sess) {
        setLoadError(sessionJson.error || 'Vignette session not found.');
        setLoading(false);
        return;
      }
      resumedSession = sess;
      setSession(sess);
      targetExamId = sess.exam_track_id || sess.exam_id;
      if (sess.completed) setCompleted(true);
      if (typeof (sess as any).current_index === 'number') setCurrentIdx((sess as any).current_index);
    }

    if (!targetExamId) {
      const accessRes = await authenticatedFetch('/api/dashboard/access');
      const accessJson = await accessRes.json();
      targetExamId = accessJson.access?.[0]?.exam_track_id || null;

      if (targetExamId) {
        router.replace(`/dashboard/practice/vignettes?exam=${targetExamId}`);
        return;
      }

      setLoading(false);
      return;
    }

    const sessionParam = sessionId ? `&session=${sessionId}` : '';
    const contentRes = await authenticatedFetch(`/api/dashboard/practice-content?type=vignettes&exam=${targetExamId}${sessionParam}`);
    const contentJson = await contentRes.json();

    if (!contentRes.ok) {
      if (contentRes.status === 403) router.push('/dashboard/subscriptions');
      setLoadError(contentJson.error || 'Could not load case vignettes.');
      setLoading(false);
      return;
    }

    if (contentJson.track) {
      setExam({ id: contentJson.track.id, name: contentJson.track.name } as any);
    }

    if (!sessionId && !startNew && contentJson.incompleteSession) {
      setResumableSession(contentJson.incompleteSession as PracticeSession);
      setLoading(false);
      return;
    }

    setLoading(false);

    if (contentJson.content?.length > 0) {
      const existingIds = (resumedSession as any)?.content_item_ids || [];
      const byId = new Map((contentJson.content as CaseVignette[]).map((vignette) => [vignette.id, vignette]));
      const orderedVignettes = Array.isArray(existingIds) && existingIds.length
        ? existingIds.map((id: string) => byId.get(id)).filter(Boolean) as CaseVignette[]
        : [...contentJson.content].sort(() => Math.random() - 0.5);
      setVignettes(orderedVignettes);

      if (!sessionId) try {
        const sessionRes = await authenticatedFetch('/api/dashboard/practice-session', {
          method: 'POST',
          body: JSON.stringify({
            examTrackId: targetExamId,
            mode: 'vignette',
            contentItemIds: orderedVignettes.map((vignette: CaseVignette) => vignette.id),
          }),
        });
        const sessionJson = await sessionRes.json();
        if (sessionRes.ok) setSession(sessionJson.session);
      } catch (err) {
        console.error('Could not create vignette session:', err);
      }
    }
  }, [examId, profile, router, sessionId, startNew]);

  useEffect(() => {
    if (profile) loadData();
  }, [loadData, profile]);

  const current = vignettes[currentIdx];

  function get(field: string, card: CaseVignette): string {
    const key = `${field}_${lang}` as keyof CaseVignette;
    const fallback = `${field}_en` as keyof CaseVignette;
    return (card[key] as string) || (card[fallback] as string) || '';
  }

  async function handleSubmit() {
    if (!answer.trim()) return;
    if (session && current && exam?.id) {
      await authenticatedFetch('/api/dashboard/vignette-response', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: session.id,
          examTrackId: exam.id,
          caseVignetteId: current.id,
          responseText: answer,
        }),
      });
    }
    setSubmitted(true);
  }

  async function handleNext() {
    setAnswer('');
    setSubmitted(false);
    setShowIdeal(false);
    if (currentIdx < vignettes.length - 1) {
      if (session) {
        await authenticatedFetch('/api/dashboard/practice-session', {
          method: 'PUT',
          body: JSON.stringify({
            sessionId: session.id,
            progressOnly: true,
            currentIndex: currentIdx + 1,
          }),
        });
      }
      setCurrentIdx(currentIdx + 1);
    } else {
      if (session && profile) {
        await authenticatedFetch('/api/dashboard/practice-session', {
          method: 'PATCH',
          body: JSON.stringify({
            sessionId: session.id,
            scorePercent: 100,
            weakTopics: [],
          }),
        });
      }
      setCompleted(true);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center py-24">
        <BookOpen className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-4">Could Not Load Vignettes</h2>
        <p className="text-muted-foreground mb-6">{loadError}</p>
        <Button asChild><Link href="/dashboard">Back to Dashboard</Link></Button>
      </div>
    );
  }

  if (resumableSession && examId) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center py-24">
        <BookOpen className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-4">Continue Previous Vignette Session?</h2>
        <p className="text-muted-foreground mb-6">
          You have an unfinished case vignette session. Continue where you left off or start a fresh scrambled set.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild>
            <Link href={`/dashboard/practice/vignettes?session=${resumableSession.id}`}>Continue Session</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/dashboard/practice/vignettes?exam=${examId}&start=new`}>Start New Session</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center py-12">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Trophy className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Session Complete!</h2>
        <p className="text-muted-foreground mb-8">You reviewed {vignettes.length} case vignettes</p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" asChild>
            <Link href="/dashboard"><ArrowLeft className="w-4 h-4 mr-2" />Dashboard</Link>
          </Button>
          <Button onClick={() => router.push(`/dashboard/practice/vignettes?exam=${session?.exam_track_id || session?.exam_id || examId}&start=new`)}>
            <RefreshCw className="w-4 h-4 mr-2" />New Session
          </Button>
        </div>
      </div>
    );
  }

  if (vignettes.length === 0) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center py-24">
        <BookOpen className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-4">No Vignettes Available</h2>
        <p className="text-muted-foreground mb-6">Case vignettes for this exam are coming soon.</p>
        <Button asChild><Link href="/dashboard">Back to Dashboard</Link></Button>
      </div>
    );
  }

  const progress = (currentIdx / vignettes.length) * 100;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard"><ArrowLeft className="w-4 h-4 mr-1" />Exit</Link>
          </Button>
          <div>
            <h1 className="font-semibold text-foreground text-sm">{exam?.name}</h1>
            <p className="text-xs text-muted-foreground">Case Vignette Coaching</p>
          </div>
        </div>

        <div className="flex gap-1">
          {(['en', 'es', 'fr'] as const).map((l) => (
            <button key={l} onClick={() => setLang(l)}
              className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${lang === l ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
            >{l.toUpperCase()}</button>
          ))}
        </div>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span>Case {currentIdx + 1} of {vignettes.length}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {current && (
        <>
          {/* Case scenario */}
          <Card className="mb-4 border-border">
            <CardContent className="p-6">
              <Badge variant="secondary" className="mb-4">Clinical Case</Badge>
              <p className="text-foreground leading-relaxed whitespace-pre-line">
                {get('case', current)}
              </p>
            </CardContent>
          </Card>

          {/* Prompt */}
          <Card className="mb-4 border-primary/30 bg-primary/5">
            <CardContent className="p-5">
              <p className="font-semibold text-foreground mb-1 text-sm">Your Task:</p>
              <p className="text-foreground">{get('prompt', current)}</p>
            </CardContent>
          </Card>

          {/* Answer area */}
          {!submitted ? (
            <div className="mb-4">
              <Textarea
                placeholder="Write your response here. Consider the key clinical factors, ethical considerations, and your recommended approach..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                className="min-h-[160px] mb-3 resize-none"
              />
              <Button onClick={handleSubmit} disabled={!answer.trim()} className="w-full">
                <Send className="w-4 h-4 mr-2" />
                Submit Response
              </Button>
            </div>
          ) : (
            <div className="space-y-4 mb-4">
              {/* Student's answer */}
              <Card className="border-border">
                <CardContent className="p-5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Your Response</p>
                  <p className="text-foreground text-sm leading-relaxed">{answer}</p>
                </CardContent>
              </Card>

              {/* Coaching feedback */}
              <Card className="border-emerald-300 bg-emerald-50 dark:bg-emerald-950 dark:border-emerald-800">
                <CardContent className="p-5">
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-3">
                    Stored Coaching Feedback
                  </p>
                  <p className="text-emerald-900 dark:text-emerald-200 text-sm leading-relaxed">
                    {get('coaching_feedback', current)}
                  </p>
                </CardContent>
              </Card>

              {/* Ideal answer (collapsible) */}
              <div>
                <button
                  onClick={() => setShowIdeal(!showIdeal)}
                  className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${showIdeal ? 'rotate-180' : ''}`} />
                  {showIdeal ? 'Hide' : 'Show'} Ideal Answer
                </button>
                {showIdeal && (
                  <Card className="mt-3 border-primary/30 bg-primary/5">
                    <CardContent className="p-5">
                      <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Ideal Answer</p>
                      <p className="text-foreground text-sm leading-relaxed whitespace-pre-line">
                        {get('ideal_answer', current)}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>

              <Button onClick={handleNext} className="w-full">
                {currentIdx < vignettes.length - 1 ? (
                  <>Next Case <ChevronRight className="w-4 h-4 ml-2" /></>
                ) : (
                  <>Complete Session <Trophy className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
