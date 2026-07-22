'use client';

import { useState, useRef, useEffect } from 'react';
import { useSpeechToText } from '@/lib/useSpeechToText';
import { useMouthSync } from '@/lib/useMouthSync';
import CharacterCanvas from '@/component/CharacterCanvas';

export default function TestVoicePage() {
  const { start, resume } = useSpeechToText({ lang: 'en-US' });
  const [status, setStatus] = useState('listening'); // listening | thinking | speaking
  const audioRef = useRef(null);
  const characterRef = useRef(null);

  // Drives characterRef.current.setMouthWeights() from the live TTS audio
  // amplitude while it's playing, and — if 10s pass during playback with
  // no detectable sound — resumes listening rather than getting stuck.
  useMouthSync(audioRef, characterRef, {
    silenceTimeoutMs: 10000,
    onSilenceTimeout: () => {
      console.warn('[TestVoicePage] No sound detected for 10s — resuming listening.');
      resumeListening();
    },
  });

  // Central place that puts us back into "listening" — used after a
  // response finishes speaking, after an error, or after a silence
  // timeout, so the conversation keeps going with no user interaction.
  function resumeListening() {
    setStatus('listening');
    resume();
  }

  async function handleFinalTranscript(text) {
    setStatus('thinking');

    try {
      // 1. Ask Gemini for the answer
      const askRes = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, language: 'en' }),
      });
      if (!askRes.ok) throw new Error(`ask failed: ${askRes.status}`);
      const { answer: answerText } = await askRes.json();

      // 2. Convert the answer to speech
      setStatus('speaking');
      const speakRes = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: answerText, language: 'en' }),
      });
      if (!speakRes.ok) throw new Error(`speak failed: ${speakRes.status}`);

      const blob = await speakRes.blob();
      const audioEl = audioRef.current;
      audioEl.src = URL.createObjectURL(blob);

      // 3. Play automatically — the character's mouth animates via useMouthSync
      await audioEl.play();

      audioEl.onended = () => {
        // Loop back into listening instead of stopping — the mic was
        // paused (by useSpeechToText, to avoid transcribing our own TTS
        // audio) and needs an explicit resume() to start again.
        resumeListening();
      };
    } catch (err) {
      console.error(err);
      // Keep the conversation alive even if a single turn fails, rather
      // than silently going quiet.
      resumeListening();
    }
  }

  // Start listening the moment the page loads — no tap required. This
  // keeps running indefinitely (auto-restarting itself between
  // utterances via useSpeechToText, and looping back after every
  // response here) until the page is actually closed/unmounted.
  useEffect(() => {
    start(handleFinalTranscript);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chrome/Safari block audio autoplay without a prior user gesture. Since
  // there's no tap-to-start anymore, the very first spoken reply could get
  // silently blocked. This "unlocks" playback on the first interaction
  // anywhere on the page (a click, tap, or key press), so by the time the
  // first real answer is ready, audioEl.play() is allowed to succeed.
  useEffect(() => {
    function unlockAudio() {
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
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    }
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
      <CharacterCanvas ref={characterRef} state={status} />

      {/* Hidden audio element — plays automatically; also feeds useMouthSync */}
      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  );
}