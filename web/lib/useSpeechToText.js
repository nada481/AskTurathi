'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * Wraps the browser's SpeechRecognition (Web Speech API) for hands-free,
 * continuous listening.
 *
 * Chrome/Edge will still end a recognition session after a pause in
 * speech even with `continuous: true` — that's normal browser behavior,
 * not a bug. This hook works around it by auto-restarting recognition in
 * `onend` whenever the caller hasn't explicitly called `stop()`, so from
 * the outside you never have to manually re-trigger listening: call
 * `start()` once and it keeps going.
 *
 * IMPORTANT: every restart goes through a small delay (RESTART_DELAY_MS)
 * rather than calling `.start()` immediately. Calling `.start()` again too
 * soon after a session stops — before Chrome finishes tearing down the
 * previous session's internal socket — commonly surfaces as a spurious
 * `"network"` error, even when there's nothing actually wrong with the
 * connection. This bit us specifically in the resume()-right-after-stop
 * path, which is why every restart path below is debounced the same way.
 *
 * While an answer is being fetched/spoken, call `pause()` so the TTS
 * playback doesn't get picked up as user speech, then `resume()` once
 * you're ready to listen again — useMouthSync's onSilenceTimeout and
 * the audio `onended` handler are natural places to call `resume()`.
 *
 * NOTE: only supported in Chromium-based browsers (Chrome, Edge). Safari
 * and Firefox don't implement SpeechRecognition.
 *
 * @param {{ lang?: string }} [options]
 * @returns {{
 *   start: (onFinalTranscript: (text: string) => void) => void,
 *   stop: () => void,
 *   pause: () => void,
 *   resume: () => void,
 *   transcript: string,
 *   listening: boolean,
 * }}
 */
export function useSpeechToText({ lang = 'en-US' } = {}) {
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const onFinalRef = useRef(null);
  const shouldRunRef = useRef(false); // true while the caller wants us listening at all
  const pausedRef = useRef(false); // true while we're deliberately not listening (thinking/speaking)
  const networkRetryCountRef = useRef(0);
  const restartTimeoutRef = useRef(null); // any pending debounced restart (normal or network-retry)

  const MAX_NETWORK_RETRIES = 3;
  const RESTART_DELAY_MS = 250;

  const clearPendingRestart = () => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
  };

  // Every place that wants to (re)start recognition goes through this, so
  // there's always a beat between the previous session stopping and the
  // next one starting.
  const scheduleRestart = (recognition, delay = RESTART_DELAY_MS) => {
    clearPendingRestart();
    restartTimeoutRef.current = setTimeout(() => {
      restartTimeoutRef.current = null;
      try {
        recognition.start();
        setListening(true);
      } catch {
        // "already started" race — safe to ignore
      }
    }, delay);
  };

  const getRecognition = useCallback(() => {
    if (recognitionRef.current) return recognitionRef.current;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('[useSpeechToText] SpeechRecognition not supported in this browser.');
      return null;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += chunk;
        } else {
          interim += chunk;
        }
      }
      if (interim) setTranscript(interim);
      if (final.trim()) {
        setTranscript(final);
        networkRetryCountRef.current = 0;
        // Stop listening while we go fetch/speak a response, so the TTS
        // playback doesn't get transcribed as if the user said it.
        pausedRef.current = true;
        recognition.stop();
        onFinalRef.current?.(final.trim());
      }
    };

    recognition.onerror = (event) => {
      // 'no-speech' fires constantly in continuous mode while waiting for
      // someone to talk — that's expected, not a real error.
      if (event.error === 'no-speech') return;

      if (event.error === 'network') {
        // Often this isn't a real connectivity problem — it's frequently
        // just Chrome complaining that we restarted too soon after the
        // last session ended. The RESTART_DELAY_MS debounce above should
        // prevent most of these going forward; this backoff handles any
        // that still slip through (or genuine transient connectivity
        // issues) without hammering a server that might be unreachable.
        if (!shouldRunRef.current) return;

        if (networkRetryCountRef.current >= MAX_NETWORK_RETRIES) {
          console.error(`[useSpeechToText] giving up after ${MAX_NETWORK_RETRIES} network errors.`);
          pausedRef.current = true;
          return;
        }

        networkRetryCountRef.current += 1;
        console.error(
          `[useSpeechToText] network error (attempt ${networkRetryCountRef.current}/${MAX_NETWORK_RETRIES}).`
        );

        pausedRef.current = true; // suppress onend's own restart below
        const delay = 1000 * 2 ** (networkRetryCountRef.current - 1); // 1s, 2s, 4s
        clearPendingRestart();
        restartTimeoutRef.current = setTimeout(() => {
          restartTimeoutRef.current = null;
          pausedRef.current = false;
          try {
            recognition.start();
            setListening(true);
          } catch {
            // already running
          }
        }, delay);
        return;
      }

      console.error('[useSpeechToText] recognition error:', event.error);
    };

    recognition.onend = () => {
      setListening(false);
      // Auto-restart (debounced) unless the caller explicitly stopped us,
      // or we're deliberately paused while fetching/speaking a response.
      if (shouldRunRef.current && !pausedRef.current) {
        scheduleRestart(recognition);
      }
    };

    recognitionRef.current = recognition;
    return recognition;
  }, [lang]);

  const start = useCallback(
    (onFinalTranscript) => {
      onFinalRef.current = onFinalTranscript;
      shouldRunRef.current = true;
      pausedRef.current = false;
      networkRetryCountRef.current = 0;
      const recognition = getRecognition();
      if (!recognition) return;
      try {
        recognition.start();
        setListening(true);
      } catch {
        // already running — fine
      }
    },
    [getRecognition]
  );

  // Call once a response has finished (or timed out) so listening
  // resumes automatically — no need to re-tap the character. Debounced
  // via scheduleRestart, since this is exactly the path that was
  // triggering the spurious "network" error (restarting right after stop).
  const resume = useCallback(() => {
    pausedRef.current = false;
    if (!shouldRunRef.current) return;
    const recognition = recognitionRef.current;
    if (!recognition) return;
    scheduleRestart(recognition);
  }, []);

  // Call while a response is being fetched/spoken, so the mic doesn't
  // pick up the TTS audio as new user speech.
  const pause = useCallback(() => {
    pausedRef.current = true;
    clearPendingRestart();
    recognitionRef.current?.stop();
  }, []);

  const stop = useCallback(() => {
    shouldRunRef.current = false;
    pausedRef.current = false;
    clearPendingRestart();
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  useEffect(() => {
    return () => {
      shouldRunRef.current = false;
      clearPendingRestart();
      recognitionRef.current?.stop();
    };
  }, []);

  return { start, stop, pause, resume, transcript, listening };
}