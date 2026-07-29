
'use client';
import { useState, useRef, useCallback } from 'react';
import { useSpeechToText } from './useSpeechToText';
import { useMouthSync } from './useMouthSync';
import { speakCharacter } from './speakCharacter';
import { detectLanguageFromSpeech, toSttLang } from './detectLanguage';

const SILENCE_TIMEOUT_MS = 4_000;

const FALLBACK_GREETINGS = {
  en: "Hello, little explorer! I'm Kahoola, the magical kohl applicator. Come closer and ask me about my stories!",
  ar: "مرحباً يا مستكشف الصغير! أنا كَحُولَة، مِكحلة سحرية. اقترب واسألني ما تريد!",
};

export function useConversation(characterRef, initialLanguage = 'en') {
  const [state, setState] = useState('idle');
  const [subtitle, setSubtitle] = useState('');
  const [language, setLanguageState] = useState(initialLanguage);
  const languageRef = useRef(initialLanguage);
  languageRef.current = language;

  const audioRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const resetIdleTimerRef = useRef(() => {});
  const stopSTTRef = useRef(() => {});
  const sttStartedRef = useRef(false);
  const listenAgainRef = useRef(() => {});
  const askAndRespondRef = useRef(async () => {});

  const goIdle = useCallback(() => {
    stopSTTRef.current();
    sttStartedRef.current = false;
    setState('idle');
    setSubtitle('');
  }, []);

  resetIdleTimerRef.current = () => {
    clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => goIdle(), SILENCE_TIMEOUT_MS);
  };

  const {
    start: startSTT,
    stop: stopSTT,
    pause: pauseSTT,
    resume: resumeSTT,
    setLanguage: setSttLanguage,
  } = useSpeechToText({
    lang: toSttLang(initialLanguage),
    onActivity: () => resetIdleTimerRef.current(),
  });

  stopSTTRef.current = stopSTT;

  const applyLanguage = useCallback(
    (nextLang) => {
      if (nextLang === languageRef.current) return;
      languageRef.current = nextLang;
      setLanguageState(nextLang);
      setSttLanguage(toSttLang(nextLang));
    },
    [setSttLanguage]
  );

  useMouthSync(audioRef, characterRef);

  const speak = useCallback(
    async (text, langOverride) => {
      if (!text) return;
      const activeLang = langOverride ?? languageRef.current;
      pauseSTT();
      setState('speaking');
      setSubtitle(text);

      try {
      const audioEl = audioRef.current;
      if (!audioEl) throw new Error('audio element not ready');

      await speakCharacter(text, activeLang, audioEl);
      } catch (err) {
        console.error('[speak] failed:', err);
      }

      listenAgainRef.current();
    },
    [pauseSTT]
  );

  const askAndRespond = useCallback(
    async (question) => {
      const nextLang = detectLanguageFromSpeech(question, languageRef.current);
      applyLanguage(nextLang);
      setState('thinking');

      try {
        const res = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, language: nextLang }),
        });
        if (!res.ok) throw new Error(`ask failed: ${res.status}`);
        const { answer } = await res.json();
        await speak(answer, nextLang);
      } catch (err) {
        console.error('[ask] failed:', err);
        listenAgainRef.current();
      }
    },
    [applyLanguage, speak]
  );

  askAndRespondRef.current = askAndRespond;

  const listenAgain = useCallback(() => {
    setState('listening');
    resetIdleTimerRef.current();

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
  }, [startSTT, pauseSTT, resumeSTT]);

  listenAgainRef.current = listenAgain;

  const wake = useCallback(async () => {
    if (state !== 'idle') return;
    setState('thinking');

    const activeLang = languageRef.current;
    let greetingText;
    try {
      const res = await fetch('/api/greet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: activeLang }),
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

    await speak(greetingText || FALLBACK_GREETINGS[activeLang] || FALLBACK_GREETINGS.en, activeLang);
  }, [state, speak]);

  return { state, subtitle, wake, goIdle, audioRef, language };
}
