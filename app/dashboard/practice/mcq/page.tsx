'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ChevronRight, ChevronLeft, CheckCircle, XCircle, Volume2, Mic,
  MicOff, VolumeX, RefreshCw, Trophy, ArrowLeft, Bookmark
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { authenticatedFetch } from '@/lib/api';
import { useVoice } from '@/hooks/useVoice';
import { matchVoiceAnswer, type VoiceOption } from '@/lib/voice-answer';
import type { Question, Exam, PracticeSession } from '@/types/database';
import Link from 'next/link';

type AnswerMap = Record<string, 'a' | 'b' | 'c' | 'd'>;

const LANG_MAP: Record<string, 'en' | 'es' | 'fr'> = { en: 'en', es: 'es', fr: 'fr' };
const VOICE_LANG_MAP: Record<string, string> = { en: 'en-US', es: 'es-ES', fr: 'fr-FR' };

export default function MCQPracticePage() {
  return (
    <Suspense fallback={<PracticeLoading />}>
      <MCQPracticeContent />
    </Suspense>
  );
}

function PracticeLoading() {
  return (
    <div className="flex items-center justify-center h-full py-24">
      <RefreshCw className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

function MCQPracticeContent() {
  const searchParams = useSearchParams();
  const examId = searchParams.get('exam');
  const sessionId = searchParams.get('session');
  const voiceMode = searchParams.get('voice') === '1';
  const router = useRouter();
  const { profile } = useAuth();

  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [showRationale, setShowRationale] = useState(false);
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [completed, setCompleted] = useState(false);
  const [lang, setLang] = useState<'en' | 'es' | 'fr'>('en');
  const [bookmarked, setBookmarked] = useState<Record<string, boolean>>({});
  const [voiceSuggestion, setVoiceSuggestion] = useState<{ transcript: string; option?: VoiceOption } | null>(null);
  const questionStartedAt = useRef(Date.now());

  const {
    voiceEnabled,
    setVoiceEnabled,
    speaking,
    listening,
    supported,
    recognitionSupported,
    status: voiceStatus,
    voiceMessage,
    voiceError,
    transcript: voiceTranscript,
    speak,
    speakThenListen,
    stopSpeaking,
    startListening,
    stopListening,
  } = useVoice();

  useEffect(() => {
    if (voiceMode) {
      setVoiceEnabled(true);
    }
  }, [setVoiceEnabled, voiceMode]);

  useEffect(() => {
    if (profile?.preferred_language) {
      setLang(LANG_MAP[profile.preferred_language] || 'en');
    }
  }, [profile]);

  const initialize = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      return;
    }

    let targetTrackId = examId;
    let resumedSession: PracticeSession | null = null;

    // Resume existing session through the server-side access guard.
    if (sessionId) {
      const sessionRes = await authenticatedFetch(`/api/dashboard/practice-session?sessionId=${sessionId}`);
      const sessionJson = await sessionRes.json();
      const sess = sessionRes.ok ? sessionJson.session as PracticeSession | null : null;
      if (sess) {
        resumedSession = sess;
        setSession(sess);
        targetTrackId = sess.exam_track_id || sess.exam_id;
        if (sess.completed) setCompleted(true);
        if (typeof (sess as any).current_index === 'number') setCurrentIdx((sess as any).current_index);

        if (sessionJson.responses) {
          const map: AnswerMap = {};
          (sessionJson.responses as any[]).forEach((r) => { map[r.question_id] = r.selected_answer; });
          setAnswers(map);
        }
      } else {
        setLoadError(sessionJson.error || 'Practice session not found.');
        setLoading(false);
        return;
      }
    }

    if (!targetTrackId) {
      const accessRes = await authenticatedFetch('/api/dashboard/access');
      const accessJson = await accessRes.json();
      targetTrackId = accessJson.access?.[0]?.exam_track_id || null;

      if (targetTrackId) {
        const voiceParam = voiceMode ? '&voice=1' : '';
        router.replace(`/dashboard/practice/mcq?exam=${targetTrackId}${voiceParam}`);
        return;
      }

      setLoading(false);
      return;
    }

    setActiveTrackId(targetTrackId);

    const contentRes = await authenticatedFetch(`/api/dashboard/practice-content?type=mcq&exam=${targetTrackId}`);
    const contentJson = await contentRes.json();

    if (!contentRes.ok) {
      if (contentRes.status === 403) router.push('/dashboard/subscriptions');
      setLoadError(contentJson.error || 'Could not load practice questions.');
      setLoading(false);
      return;
    }

    if (contentJson.track) {
      setExam({ id: contentJson.track.id, name: contentJson.track.name } as any);
    }

    if (contentJson.content?.length > 0) {
      const existingIds = (resumedSession as any)?.content_item_ids || [];
      const byId = new Map((contentJson.content as Question[]).map((question) => [question.id, question]));
      const ordered = Array.isArray(existingIds) && existingIds.length
        ? existingIds.map((id: string) => byId.get(id)).filter(Boolean) as Question[]
        : [...contentJson.content].sort(() => Math.random() - 0.5);
      const shuffled = ordered.length ? ordered : [...contentJson.content].sort(() => Math.random() - 0.5);
      setQuestions(shuffled);

      if (!sessionId && profile) {
        try {
          await createPracticeSession(targetTrackId, shuffled.map((question) => question.id));
        } catch (err) {
          console.error('Could not create MCQ session:', err);
        }
      }
    }

    setLoading(false);
  }, [examId, profile, router, sessionId, voiceMode]);

  useEffect(() => {
    if (profile) {
      initialize();
    }
  }, [initialize, profile]);

  const currentQuestion = questions[currentIdx];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;
  const isAnswered = !!currentAnswer;

  useEffect(() => {
    questionStartedAt.current = Date.now();
  }, [currentIdx]);

  function getCorrectOption(q: Question): 'a' | 'b' | 'c' | 'd' {
    const option = String(q.correct_option || '').toLowerCase();
    return (['a', 'b', 'c', 'd'].includes(option) ? option : 'a') as 'a' | 'b' | 'c' | 'd';
  }

  async function createPracticeSession(trackId: string, contentItemIds: string[] = []) {
    const res = await authenticatedFetch('/api/dashboard/practice-session', {
      method: 'POST',
      body: JSON.stringify({ examTrackId: trackId, mode: 'mcq', contentItemIds }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Could not create practice session');
    setSession(json.session);
    return json.session as PracticeSession;
  }

  function getQuestionText(q: Question) {
    return lang === 'es' ? q.question_es || q.question_en
         : lang === 'fr' ? q.question_fr || q.question_en
         : q.question_en;
  }

  function getOptionText(q: Question, opt: 'a' | 'b' | 'c' | 'd') {
    const key = `option_${opt}_${lang}` as keyof Question;
    const fallback = `option_${opt}_en` as keyof Question;
    return (q[key] as string) || (q[fallback] as string) || '';
  }

  function getRationale(q: Question) {
    const localized = lang === 'es' ? q.rationale_es || q.rationale_en
         : lang === 'fr' ? q.rationale_fr || q.rationale_en
         : q.rationale_en;
    return localized || q.correct_rationale_en || 'Review the correct option and compare it with the wording of the question.';
  }

  function getQuestionDomain(q: Question) {
    return (q as any).topic?.title || (q as any).source_topic || 'Unmapped blueprint domain';
  }

  function getQuestionCompetency(q: Question) {
    return (q as any).subtopic?.title || (q as any).subtopic_record?.title || (q as any).competency_title || null;
  }

  async function toggleBookmark() {
    if (!currentQuestion || !activeTrackId) return;
    const nextBookmarked = !bookmarked[currentQuestion.id];
    setBookmarked({ ...bookmarked, [currentQuestion.id]: nextBookmarked });

    const res = await authenticatedFetch('/api/dashboard/bookmarks', {
      method: 'POST',
      body: JSON.stringify({
        examTrackId: activeTrackId,
        contentType: 'mcq',
        contentItemId: currentQuestion.id,
        bookmarked: nextBookmarked,
      }),
    });
    if (!res.ok) {
      setBookmarked({ ...bookmarked, [currentQuestion.id]: !nextBookmarked });
    }
  }

  async function handleAnswer(option: 'a' | 'b' | 'c' | 'd') {
    if (isAnswered || !currentQuestion) return;
    stopListening();
    setVoiceSuggestion(null);

    const correctOption = getCorrectOption(currentQuestion);
    const isCorrect = option === correctOption;
    const newAnswers = { ...answers, [currentQuestion.id]: option };
    setAnswers(newAnswers);
    setShowRationale(true);

    try {
      const activeSession = session || (activeTrackId ? await createPracticeSession(activeTrackId) : null);
      if (activeSession) {
        await authenticatedFetch('/api/dashboard/practice-session', {
          method: 'PUT',
          body: JSON.stringify({
            sessionId: activeSession.id,
            questionId: currentQuestion.id,
            selectedAnswer: option,
            isCorrect,
            currentIndex: currentIdx,
            timeSpentMs: Date.now() - questionStartedAt.current,
            domainTitle: getQuestionDomain(currentQuestion),
            competencyTitle: getQuestionCompetency(currentQuestion),
            cognitiveLevel: (currentQuestion as any).cognitive_level || (currentQuestion as any).intended_cognitive_level || null,
            difficulty: currentQuestion.difficulty || null,
          }),
        });
      }
    } catch (err) {
      console.error('Could not record answer:', err);
    }

    if (voiceEnabled) {
      const feedback = isCorrect
        ? `Correct! ${getRationale(currentQuestion)}`
        : `Incorrect. The correct answer is ${correctOption.toUpperCase()}. ${getRationale(currentQuestion)}`;
      speak(feedback, VOICE_LANG_MAP[lang]);
    }
  }

  async function handleNext() {
    stopSpeaking();
    stopListening();
    setVoiceSuggestion(null);
    setShowRationale(false);
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
      if (session) {
        await authenticatedFetch('/api/dashboard/practice-session', {
          method: 'PUT',
          body: JSON.stringify({
            sessionId: session.id,
            questionId: questions[currentIdx].id,
            selectedAnswer: answers[questions[currentIdx].id],
            isCorrect: answers[questions[currentIdx].id] === getCorrectOption(questions[currentIdx]),
            currentIndex: currentIdx + 1,
          }),
        });
      }
    } else {
      await finishSession();
    }
  }

  async function finishSession() {
    if (!profile) return;

    const total = Object.keys(answers).length;
    const correct = questions.filter(q => answers[q.id] === getCorrectOption(q)).length;
    const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;
    const weakTopics = questions
      .filter(q => answers[q.id] !== getCorrectOption(q) && q.topic_id)
      .map(q => q.topic_id)
      .filter((topicId, index, all) => all.indexOf(topicId) === index);
    const weakDomains = questions
      .filter(q => answers[q.id] !== getCorrectOption(q))
      .reduce<Record<string, number>>((acc, question) => {
        const label = getQuestionDomain(question);
        acc[label] = (acc[label] || 0) + 1;
        return acc;
      }, {});

    const activeSession = session || (activeTrackId ? await createPracticeSession(activeTrackId) : null);
    if (!activeSession) {
      setCompleted(true);
      return;
    }

    await authenticatedFetch('/api/dashboard/practice-session', {
      method: 'PATCH',
      body: JSON.stringify({
        sessionId: activeSession.id,
        scorePercent,
        weakTopics,
        currentIndex: questions.length,
        metadata: {
          weakDomains,
          answered: total,
          correct,
          disclaimer: 'Practice performance is diagnostic and does not predict official exam results with certainty.',
        },
      }),
    });

    setCompleted(true);

    if (voiceEnabled) {
      speak(`Session complete! You scored ${scorePercent}% with ${correct} out of ${total} questions correct.`, VOICE_LANG_MAP[lang]);
    }
  }

  function handleVoiceListen() {
    if (!currentQuestion || isAnswered) return;
    startListening(handleVoiceResult, { lang: VOICE_LANG_MAP[lang] });
  }

  function handleVoiceResult(heardTranscript: string) {
    if (!currentQuestion || isAnswered) return;
    const optionTexts = {
      a: getOptionText(currentQuestion, 'a'),
      b: getOptionText(currentQuestion, 'b'),
      c: getOptionText(currentQuestion, 'c'),
      d: getOptionText(currentQuestion, 'd'),
    };
    const match = matchVoiceAnswer(heardTranscript, optionTexts);
    if (process.env.NODE_ENV === 'development') {
      console.debug('[voice] match result', match);
    }

    if (match.option && !match.ambiguous) {
      handleAnswer(match.option);
      return;
    }

    setVoiceSuggestion({
      transcript: match.transcript || heardTranscript,
      option: match.suggestedOption,
    });
  }

  function getQuestionSpeechText() {
    if (!currentQuestion) return;
    return `Question ${currentIdx + 1}. ${getQuestionText(currentQuestion)}.
      Option A: ${getOptionText(currentQuestion, 'a')}.
      Option B: ${getOptionText(currentQuestion, 'b')}.
      Option C: ${getOptionText(currentQuestion, 'c')}.
      Option D: ${getOptionText(currentQuestion, 'd')}.`;
  }

  function speakQuestion() {
    const text = getQuestionSpeechText();
    if (!text) return;
    speak(text, VOICE_LANG_MAP[lang]);
  }

  function readQuestionThenListen() {
    const text = getQuestionSpeechText();
    if (!text || !currentQuestion || isAnswered) return;
    setVoiceSuggestion(null);
    speakThenListen(text, handleVoiceResult, { lang: VOICE_LANG_MAP[lang], delayMs: 500 });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-24">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-muted-foreground">Loading practice session...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center py-24">
        <BookOpenIcon className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-4">Could Not Load Practice</h2>
        <p className="text-muted-foreground mb-6">{loadError}</p>
        <Button asChild><Link href="/dashboard">Back to Dashboard</Link></Button>
      </div>
    );
  }

  if (!examId && !sessionId) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center py-24">
        <h2 className="text-2xl font-bold mb-4">Select an Exam</h2>
        <p className="text-muted-foreground mb-6">Please select an exam from your dashboard.</p>
        <Button asChild><Link href="/dashboard">Back to Dashboard</Link></Button>
      </div>
    );
  }

  if (questions.length === 0 && !loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center py-24">
        <BookOpenIcon className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-4">No Questions Available</h2>
        <p className="text-muted-foreground mb-6">
          No practice questions are available for this exam yet. Check back soon!
        </p>
        <Button asChild><Link href="/dashboard">Back to Dashboard</Link></Button>
      </div>
    );
  }

  if (completed) {
    const total = questions.filter(q => q.id in answers).length;
    const correct = questions.filter(q => answers[q.id] === getCorrectOption(q)).length;
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;
    const weakDomains = questions
      .filter(q => answers[q.id] !== getCorrectOption(q))
      .reduce<Record<string, number>>((acc, question) => {
        const label = getQuestionDomain(question);
        acc[label] = (acc[label] || 0) + 1;
        return acc;
      }, {});

    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="text-center py-12">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-2">Session Complete!</h2>
          <p className="text-muted-foreground mb-8">Here&apos;s how you did</p>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-3xl font-bold text-foreground">{score}%</div>
              <div className="text-sm text-muted-foreground">Score</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-3xl font-bold text-emerald-600">{correct}</div>
              <div className="text-sm text-muted-foreground">Correct</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-3xl font-bold text-rose-600">{total - correct}</div>
              <div className="text-sm text-muted-foreground">Incorrect</div>
            </div>
          </div>

          <Progress value={score} className="h-3 mb-8" />

          {Object.keys(weakDomains).length > 0 && (
            <div className="text-left bg-card border border-border rounded-xl p-4 mb-6">
              <h3 className="font-semibold text-foreground mb-3">Weak Domain Report</h3>
              <div className="space-y-2">
                {Object.entries(weakDomains).map(([domain, count]) => (
                  <div key={domain} className="flex justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{domain}</span>
                    <Badge variant="secondary">{count} missed</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-left bg-card border border-border rounded-xl p-4 mb-8">
            <h3 className="font-semibold text-foreground mb-3">Answer Review</h3>
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
              {questions.filter(q => q.id in answers).map((question, index) => (
                <div key={question.id} className="border-b border-border last:border-b-0 pb-3 last:pb-0">
                  <p className="text-sm font-medium text-foreground">Q{index + 1}. {getQuestionText(question)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your answer: {answers[question.id]?.toUpperCase()} · Correct: {getCorrectOption(question).toUpperCase()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{getRationale(question)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            <Button asChild variant="outline">
              <Link href="/dashboard">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Dashboard
              </Link>
            </Button>
            <Button onClick={() => router.push(`/dashboard/practice/mcq?exam=${session?.exam_track_id || session?.exam_id}`)}>
              <RefreshCw className="w-4 h-4 mr-2" />
              New Session
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const progress = ((currentIdx) / questions.length) * 100;
  const options: Array<'a' | 'b' | 'c' | 'd'> = ['a', 'b', 'c', 'd'];

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Exit
            </Link>
          </Button>
          <div>
            <h1 className="font-semibold text-foreground text-sm">{exam?.name}</h1>
            <p className="text-xs text-muted-foreground">
              {voiceEnabled ? 'Voice Practice Mode' : 'MCQ Practice'}
            </p>
            {voiceEnabled && (
              <p className="text-[11px] text-muted-foreground">
                Voice mode is for accessibility and is not safe for active driving.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Language selector */}
          <div className="flex gap-1">
            {(['en', 'es', 'fr'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${
                  lang === l ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Voice controls */}
          {supported && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={voiceEnabled ? 'text-primary' : 'text-muted-foreground'}
            >
              {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
          <span>Question {currentIdx + 1} of {questions.length}</span>
          <span>{Object.keys(answers).length} answered</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Question card */}
      {currentQuestion && (
        <Card className="border-border mb-4">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">{currentQuestion.difficulty}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={toggleBookmark} aria-label="Bookmark question">
                  <Bookmark className={`w-4 h-4 ${bookmarked[currentQuestion.id] ? 'fill-primary text-primary' : ''}`} />
                </Button>
                {voiceEnabled && (
                  <Button variant="ghost" size="sm" onClick={speakQuestion} disabled={speaking}>
                    <Volume2 className={`w-4 h-4 ${speaking ? 'text-primary animate-pulse-slow' : ''}`} />
                  </Button>
                )}
              </div>
            </div>

            <p className="text-foreground font-medium leading-relaxed mb-6 text-lg">
              {getQuestionText(currentQuestion)}
            </p>

            {/* Options */}
            <div className="space-y-3">
              {options.map((opt) => {
                const text = getOptionText(currentQuestion, opt);
                const isSelected = currentAnswer === opt;
                const isCorrect = getCorrectOption(currentQuestion) === opt;
                const showResult = isAnswered;

                let variant = 'outline';
                let className = 'w-full text-left justify-start p-4 h-auto font-normal transition-all';

                if (showResult) {
                  if (isCorrect) {
                    className += ' bg-emerald-50 border-emerald-400 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-600 dark:text-emerald-300';
                  } else if (isSelected && !isCorrect) {
                    className += ' bg-red-50 border-red-400 text-red-800 dark:bg-red-950 dark:border-red-600 dark:text-red-300';
                  } else {
                    className += ' opacity-60';
                  }
                } else {
                  className += ' hover:border-primary/50 hover:bg-primary/5';
                }

                return (
                  <button
                    key={opt}
                    onClick={() => handleAnswer(opt)}
                    disabled={isAnswered}
                    className={`${className} flex items-center gap-3 rounded-lg border px-4 py-3`}
                  >
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
                      showResult && isCorrect ? 'bg-emerald-500 text-white'
                      : showResult && isSelected ? 'bg-red-500 text-white'
                      : 'bg-secondary text-secondary-foreground'
                    }`}>
                      {opt.toUpperCase()}
                    </span>
                    <span className="text-sm">{text}</span>
                    {showResult && isCorrect && <CheckCircle className="w-4 h-4 text-emerald-600 ml-auto flex-shrink-0" />}
                    {showResult && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-red-600 ml-auto flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rationale */}
      {showRationale && currentQuestion && (
        <Card className="border-primary/30 bg-primary/5 mb-4">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              {currentAnswer === getCorrectOption(currentQuestion) ? (
                <CheckCircle className="w-4 h-4 text-emerald-600" />
              ) : (
                <XCircle className="w-4 h-4 text-red-600" />
              )}
              <span className="font-semibold text-foreground text-sm">
                {currentAnswer === getCorrectOption(currentQuestion) ? 'Correct' : 'Incorrect'}
              </span>
            </div>
            <p className="text-sm font-medium text-foreground mb-2">
              Correct answer: {getCorrectOption(currentQuestion).toUpperCase()} — {getOptionText(currentQuestion, getCorrectOption(currentQuestion))}
            </p>
            <p className="text-sm text-foreground leading-relaxed">
              {getRationale(currentQuestion)}
            </p>
          </CardContent>
        </Card>
      )}

      {voiceEnabled && !recognitionSupported && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 mb-4">
          <CardContent className="p-4 text-sm text-amber-800 dark:text-amber-200">
            Voice recognition is not supported in this browser. Use Chrome or Edge, or answer manually.
          </CardContent>
        </Card>
      )}

      {voiceEnabled && currentQuestion && !isAnswered && (
        <Card className="border-primary/20 bg-card mb-4">
          <CardContent className="p-4 space-y-3">
            <div aria-live="polite" role={voiceStatus === 'error' ? 'alert' : 'status'} className="text-sm">
              <p className="font-medium text-foreground">
                {voiceStatus === 'error' ? voiceError || voiceMessage : voiceMessage}
              </p>
              {voiceTranscript && (
                <p className="text-muted-foreground mt-1">I heard: {voiceTranscript}</p>
              )}
              {voiceSuggestion && (
                <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-800">
                  <p>
                    I heard “{voiceSuggestion.transcript}”.
                    {voiceSuggestion.option
                      ? ` Did you mean option ${voiceSuggestion.option.toUpperCase()}?`
                      : ' I could not match that to one clear option.'}
                  </p>
                  {voiceSuggestion.option && (
                    <Button
                      size="sm"
                      className="mt-2"
                      onClick={() => handleAnswer(voiceSuggestion.option as 'a' | 'b' | 'c' | 'd')}
                    >
                      Use option {voiceSuggestion.option.toUpperCase()}
                    </Button>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Manual fallback is always available: select A, B, C, or D above.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                variant="outline"
                onClick={readQuestionThenListen}
                disabled={speaking || listening || !recognitionSupported}
              >
                <Volume2 className="w-4 h-4 mr-1.5" />
                Read + Listen
              </Button>
              <Button
                variant="outline"
                onClick={handleVoiceListen}
                disabled={speaking || listening || !recognitionSupported}
              >
                <Mic className="w-4 h-4 mr-1.5" />
                Start Listening
              </Button>
              <Button
                variant="outline"
                onClick={stopListening}
                disabled={!listening}
              >
                <MicOff className="w-4 h-4 mr-1.5" />
                Stop Listening
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setVoiceSuggestion(null);
                  handleVoiceListen();
                }}
                disabled={speaking || listening || !recognitionSupported}
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => { stopSpeaking(); setCurrentIdx(Math.max(0, currentIdx - 1)); setShowRationale(!!answers[questions[Math.max(0, currentIdx - 1)]?.id]); }}
          disabled={currentIdx === 0}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </Button>

        <div className="flex gap-2">
          {voiceEnabled && recognitionSupported && !isAnswered && (
            <Button
              variant="outline"
              onClick={listening ? stopListening : readQuestionThenListen}
              className={listening ? 'text-primary border-primary' : ''}
            >
              {listening ? <MicOff className="w-4 h-4 mr-1.5" /> : <Mic className="w-4 h-4 mr-1.5" />}
              {listening ? 'Listening...' : 'Read + Listen'}
            </Button>
          )}

          {isAnswered && (
            <Button onClick={handleNext}>
              {currentIdx < questions.length - 1 ? (
                <>Next <ChevronRight className="w-4 h-4 ml-1" /></>
              ) : (
                <>Finish <Trophy className="w-4 h-4 ml-1" /></>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function BookOpenIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}
