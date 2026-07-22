'use client';

import { useEffect, useRef } from 'react';

/**
 * Analyzes the audio currently playing in `audioRef` (the TTS response
 * element) via the Web Audio API, and calls
 * `characterRef.current.setMouthWeights(...)` every animation frame while
 * it's playing, so the character's mouth morph targets track the actual
 * amplitude of the voice instead of just flipping open/closed.
 *
 * Because CharacterCanvas's setMouthWeights matches weight keys against
 * morph target names by substring, sending a handful of generic keys
 * ("mouth", "jaw", "viseme") covers most common shape-key naming
 * conventions without needing to know your model's exact names.
 *
 * If the audio plays with no detectable sound for longer than
 * `silenceTimeoutMs` (default 10s) — e.g. a stuck/silent stream — playback
 * is stopped automatically and `onSilenceTimeout` is called so the caller
 * can reset its own state (e.g. back to 'idle').
 *
 * @param {React.RefObject<HTMLAudioElement>} audioRef
 * @param {React.RefObject<{ setMouthWeights: (w: object) => void }>} characterRef
 * @param {{ onSilenceTimeout?: () => void, silenceTimeoutMs?: number }} [options]
 */
export function useMouthSync(audioRef, characterRef, options = {}) {
  const { onSilenceTimeout, silenceTimeoutMs = 10000 } = options;
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const dataArrayRef = useRef(null);
  const rafRef = useRef(null);
  const lastSoundAtRef = useRef(null);
  const onSilenceTimeoutRef = useRef(onSilenceTimeout);
  onSilenceTimeoutRef.current = onSilenceTimeout;

  const SOUND_THRESHOLD = 0.02; // weight above this counts as "sound detected"

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    function ensureAudioGraph() {
      if (audioCtxRef.current) return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      // NOTE: createMediaElementSource can only be called once per
      // <audio> element for its lifetime, hence the guard above.
      const source = ctx.createMediaElementSource(audioEl);
      source.connect(analyser);
      analyser.connect(ctx.destination);

      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
    }

    function tick() {
      const analyser = analyserRef.current;
      const dataArray = dataArrayRef.current;
      if (analyser && dataArray) {
        analyser.getByteTimeDomainData(dataArray);
        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128;
          sumSquares += v * v;
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);
        // Amplify quiet TTS signal into a usable 0–1 mouth-open range
        const weight = Math.min(1, rms * 6);
        characterRef.current?.setMouthWeights({
          mouth: weight,
          jaw: weight,
          viseme: weight,
        });

        const now = performance.now();
        if (weight > SOUND_THRESHOLD) {
          lastSoundAtRef.current = now;
        } else if (lastSoundAtRef.current === null) {
          // haven't heard any sound at all yet since playback started
          lastSoundAtRef.current = now;
        } else if (now - lastSoundAtRef.current > silenceTimeoutMs) {
          audioEl.pause();
          onSilenceTimeoutRef.current?.();
          return; // handleStop (via the 'pause' listener) takes it from here
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    function handlePlay() {
      ensureAudioGraph();
      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      lastSoundAtRef.current = null;
      if (!rafRef.current) tick();
    }

    function handleStop() {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastSoundAtRef.current = null;
      characterRef.current?.setMouthWeights({ mouth: 0, jaw: 0, viseme: 0 });
    }

    audioEl.addEventListener('play', handlePlay);
    audioEl.addEventListener('pause', handleStop);
    audioEl.addEventListener('ended', handleStop);

    return () => {
      audioEl.removeEventListener('play', handlePlay);
      audioEl.removeEventListener('pause', handleStop);
      audioEl.removeEventListener('ended', handleStop);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [audioRef, characterRef, silenceTimeoutMs]);
}