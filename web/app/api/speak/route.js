import { speakWithElevenLabs } from '@/lib/server/elevenLabsTts';
import { speakWithGemini } from '@/lib/server/geminiTts';
// speak/route.js

// Races a promise against a timeout so a slow/hanging ElevenLabs call
// can't silently eat several seconds before we give up and fall back.
// NOTE: this doesn't cancel the underlying HTTP request inside
// speakWithElevenLabs (that would need an AbortSignal plumbed through it) —
// it just stops *waiting* on it so the fallback can start sooner. If
// ElevenLabs turns out to be the bottleneck, the real fix is passing an
// AbortController/signal into speakWithElevenLabs itself.
function withTimeout(promise, ms, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

export async function POST(request) {
  const t0 = Date.now();
  const { text, language = 'en' } = await request.json();
  if (!text) {
    return new Response(JSON.stringify({ error: 'Missing text' }), { status: 400 });
  }

  try {
    const t1 = Date.now();
    // Cap the ElevenLabs attempt at 4s — if it's going to fail or hang,
    // better to find out fast and fall back than eat a long wait first.
    const result = await withTimeout(speakWithElevenLabs(text, language), 4000, 'ElevenLabs');
    console.log(`[speak] elevenlabs: ${Date.now() - t1}ms`);
    console.log(`[speak] total: ${Date.now() - t0}ms`);
    return result;
  } catch (err) {
    console.warn('ElevenLabs failed, falling back to Gemini TTS:', err.message);
    try {
      const t2 = Date.now();
      const result = await speakWithGemini(text, language);
      console.log(`[speak] gemini fallback: ${Date.now() - t2}ms`);
      console.log(`[speak] total: ${Date.now() - t0}ms`);
      return result;
    } catch (fallbackErr) {
      console.error('Both TTS providers failed:', fallbackErr.message);
      return new Response(JSON.stringify({ error: 'TTS generation failed' }), { status: 500 });
    }
  }
}