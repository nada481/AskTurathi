'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSpeechToText } from '@/lib/useSpeechToText';
import { useMouthSync } from '@/lib/useMouthSync';
import CharacterCanvas from '@/component/CharacterCanvas';
import { unlockAudioPlayback } from '@/lib/playAudio';
import { speakCharacter } from '@/lib/speakCharacter';
import { detectLanguageFromSpeech, toSttLang } from '@/lib/detectLanguage';

const FALLBACK_GREETINGS = {
  en: "Hello, little explorer! I'm Kahoola, the magical kohl applicator. Come closer and ask me about my stories!",
  ar: 'مرحباً يا مستكشف الصغير! أنا كَحُولَة، مِكحلة سحرية. اقترب واسألني ما تريد!',
};

export default function TestVoicePage() {
  const [language, setLanguage] = useState('en');
  const languageRef = useRef('en');
  languageRef.current = language;

  const { start, resume, pause, setLanguage: setSttLanguage } = useSpeechToText({
    lang: toSttLang('en'),
  });
  const [status, setStatus] = useState('idle');
  const audioRef = useRef(null);
  const characterRef = useRef(null);
  const greetedRef = useRef(false);
  const sttStartedRef = useRef(false);

  useMouthSync(audioRef, characterRef);

  const applyLanguage = useCallback(
    (nextLang) => {
      if (nextLang === languageRef.current) return;
      languageRef.current = nextLang;
      setLanguage(nextLang);
      setSttLanguage(toSttLang(nextLang));
    },
    [setSttLanguage]
  );

  const resumeListening = useCallback(() => {
    setStatus('listening');
    resume();
  }, [resume]);

  const speakText = useCallback(
    async (text, langOverride) => {
      const activeLang = langOverride ?? languageRef.current;
      pause();
      setStatus('speaking');
      await speakCharacter(text, activeLang, audioRef.current);
    },
    [pause]
  );

  const handleFinalTranscriptRef = useRef(async () => {});

  async function handleFinalTranscript(text) {
    const nextLang = detectLanguageFromSpeech(text, languageRef.current);
    applyLanguage(nextLang);
    pause();
    setStatus('thinking');

    try {
      const askRes = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, language: nextLang }),
      });
      if (!askRes.ok) throw new Error(`ask failed: ${askRes.status}`);
      const { answer: answerText } = await askRes.json();

      await speakText(answerText, nextLang);
      resumeListening();
    } catch (err) {
      console.error(err);
      resumeListening();
    }
  }

  handleFinalTranscriptRef.current = handleFinalTranscript;

  const beginListening = useCallback(() => {
    if (!sttStartedRef.current) {
      sttStartedRef.current = true;
      start((text) => handleFinalTranscriptRef.current(text));
    }
    setStatus('listening');
  }, [start]);

  const playGreeting = useCallback(async () => {
    if (greetedRef.current) return;
    greetedRef.current = true;
    setStatus('thinking');

    const activeLang = languageRef.current;
    let greetingText = FALLBACK_GREETINGS[activeLang] || FALLBACK_GREETINGS.en;
    try {
      const res = await fetch('/api/greet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: activeLang }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.greeting) greetingText = data.greeting;
      }
    } catch (err) {
      console.warn('Greeting failed, using fallback:', err);
    }

    try {
      await speakText(greetingText, activeLang);
    } catch (err) {
      console.error('[TestVoicePage] all TTS failed:', err);
    }

    beginListening();
  }, [speakText, beginListening]);

  useEffect(() => {
    async function unlockAndGreet() {
      await unlockAudioPlayback(audioRef.current);
      playGreeting();
    }
    window.addEventListener('pointerdown', unlockAndGreet, { once: true });
    window.addEventListener('keydown', unlockAndGreet, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAndGreet);
      window.removeEventListener('keydown', unlockAndGreet);
    };
  }, [playGreeting]);

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
      <CharacterCanvas
        ref={characterRef}
        state={status}
        onWake={() => {
          if (!greetedRef.current) playGreeting();
        }}
      />

      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  );
}
