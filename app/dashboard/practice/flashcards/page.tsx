'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, ChevronRight, RotateCcw, Trophy, ArrowLeft, RefreshCw, Volume2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { hasActiveTrackAccess } from '@/lib/access';
import { useVoice } from '@/hooks/useVoice';
import type { Flashcard, Exam, PracticeSession } from '@/types/database';

export default function FlashcardsPage() {
  return (
    <Suspense fallback={<FlashcardsLoading />}>
      <FlashcardsContent />
    </Suspense>
  );
}

function FlashcardsLoading() {
  return (
    <div className="flex items-center justify-center py-24">
      <RefreshCw className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

function FlashcardsContent() {
  const searchParams = useSearchParams();
  const examId = searchParams.get('exam');
  const router = useRouter();
  const { profile } = useAuth();

  const [exam, setExam] = useState<Exam | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [unknown, setUnknown] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [lang, setLang] = useState<'en' | 'es' | 'fr'>('en');
  const [session, setSession] = useState<PracticeSession | null>(null);

  const { voiceEnabled, setVoiceEnabled, speak, supported } = useVoice();

  useEffect(() => {
    if (profile?.preferred_language) {
      setLang((profile.preferred_language as 'en' | 'es' | 'fr') || 'en');
    }
  }, [profile]);

  useEffect(() => {
    if (profile && examId) loadData();
  }, [profile, examId]);

  async function loadData() {
    if (!examId || !profile) return;

    const allowed = await hasActiveTrackAccess(profile.id, examId);
    if (!allowed) {
      router.push('/dashboard/subscriptions');
      return;
    }

    const [trackRes, cardsRes] = await Promise.all([
      supabase.from('exam_tracks').select('id, name').eq('id', examId).maybeSingle(),
      supabase.from('flashcards').select('*').eq('exam_track_id', examId).eq('active', true).eq('reviewed', true).limit(50),
    ]);

    if (trackRes.data) {
      setExam({ id: trackRes.data.id, name: trackRes.data.name } as any);
    } else {
      const examRes = await supabase.from('exams').select('*').eq('id', examId).maybeSingle();
      setExam(examRes.data);
    }
    if (cardsRes.data) {
      setFlashcards([...cardsRes.data].sort(() => Math.random() - 0.5));
    }

    const { data: newSession } = await supabase
      .from('practice_sessions')
      .insert({
        user_id: profile.id,
        exam_track_id: examId,
        mode: 'flashcard',
      })
      .select()
      .single();
    if (newSession) setSession(newSession);

    setLoading(false);
  }

  const currentCard = flashcards[currentIdx];

  function getFront(card: Flashcard) {
    return lang === 'es' ? card.front_es || card.front_en
         : lang === 'fr' ? card.front_fr || card.front_en
         : card.front_en;
  }

  function getBack(card: Flashcard) {
    return lang === 'es' ? card.back_es || card.back_en
         : lang === 'fr' ? card.back_fr || card.back_en
         : card.back_en;
  }

  function handleFlip() {
    setFlipped(!flipped);
    if (voiceEnabled && currentCard && !flipped) {
      const langMap: Record<string, string> = { en: 'en-US', es: 'es-ES', fr: 'fr-FR' };
      speak(getBack(currentCard), langMap[lang]);
    }
  }

  async function handleKnow(knows: boolean) {
    if (!currentCard) return;
    const newKnown = new Set(known);
    const newUnknown = new Set(unknown);

    if (knows) {
      newKnown.add(currentCard.id);
      newUnknown.delete(currentCard.id);
    } else {
      newUnknown.add(currentCard.id);
      newKnown.delete(currentCard.id);
    }

    setKnown(newKnown);
    setUnknown(newUnknown);
    setFlipped(false);

    if (currentIdx < flashcards.length - 1) {
      setTimeout(() => setCurrentIdx(currentIdx + 1), 200);
    } else {
      const total = flashcards.length;
      const scorePercent = total > 0 ? Math.round((newKnown.size / total) * 100) : 0;
      if (session && profile) {
        await supabase.from('practice_sessions').update({
          completed: true,
          completed_at: new Date().toISOString(),
          score_percent: scorePercent,
        }).eq('id', session.id);

        await supabase.from('scores').insert({
          user_id: profile.id,
          exam_track_id: examId,
          score: scorePercent,
          weak_topics: flashcards
            .filter(card => newUnknown.has(card.id) && card.topic_id)
            .map(card => card.topic_id)
            .filter((topicId, index, all) => all.indexOf(topicId) === index),
        });
      }
      setCompleted(true);
    }
  }

  function restart() {
    setCurrentIdx(0);
    setFlipped(false);
    setKnown(new Set());
    setUnknown(new Set());
    setCompleted(false);
    setFlashcards([...flashcards].sort(() => Math.random() - 0.5));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (completed) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center py-12">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Trophy className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Flashcards Complete!</h2>
        <p className="text-muted-foreground mb-8">You reviewed {flashcards.length} cards</p>

        <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto mb-8">
          <div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
            <div className="text-3xl font-bold text-emerald-600">{known.size}</div>
            <div className="text-sm text-emerald-700 dark:text-emerald-400">Knew it</div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
            <div className="text-3xl font-bold text-amber-600">{unknown.size}</div>
            <div className="text-sm text-amber-700 dark:text-amber-400">Still learning</div>
          </div>
        </div>

        <div className="flex gap-3 justify-center">
          <Button variant="outline" asChild>
            <Link href="/dashboard"><ArrowLeft className="w-4 h-4 mr-2" />Dashboard</Link>
          </Button>
          <Button onClick={restart}>
            <RotateCcw className="w-4 h-4 mr-2" />Review Again
          </Button>
        </div>
      </div>
    );
  }

  if (flashcards.length === 0) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center py-24">
        <h2 className="text-2xl font-bold mb-4">No Flashcards Available</h2>
        <p className="text-muted-foreground mb-6">Flashcards for this exam are coming soon.</p>
        <Button asChild><Link href="/dashboard">Back to Dashboard</Link></Button>
      </div>
    );
  }

  const progress = (currentIdx / flashcards.length) * 100;

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard"><ArrowLeft className="w-4 h-4 mr-1" />Exit</Link>
          </Button>
          <div>
            <h1 className="font-semibold text-foreground text-sm">{exam?.name}</h1>
            <p className="text-xs text-muted-foreground">Flashcard Review</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {(['en', 'es', 'fr'] as const).map((l) => (
              <button key={l} onClick={() => setLang(l)}
                className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${lang === l ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
              >{l.toUpperCase()}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span>Card {currentIdx + 1} of {flashcards.length}</span>
          <div className="flex gap-3">
            <span className="text-emerald-600">{known.size} known</span>
            <span className="text-amber-600">{unknown.size} learning</span>
          </div>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Flashcard */}
      {currentCard && (
        <div className="mb-6">
          <div
            className="perspective-1000 cursor-pointer select-none"
            onClick={handleFlip}
            style={{ perspective: '1000px', minHeight: '280px' }}
          >
            <div
              style={{
                transition: 'transform 0.6s',
                transformStyle: 'preserve-3d',
                transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                position: 'relative',
                minHeight: '280px',
              }}
            >
              {/* Front */}
              <div
                style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                className="absolute inset-0 bg-card border border-border rounded-2xl p-8 flex flex-col items-center justify-center shadow-card"
              >
                <Badge variant="secondary" className="mb-4">Front</Badge>
                <p className="text-center text-foreground text-xl font-medium leading-relaxed">
                  {getFront(currentCard)}
                </p>
                <p className="text-sm text-muted-foreground mt-6">Click to reveal answer</p>
              </div>

              {/* Back */}
              <div
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                }}
                className="absolute inset-0 bg-primary/5 border border-primary/30 rounded-2xl p-8 flex flex-col items-center justify-center shadow-card"
              >
                <Badge className="mb-4 bg-primary text-primary-foreground">Answer</Badge>
                <p className="text-center text-foreground text-lg leading-relaxed">
                  {getBack(currentCard)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      {!flipped ? (
        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={() => { setFlipped(false); setCurrentIdx(Math.max(0, currentIdx - 1)); }}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button onClick={handleFlip} className="px-8">
            Flip Card
          </Button>
          <Button variant="outline" onClick={() => { setFlipped(false); setCurrentIdx(Math.min(flashcards.length - 1, currentIdx + 1)); }}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div className="flex justify-center gap-3">
          <Button
            variant="outline"
            className="flex-1 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400"
            onClick={() => handleKnow(false)}
          >
            Still Learning
          </Button>
          <Button
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => handleKnow(true)}
          >
            Got It!
          </Button>
        </div>
      )}
    </div>
  );
}
