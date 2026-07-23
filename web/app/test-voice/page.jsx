'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSpeechToText } from '@/lib/useSpeechToText';
import { useMouthSync } from '@/lib/useMouthSync';
import CharacterCanvas from '@/component/CharacterCanvas';

const FALLBACK_GREETING =
  "Hello, little explorer! I'm Kahoola, the magical kohl applicator. Come closer and ask me about my stories!";

export default function TestVoicePage() {
  const { start, resume, pause } = useSpeechToText({ lang: 'en-US' });
  const [status, setStatus] = useState('idle');
  const audioRef = useRef(null);
  const characterRef = useRef(null);
  const greetedRef = useRef(false);
  const sttStartedRef = useRef(false);

  useMouthSync(audioRef, characterRef);

  const resumeListening = useCallback(() => {
    setStatus('listening');
    resume();
  }, [resume]);

  const speakText = useCallback(async (text) => {
    pause();
    const speakRes = await fetch('/api/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language: 'en' }),
    });
    if (!speakRes.ok) throw new Error(`speak failed: ${speakRes.status}`);

    const audioEl = audioRef.current;
    audioEl.src = URL.createObjectURL(await speakRes.blob());
    setStatus('speaking');
    await audioEl.play();

    await new Promise((resolve) => {
      audioEl.onended = resolve;
    });
  }, [pause]);

  const handleFinalTranscriptRef = useRef(async () => {});

  async function handleFinalTranscript(text) {
    pause();
    setStatus('thinking');

    try {
      const askRes = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, language: 'en' }),
      });
      if (!askRes.ok) throw new Error(`ask failed: ${askRes.status}`);
      const { answer: answerText } = await askRes.json();

      await speakText(answerText);
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

    let greetingText = FALLBACK_GREETING;
    try {
      const res = await fetch('/api/greet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'en' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.greeting) greetingText = data.greeting;
      }
    } catch (err) {
      console.warn('Greeting failed, using fallback:', err);
    }

    try {
      await speakText(greetingText);
    } catch (err) {
      console.error('[TestVoicePage] greeting TTS failed:', err);
    }

    beginListening();
  }, [speakText, beginListening]);

  useEffect(() => {
    function unlockAndGreet() {
      const audioEl = audioRef.current;
      if (audioEl) {
        audioEl.muted = true;
        audioEl
          .play()
          .then(() => {
            audioEl.pause();
            audioEl.muted = false;
          })
          .catch(() => {
            audioEl.muted = false;
          });
      }
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
