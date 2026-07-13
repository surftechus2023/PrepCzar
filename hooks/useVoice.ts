'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { matchVoiceAnswer } from '@/lib/voice-answer';

type VoiceStatus =
  | 'idle'
  | 'requesting_permission'
  | 'listening'
  | 'hearing_speech'
  | 'processing'
  | 'success'
  | 'error';

type RecognitionResultHandler = (transcript: string, alternatives: string[]) => void;

type ListenOptions = {
  lang?: string;
};

type SpeakOptions = {
  onEnd?: () => void;
};

const STATUS_MESSAGES: Record<VoiceStatus, string> = {
  idle: 'Tap to answer',
  requesting_permission: 'Requesting microphone permission…',
  listening: 'Listening…',
  hearing_speech: 'Speech detected…',
  processing: 'Processing answer…',
  success: 'Answer captured.',
  error: 'I could not understand that. Try again.',
};

function debugVoice(message: string, metadata?: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[voice] ${message}`, metadata || {});
  }
}

function isLocalhost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function getRecognitionConstructor() {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

function getSecurityMessage() {
  if (typeof window === 'undefined') return '';
  if (window.isSecureContext || isLocalhost(window.location.hostname)) return '';
  return 'Voice input requires HTTPS or localhost.';
}

function mapPermissionError(error: any) {
  const name = String(error?.name || error?.message || '').toLowerCase();
  if (name.includes('notallowed') || name.includes('permission')) return 'Microphone permission was denied.';
  if (name.includes('notfound') || name.includes('devicesnotfound')) return 'No microphone was detected.';
  if (name.includes('notreadable') || name.includes('trackstarterror')) return 'Microphone is being used by another application.';
  if (name.includes('security')) return 'Voice input requires HTTPS or localhost.';
  return 'Browser blocked microphone access.';
}

function mapRecognitionError(error: string) {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone permission was denied.';
    case 'audio-capture':
      return 'No microphone was detected.';
    case 'no-speech':
      return 'I could not hear speech. Try again.';
    case 'network':
      return 'Speech recognition network service is unavailable. Try again or answer manually.';
    case 'aborted':
      return 'Listening stopped.';
    case 'language-not-supported':
      return 'This speech-recognition language is not supported by your browser.';
    default:
      return 'I could not understand that. Try again.';
  }
}

export function useVoice() {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [recognitionSupported, setRecognitionSupported] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [voiceMessage, setVoiceMessage] = useState(STATUS_MESSAGES.idle);
  const [transcript, setTranscript] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<VoiceStatus>('idle');

  const updateStatus = useCallback((nextStatus: VoiceStatus, message?: string) => {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
    setVoiceMessage(message || STATUS_MESSAGES[nextStatus]);
    if (nextStatus !== 'error') setVoiceError('');
  }, []);

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onstart = null;
      recognition.onaudiostart = null;
      recognition.onspeechstart = null;
      recognition.onresult = null;
      recognition.onspeechend = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onnomatch = null;
      try {
        recognition.abort();
      } catch {
        try {
          recognition.stop();
        } catch {
          // Browser recognition instances throw when already stopped.
        }
      }
    }
    setListening(false);
    if (statusRef.current === 'listening' || statusRef.current === 'hearing_speech') {
      updateStatus('idle');
    }
  }, [updateStatus]);

  useEffect(() => {
    const hasSpeechSynth = typeof window !== 'undefined' && 'speechSynthesis' in window;
    const hasSpeechRecognition = Boolean(getRecognitionConstructor());
    setSpeechSupported(hasSpeechSynth);
    setRecognitionSupported(hasSpeechRecognition);
    setSupported(hasSpeechSynth || hasSpeechRecognition);
    debugVoice('feature detection', { hasSpeechSynth, hasSpeechRecognition });

    return () => {
      stopListening();
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [stopListening]);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
  }, []);

  const speak = useCallback((text: string, lang = 'en-US', options: SpeakOptions = {}) => {
    stopListening();
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.95;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => {
      setSpeaking(false);
      options.onEnd?.();
    };
    utterance.onerror = () => {
      setSpeaking(false);
      options.onEnd?.();
    };
    window.speechSynthesis.speak(utterance);
  }, [stopListening]);

  const requestMicrophonePermission = useCallback(async () => {
    const securityMessage = getSecurityMessage();
    if (securityMessage) throw new Error(securityMessage);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      debugVoice('mediaDevices.getUserMedia unavailable');
      return;
    }

    updateStatus('requesting_permission');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      debugVoice('permission granted');
      stream.getTracks().forEach((track) => track.stop());
    } catch (error) {
      const message = mapPermissionError(error);
      debugVoice('permission error', { error: (error as any)?.name || String(error) });
      throw new Error(message);
    }
  }, [updateStatus]);

  const startListening = useCallback(async (
    onResult: RecognitionResultHandler,
    options: ListenOptions = {},
  ) => {
    const SpeechRecognition = getRecognitionConstructor();
    if (!SpeechRecognition) {
      const message = 'Voice recognition is not supported in this browser. Use Chrome or Edge, or answer manually.';
      setVoiceError(message);
      updateStatus('error', message);
      return;
    }

    stopListening();
    stopSpeaking();
    setTranscript('');

    try {
      await requestMicrophonePermission();
    } catch (error) {
      const message = (error as Error).message;
      setVoiceError(message);
      updateStatus('error', message);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = options.lang || 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      debugVoice('recognition start', { lang: recognition.lang });
      setListening(true);
      updateStatus('listening');
    };
    recognition.onaudiostart = () => updateStatus('listening');
    recognition.onspeechstart = () => updateStatus('hearing_speech');
    recognition.onspeechend = () => updateStatus('processing');
    recognition.onnomatch = () => {
      const message = 'I could not understand that. Try again.';
      setVoiceError(message);
      updateStatus('error', message);
    };
    recognition.onerror = (event: any) => {
      const message = mapRecognitionError(event?.error);
      debugVoice('recognition error', { error: event?.error });
      setVoiceError(message);
      updateStatus(event?.error === 'aborted' ? 'idle' : 'error', message);
      setListening(false);
    };
    recognition.onresult = (event: any) => {
      const alternatives: string[] = [];
      let finalTranscript = '';
      let interimTranscript = '';

      for (let resultIndex = event.resultIndex; resultIndex < event.results.length; resultIndex += 1) {
        const result = event.results[resultIndex];
        for (let altIndex = 0; altIndex < Math.min(result.length, 3); altIndex += 1) {
          if (result[altIndex]?.transcript) alternatives.push(result[altIndex].transcript.trim());
        }
        const text = result[0]?.transcript?.trim() || '';
        if (result.isFinal) finalTranscript += ` ${text}`;
        else interimTranscript += ` ${text}`;
      }

      const heard = (finalTranscript || interimTranscript).trim();
      setTranscript(heard);
      if (heard) setVoiceMessage(`I heard: ${heard}`);
      debugVoice('transcript', { heard, alternatives });

      if (finalTranscript.trim()) {
        updateStatus('processing');
        onResult(finalTranscript.trim(), alternatives);
        updateStatus('success', `I heard: ${finalTranscript.trim()}`);
        try {
          recognition.stop();
        } catch {
          // Recognition may already be stopped by the browser.
        }
      }
    };
    recognition.onend = () => {
      debugVoice('recognition end', { status: statusRef.current });
      setListening(false);
      recognitionRef.current = null;
      if (statusRef.current === 'listening' || statusRef.current === 'hearing_speech' || statusRef.current === 'requesting_permission') {
        updateStatus('idle', 'Tap to answer');
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (error) {
      const message = 'Speech recognition could not start. Try again or answer manually.';
      debugVoice('recognition start failed', { error: String(error) });
      recognitionRef.current = null;
      setVoiceError(message);
      updateStatus('error', message);
      setListening(false);
    }
  }, [requestMicrophonePermission, stopListening, stopSpeaking, updateStatus]);

  const speakThenListen = useCallback((
    text: string,
    onResult: RecognitionResultHandler,
    options: ListenOptions & { delayMs?: number } = {},
  ) => {
    stopListening();
    const delayMs = options.delayMs ?? 500;
    speak(text, options.lang || 'en-US', {
      onEnd: () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          startListening(onResult, { lang: options.lang });
        }, delayMs);
      },
    });
  }, [speak, startListening, stopListening]);

  return {
    voiceEnabled,
    setVoiceEnabled,
    speaking,
    listening,
    supported,
    speechSupported,
    recognitionSupported,
    status,
    voiceMessage,
    voiceError,
    transcript,
    speak,
    speakThenListen,
    stopSpeaking,
    startListening,
    stopListening,
  };
}

export function parseVoiceAnswer(transcript: string): 'a' | 'b' | 'c' | 'd' | null {
  return matchVoiceAnswer(transcript).option;
}
