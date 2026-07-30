'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSpeechToText } from '@/lib/useSpeechToText';
import { useMouthSync } from '@/lib/useMouthSync';
import CharacterCanvas from '@/component/CharacterCanvas';
import { unlockAudioPlayback } from '@/lib/playAudio';
import { speakCharacter, speakWithBrowser } from '@/lib/speakCharacter';
import { detectLanguageFromSpeech, toSttLang } from '@/lib/detectLanguage';

const FALLBACK_GREETINGS = {
  en: "Hello, little explorer! I'm Kahoola, the magical kohl applicator. Come closer and ask me about my stories!",
  ar: 'مرحباً يا مستكشف الصغير! أنا كَحُولَة، مِكحلة سحرية. اقترب واسألني ما تريد!',
};

export default function KahoolaPage() {
  const [language, setLanguage] = useState('en');
  const languageRef = useRef('en');
  languageRef.current = language;

  const { start, resume, pause, setLanguage: setSttLanguage } = useSpeechToText({
    lang: toSttLang('en'),
    silenceTimeoutMs: 3000,
  });

  const [status, setStatus] = useState('idle');
  const audioRef = useRef(null);
  const characterRef = useRef(null);
  const greetedRef = useRef(false);
  const isReplyingRef = useRef(false);
  const sttStartedRef = useRef(false);

  useMouthSync(audioRef, characterRef, { silenceTimeoutMs: 120000 });

  const applyLanguage = useCallback(
    (nextLang) => {
      if (nextLang === languageRef.current) return;
      languageRef.current = nextLang;
      setLanguage(nextLang);
      setSttLanguage(toSttLang(nextLang));
    },
    [setSttLanguage]
  );

  const startListening = useCallback(() => {
    if (!sttStartedRef.current) {
      sttStartedRef.current = true;
      start((text) => handleFinalTranscriptRef.current(text));
    } else {
      resume();
    }
    setStatus('listening');
  }, [start, resume]);

  const speakText = useCallback(
    async (text, langOverride, serverAudio) => {
      const activeLang = langOverride ?? languageRef.current;
      pause();
      setStatus('speaking');
      try {
        await speakCharacter(text, activeLang, audioRef.current, serverAudio);
      } catch (err) {
        console.warn('[KahoolaPage] speakCharacter failed, using browser voice:', err);
        await speakWithBrowser(text, activeLang);
      }
    },
    [pause]
  );

  const handleFinalTranscriptRef = useRef(async () => {});

  async function handleFinalTranscript(text) {
    if (!text?.trim() || isReplyingRef.current) return;
    isReplyingRef.current = true;

    const nextLang = detectLanguageFromSpeech(text, languageRef.current);
    applyLanguage(nextLang);
    pause();
    setStatus('thinking');

    try {
      const askRes = await fetch('/api/converse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, language: nextLang }),
      });
      if (!askRes.ok) throw new Error(`converse failed: ${askRes.status}`);
      const { answer: answerText, audio, audioMime } = await askRes.json();

      await speakText(
        answerText,
        nextLang,
        audio ? { audio, audioMime } : null
      );
    } catch (err) {
      console.error(err);
    } finally {
      isReplyingRef.current = false;
      startListening();
    }
  }

  handleFinalTranscriptRef.current = handleFinalTranscript;

  const playGreeting = useCallback(async () => {
    const activeLang = languageRef.current;
    let greetingText = FALLBACK_GREETINGS[activeLang] || FALLBACK_GREETINGS.en;
    let serverAudio = null;

    setStatus('thinking');

    try {
      const res = await fetch('/api/greet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: activeLang }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.greeting) greetingText = data.greeting;
        if (data.audio) serverAudio = { audio: data.audio, audioMime: data.audioMime };
      }
    } catch (err) {
      console.warn('[KahoolaPage] greet fetch failed:', err);
    }

    try {
      await speakText(greetingText, activeLang, serverAudio);
    } catch (err) {
      console.error('[KahoolaPage] greeting failed:', err);
    } finally {
      startListening();
    }
  }, [speakText, startListening]);

  const beginSession = useCallback(async () => {
    if (greetedRef.current) return;
    greetedRef.current = true;

    await unlockAudioPlayback(audioRef.current);
    await playGreeting();
  }, [playGreeting]);

  useEffect(() => {
    const onBegin = () => {
      void beginSession();
    };
    window.addEventListener('pointerdown', onBegin, { once: true });
    window.addEventListener('keydown', onBegin, { once: true });
    return () => {
      window.removeEventListener('pointerdown', onBegin);
      window.removeEventListener('keydown', onBegin);
    };
  }, [beginSession]);

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
      <CharacterCanvas
        ref={characterRef}
        state={status}
        onWake={() => {
          void beginSession();
        }}
      />

      {status === 'idle' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-10 z-20 text-center">
          <p className="font-orbitron text-xs tracking-[0.18em] uppercase text-[#eae6f6]/80">
            Tap Kahoola to begin
          </p>
        </div>
      )}

      <audio ref={audioRef} playsInline preload="auto" style={{ display: 'none' }} />
    </div>
  );
}
