
'use client';
import { useState, useRef, useCallback } from 'react';
import { useSpeechToText } from './useSpeechToText';
import { useMouthSync } from './useMouthSync';


const GREETINGS = {
  en: "Hello, little explorer! I'm kahoola, the magical kohl applicator. Come closer and ask me about my stories!",
  ar: "مَرْحَباً أَيُّهَا المُسْتَكْشِفُ الصَّغِير! أَنَا كَّحُّول، مِكْحَلَةٌ سِحْرِيَّةٌ، أَتَتْ مِنْ زَمَنٍ بَعِيدٍ لِتَرْوِيَ لَكُم بعض القصص، وَتُجِيبَكُمْ عَنْ أَسْئِلَتِكُم!",
};


export function useConversation(characterRef, language = 'en') {
  const [state, setState] = useState('idle'); // idle | waking | listening | thinking | speaking
  const [subtitle, setSubtitle] = useState('');
  const { start: startSTT, stop: stopSTT } = useSpeechToText({ lang: language === 'ar' ? 'ar-SA' : 'en-US' });
  const { start: startMouthSync } = useMouthSync();
  const silenceTimerRef = useRef(null);

  const speak = useCallback(async (text) => {
    setState('speaking');
    setSubtitle(text);

    const res = await fetch('/api/speak', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
    const audioBlob = await res.blob();
    const audioEl = new Audio(URL.createObjectURL(audioBlob));

    startMouthSync(audioEl, (weights) => characterRef.current?.setMouthWeights(weights));

    await new Promise((resolve) => {
      audioEl.addEventListener('ended', resolve, { once: true });
      audioEl.play();
    });

    listenAgain();
  }, [startMouthSync, characterRef]);

  const askAndRespond = useCallback(async (question) => {
    setState('thinking');
    const res = await fetch('/api/ask', {
      method: 'POST',
      body: JSON.stringify({ question, language }),
    });
    const { answer } = await res.json();
    await speak(answer);
  }, [language, speak]);

  const listenAgain = useCallback(() => {
    setState('listening');
    clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => goIdle(), SILENCE_TIMEOUT_MS);

    startSTT((finalText) => {
      clearTimeout(silenceTimerRef.current);
      stopSTT();
      askAndRespond(finalText);
    });
  }, [startSTT, stopSTT, askAndRespond]);

  const goIdle = useCallback(() => {
    stopSTT();
    setState('idle');
    setSubtitle('');
  }, [stopSTT]);

const FALLBACK_GREETINGS = {
  en: "Hello, little explorer! I'm Kohol, the magical kohl applicator. Come closer and ask me about my stories!",
  ar: "مرحباً يا مستكشف الصغير! أنا كَحُّوله، مِكحلة سحرية. اقترب واسألني ما تريد!",
};

const wake = useCallback(async () => {
  if (state !== 'idle') return;
  setState('thinking');

  let greetingText;
  try {
    const res = await fetch('/api/greet', {
      method: 'POST',
      body: JSON.stringify({ language }),
    });
    const data = await res.json();
    greetingText = data.greeting;
  } catch (err) {
    console.warn('Greeting generation failed, using fallback:', err);
  }

  await speak(greetingText || FALLBACK_GREETINGS[language]);
}, [state, language, speak]);

  return { state, subtitle, wake, goIdle };
}