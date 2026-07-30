'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * Continuous speech recognition with silence-based utterance end.
 * After `silenceTimeoutMs` with no new words (default 3s), the
 * captured text is finalized and passed to the callback.
 */
export function useSpeechToText({
  lang: initialLang = 'en-US',
  onActivity,
  silenceTimeoutMs = 3000,
} = {}) {
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const langRef = useRef(initialLang);
  const silenceTimeoutRef = useRef(silenceTimeoutMs);
  silenceTimeoutRef.current = silenceTimeoutMs;

  const recognitionRef = useRef(null);
  const onFinalRef = useRef(null);
  const onActivityRef = useRef(onActivity);
  onActivityRef.current = onActivity;

  const shouldRunRef = useRef(false);
  const pausedRef = useRef(false);
  const networkRetryCountRef = useRef(0);
  const restartTimeoutRef = useRef(null);
  const silenceWatchRef = useRef(null);
  const pendingTranscriptRef = useRef('');
  const lastSpeechAtRef = useRef(0);

  const clearPendingRestart = () => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
  };

  const stopSilenceWatch = () => {
    if (silenceWatchRef.current) {
      clearInterval(silenceWatchRef.current);
      silenceWatchRef.current = null;
    }
  };

  const finalizePending = () => {
    const recognition = recognitionRef.current;
    const text = pendingTranscriptRef.current.trim();
    pendingTranscriptRef.current = '';
    stopSilenceWatch();

    if (!text || !recognition) return;

    networkRetryCountRef.current = 0;
    pausedRef.current = true;
    setTranscript(text);
    try {
      recognition.stop();
    } catch {
      // already stopped
    }
    setListening(false);
    onFinalRef.current?.(text);
  };

  const startSilenceWatch = () => {
    stopSilenceWatch();
    silenceWatchRef.current = setInterval(() => {
      if (pausedRef.current || !shouldRunRef.current) return;

      const text = pendingTranscriptRef.current.trim();
      if (!text) return;

      const quietFor = Date.now() - lastSpeechAtRef.current;
      if (quietFor >= silenceTimeoutRef.current) {
        finalizePending();
      }
    }, 200);
  };

  const noteSpeech = (text) => {
    if (!text || text === pendingTranscriptRef.current) return;
    pendingTranscriptRef.current = text;
    lastSpeechAtRef.current = Date.now();
    setTranscript(text);
    onActivityRef.current?.();
  };

  const scheduleRestart = (recognition, delay = 250) => {
    clearPendingRestart();
    restartTimeoutRef.current = setTimeout(() => {
      restartTimeoutRef.current = null;
      try {
        recognition.start();
        setListening(true);
      } catch {
        // already started
      }
    }, delay);
  };

  const getRecognition = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = langRef.current;
      return recognitionRef.current;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('[useSpeechToText] SpeechRecognition not supported in this browser.');
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = langRef.current;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let combined = '';
      for (let i = 0; i < event.results.length; i++) {
        combined += event.results[i][0].transcript;
      }
      noteSpeech(combined.trim());
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') return;

      if (event.error === 'network') {
        if (!shouldRunRef.current) return;

        if (networkRetryCountRef.current >= 3) {
          console.error('[useSpeechToText] giving up after 3 network errors.');
          pausedRef.current = true;
          return;
        }

        networkRetryCountRef.current += 1;
        pausedRef.current = true;
        const delay = 1000 * 2 ** (networkRetryCountRef.current - 1);
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
      if (shouldRunRef.current && !pausedRef.current) {
        scheduleRestart(recognition);
      }
    };

    recognitionRef.current = recognition;
    return recognition;
  }, []);

  const setLanguage = useCallback((newLang) => {
    if (langRef.current === newLang) return;
    langRef.current = newLang;
    if (recognitionRef.current) {
      recognitionRef.current.lang = newLang;
    }
  }, []);

  const start = useCallback(
    (onFinalTranscript) => {
      onFinalRef.current = onFinalTranscript;
      shouldRunRef.current = true;
      pausedRef.current = false;
      networkRetryCountRef.current = 0;
      pendingTranscriptRef.current = '';
      lastSpeechAtRef.current = Date.now();

      const recognition = getRecognition();
      if (!recognition) return;

      startSilenceWatch();

      try {
        recognition.start();
        setListening(true);
      } catch {
        // already running
      }
    },
    [getRecognition]
  );

  const resume = useCallback(() => {
    pausedRef.current = false;
    pendingTranscriptRef.current = '';
    lastSpeechAtRef.current = Date.now();

    if (!shouldRunRef.current) return;

    startSilenceWatch();

    const recognition = recognitionRef.current;
    if (!recognition) return;
    scheduleRestart(recognition);
  }, []);

  const pause = useCallback(() => {
    pausedRef.current = true;
    pendingTranscriptRef.current = '';
    stopSilenceWatch();
    clearPendingRestart();
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const stop = useCallback(() => {
    shouldRunRef.current = false;
    pausedRef.current = false;
    pendingTranscriptRef.current = '';
    stopSilenceWatch();
    clearPendingRestart();
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  useEffect(() => {
    return () => {
      shouldRunRef.current = false;
      stopSilenceWatch();
      clearPendingRestart();
      recognitionRef.current?.stop();
    };
  }, []);

  return { start, stop, pause, resume, setLanguage, transcript, listening };
}
