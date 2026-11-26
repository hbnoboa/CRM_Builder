'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Partes da Web Speech API que usamos (o TypeScript do DOM ainda nao traz). */
interface SpeechAlternative { transcript: string }
interface SpeechResult { isFinal: boolean; 0: SpeechAlternative }
interface SpeechResultEvent { resultIndex: number; results: ArrayLike<SpeechResult> }
interface SpeechErrorEvent { error: string }
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Idioma da tela -> idioma do reconhecimento. */
const SPEECH_LANG: Record<string, string> = { 'pt-BR': 'pt-BR', pt: 'pt-BR', en: 'en-US', es: 'es-ES' };

export type SpeechError = 'denied' | 'no-speech' | 'network' | 'failed';

/**
 * Ditado pelo navegador (Chrome, Edge, Safari): o texto falado entra depois do que ja
 * estava escrito e vai aparecendo enquanto a pessoa fala. Nada e enviado sozinho.
 */
export function useSpeechInput({ value, onChange, onError }: {
  value: string;
  onChange: (text: string) => void;
  onError?: (error: SpeechError) => void;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Descobre so no navegador (o servidor nao tem window): evita diferenca na primeira pintura
  useEffect(() => setSupported(!!recognitionCtor()), []);
  useEffect(() => () => recognition.current?.abort(), []);

  const stop = useCallback(() => recognition.current?.stop(), []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor || recognition.current) return;
    const r = new Ctor();
    const lang = document.documentElement.lang || 'pt-BR';
    r.lang = SPEECH_LANG[lang] ?? SPEECH_LANG[lang.split('-')[0]] ?? lang;
    r.continuous = true;
    r.interimResults = true;
    // O que ja estava escrito fica; a fala entra depois
    const base = valueRef.current.trim();
    let finals = '';
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) finals = `${finals} ${text}`.trim();
        else interim = `${interim} ${text}`;
      }
      const spoken = `${finals} ${interim}`.replace(/\s+/g, ' ').trim();
      onChangeRef.current([base, spoken].filter(Boolean).join(' '));
    };
    r.onerror = (e) => {
      if (e.error === 'aborted') return;
      onErrorRef.current?.(
        e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'denied'
          : e.error === 'no-speech' ? 'no-speech'
          : e.error === 'network' ? 'network'
          : 'failed',
      );
    };
    r.onend = () => {
      recognition.current = null;
      setListening(false);
    };
    recognition.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      recognition.current = null;
      onErrorRef.current?.('failed');
    }
  }, []);

  return { supported, listening, start, stop };
}
