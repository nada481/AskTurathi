'use client';

import { loadAndPlay } from './playAudio';
import { toSttLang } from './detectLanguage';

/** Last-resort TTS when ElevenLabs/Gemini are unavailable (quota, billing, etc.). */
export function speakWithBrowser(text, language = 'en') {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      reject(new Error('Browser speech not available'));
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = toSttLang(language);
    utterance.rate = 0.95;
    utterance.onend = () => resolve();
    utterance.onerror = (event) => reject(event.error || new Error('Browser speech failed'));
    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Speak text via /api/speak when possible; fall back to the browser voice
 * so the character still talks when cloud TTS fails.
 */
export async function speakCharacter(text, language, audioEl) {
  try {
    const res = await fetch('/api/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language }),
    });
    if (!res.ok) throw new Error(`speak failed: ${res.status}`);

    if (audioEl) {
      await loadAndPlay(audioEl, URL.createObjectURL(await res.blob()));
      await new Promise((resolve, reject) => {
        audioEl.onended = resolve;
        audioEl.onerror = reject;
      });
      return;
    }
  } catch (err) {
    console.warn('[speak] server TTS unavailable, using browser voice:', err.message);
  }

  await speakWithBrowser(text, language);
}
