
'use client';
import { useState, useRef, useCallback } from 'react';
import { useSpeechToText } from './useSpeechToText';
import { useMouthSync } from './useMouthSync';

const SILENCE_TIMEOUT_MS = 30_000;

const FALLBACK_GREETINGS = {
  en: "Hello, little explorer! I'm Kahoola, the magical kohl applicator. Come closer and ask me about my stories!",
  ar: "مرحباً يا مستكشف الصغير! أنا كَحُولَة، مِكحلة سحرية. اقترب واسألني ما تريد!",
};

export function useConversation(characterRef, language = 'en') {
  const [state, setState] = useState('idle');
  const [subtitle, setSubtitle] = useState('');
  const {
    start: startSTT,
    stop: stopSTT,
    pause: pauseSTT,
    resume: resumeSTT,
  } = useSpeechToText({ lang: language === 'ar' ? 'ar-SA' : 'en-US' });
  const audioRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const sttStartedRef = useRef(false);
  const listenAgainRef = useRef(() => {});
  const askAndRespondRef = useRef(async () => {});

  useMouthSync(audioRef, characterRef);

  const goIdle = useCallback(() => {
    stopSTT();
    sttStartedRef.current = false;
    setState('idle');
    setSubtitle('');
  }, [stopSTT]);

  const speak = useCallback(async (text) => {
    if (!text) return;
    pauseSTT();
    setState('speaking');
    setSubtitle(text);

    try {
      const res = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language }),
      });
      if (!res.ok) throw new Error(`speak failed: ${res.status}`);

      const audioEl = audioRef.current;
      if (!audioEl) throw new Error('audio element not ready');

      audioEl.src = URL.createObjectURL(await res.blob());

      await new Promise((resolve, reject) => {
        audioEl.onended = resolve;
        audioEl.onerror = reject;
        audioEl.play().catch(reject);
      });
    } catch (err) {
      console.error('[speak] failed:', err);
    }

    listenAgainRef.current();
  }, [pauseSTT, language]);

  const askAndRespond = useCallback(async (question) => {
    setState('thinking');
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, language }),
      });
      if (!res.ok) throw new Error(`ask failed: ${res.status}`);
      const { answer } = await res.json();
      await speak(answer);
    } catch (err) {
      console.error('[ask] failed:', err);
      listenAgainRef.current();
    }
  }, [language, speak]);

  askAndRespondRef.current = askAndRespond;

  const listenAgain = useCallback(() => {
    setState('listening');
    clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => goIdle(), SILENCE_TIMEOUT_MS);

    if (!sttStartedRef.current) {
      sttStartedRef.current = true;
      startSTT((finalText) => {
        clearTimeout(silenceTimerRef.current);
        pauseSTT();
        askAndRespondRef.current(finalText);
      });
    } else {
      resumeSTT();
    }
  }, [startSTT, pauseSTT, resumeSTT, goIdle]);

  listenAgainRef.current = listenAgain;

  const wake = useCallback(async () => {
    if (state !== 'idle') return;
    setState('thinking');

    let greetingText;
    try {
      const res = await fetch('/api/greet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
      });
      if (res.ok) {
        const data = await res.json();
        greetingText = data.greeting;
      } else {
        console.warn('Greeting API returned', res.status);
      }
    } catch (err) {
      console.warn('Greeting generation failed, using fallback:', err);
    }

    await speak(greetingText || FALLBACK_GREETINGS[language] || FALLBACK_GREETINGS.en);
  }, [state, language, speak]);

  return { state, subtitle, wake, goIdle, audioRef };
}
