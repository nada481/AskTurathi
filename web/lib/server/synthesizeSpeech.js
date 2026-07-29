import { speakWithElevenLabs } from '@/lib/server/elevenLabsTts';
import { speakWithGemini } from '@/lib/server/geminiTts';

let skipElevenLabs = false;

function withTimeout(promise, ms, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

/** Generate speech audio on the server. Prefers Gemini when ELEVENLABS_API_KEY is unset. */
export async function synthesizeSpeech(text, language = 'en') {
  const preferGemini = process.env.TTS_PROVIDER === 'gemini';
  const hasElevenLabs = Boolean(process.env.ELEVENLABS_API_KEY) && !skipElevenLabs && !preferGemini;

  if (hasElevenLabs) {
    try {
      const t1 = Date.now();
      const response = await withTimeout(speakWithElevenLabs(text, language), 2000, 'ElevenLabs');
      const buffer = Buffer.from(await response.arrayBuffer());
      console.log(`[tts] elevenlabs: ${Date.now() - t1}ms`);
      return {
        buffer,
        mime: response.headers.get('Content-Type') || 'audio/mpeg',
        provider: 'elevenlabs',
      };
    } catch (err) {
      if (err.message.includes('402') || err.message.includes('payment_required')) {
        skipElevenLabs = true;
        console.warn('ElevenLabs unavailable on this plan — using Gemini TTS.');
      } else {
        console.warn('ElevenLabs failed, falling back to Gemini TTS:', err.message);
      }
    }
  }

  const t2 = Date.now();
  const response = await speakWithGemini(text, language);
  const buffer = Buffer.from(await response.arrayBuffer());
  console.log(`[tts] gemini: ${Date.now() - t2}ms`);
  return { buffer, mime: 'audio/wav', provider: 'gemini' };
}
