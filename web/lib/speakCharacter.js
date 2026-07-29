'use client';

import { loadAndPlay } from './playAudio';
import { toSttLang } from './detectLanguage';

function base64ToObjectUrl(base64, mime) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

/** Play server-returned base64 audio and wait until playback finishes. */
export async function playServerAudio(audioEl, base64, mime) {
  if (!audioEl) throw new Error('audio element not ready');
  const objectUrl = base64ToObjectUrl(base64, mime);
  try {
    await loadAndPlay(audioEl, objectUrl);
    await new Promise((resolve, reject) => {
      audioEl.onended = resolve;
      audioEl.onerror = reject;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

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
 * Speak using pre-generated server audio when available; otherwise call /api/speak
 * or fall back to the browser voice.
 */
export async function speakCharacter(text, language, audioEl, serverAudio) {
  if (serverAudio?.audio && audioEl) {
    try {
      await playServerAudio(audioEl, serverAudio.audio, serverAudio.audioMime || 'audio/wav');
      return;
    } catch (err) {
      console.warn('[speak] pre-generated audio failed, retrying TTS:', err.message);
    }
  }

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
