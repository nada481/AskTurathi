'use client';

import { loadAndPlay } from './playAudio';
import { toSttLang } from './detectLanguage';

const PLAYBACK_TIMEOUT_MS = 90000;

function base64ToObjectUrl(base64, mime) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

function waitForPlayback(audioEl) {
  return Promise.race([
    new Promise((resolve, reject) => {
      audioEl.onended = resolve;
      audioEl.onerror = () => reject(new Error('audio playback error'));
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('audio playback timeout')), PLAYBACK_TIMEOUT_MS)
    ),
  ]);
}

/** Play server-returned base64 audio and wait until playback finishes. */
export async function playServerAudio(audioEl, base64, mime) {
  if (!audioEl) throw new Error('audio element not ready');
  const objectUrl = base64ToObjectUrl(base64, mime);
  try {
    await loadAndPlay(audioEl, objectUrl);
    await waitForPlayback(audioEl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Last-resort TTS when server audio is unavailable. */
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

async function playFromSpeakApi(text, language, audioEl) {
  const res = await fetch('/api/speak', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language }),
  });
  if (!res.ok) throw new Error(`speak failed: ${res.status}`);

  const objectUrl = URL.createObjectURL(await res.blob());
  try {
    await loadAndPlay(audioEl, objectUrl);
    await waitForPlayback(audioEl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Speak using server audio (ElevenLabs), then /api/speak, then browser voice.
 */
export async function speakCharacter(text, language, audioEl, serverAudio) {
  if (serverAudio?.audio && audioEl) {
    try {
      await playServerAudio(audioEl, serverAudio.audio, serverAudio.audioMime || 'audio/mpeg');
      return;
    } catch (err) {
      console.warn('[speak] pre-generated audio failed:', err.message);
    }
  }

  if (audioEl) {
    try {
      await playFromSpeakApi(text, language, audioEl);
      return;
    } catch (err) {
      console.warn('[speak] server TTS unavailable:', err.message);
    }
  }

  await speakWithBrowser(text, language);
}
