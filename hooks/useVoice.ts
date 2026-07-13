'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export function useVoice() {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [recognitionSupported, setRecognitionSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const hasSpeechSynth = typeof window !== 'undefined' && 'speechSynthesis' in window;
    const hasSpeechRecognition =
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
    setSpeechSupported(hasSpeechSynth);
    setRecognitionSupported(hasSpeechRecognition);
    setSupported(hasSpeechSynth || hasSpeechRecognition);
  }, []);

  const speak = useCallback((text: string, lang = 'en-US') => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.95;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
  }, []);

  const startListening = useCallback((onResult: (transcript: string) => void) => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.toLowerCase().trim();
      onResult(transcript);
    };

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setListening(false);
  }, []);

  return {
    voiceEnabled,
    setVoiceEnabled,
    speaking,
    listening,
    supported,
    speechSupported,
    recognitionSupported,
    speak,
    stopSpeaking,
    startListening,
    stopListening,
  };
}

export function parseVoiceAnswer(transcript: string): 'a' | 'b' | 'c' | 'd' | null {
  const t = transcript.toLowerCase();
  if (t === 'a' || t.includes(' a ') || t.startsWith('a ') || t.endsWith(' a')) return 'a';
  if (t === 'b' || t.includes(' b ') || t.startsWith('b ') || t.endsWith(' b')) return 'b';
  if (t === 'c' || t.includes(' c ') || t.startsWith('c ') || t.endsWith(' c')) return 'c';
  if (t === 'd' || t.includes(' d ') || t.startsWith('d ') || t.endsWith(' d')) return 'd';
  if (t.includes('option a') || t.startsWith('answer a')) return 'a';
  if (t.includes('option b') || t.startsWith('answer b')) return 'b';
  if (t.includes('option c') || t.startsWith('answer c')) return 'c';
  if (t.includes('option d') || t.startsWith('answer d')) return 'd';
  return null;
}
