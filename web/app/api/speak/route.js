import { speakWithElevenLabs } from '@/lib/server/elevenLabsTts';
import { speakWithGemini } from '@/lib/server/geminiTts';

function withTimeout(promise, ms, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

// Library voices return 402 on free ElevenLabs plans — skip after first failure.
let skipElevenLabs = false;

export async function POST(request) {
  const t0 = Date.now();
  const { text, language = 'en' } = await request.json();
  if (!text) {
    return new Response(JSON.stringify({ error: 'Missing text' }), { status: 400 });
  }

  const hasElevenLabs = Boolean(process.env.ELEVENLABS_API_KEY) && !skipElevenLabs;

  if (hasElevenLabs) {
    try {
      const t1 = Date.now();
      const result = await withTimeout(speakWithElevenLabs(text, language), 4000, 'ElevenLabs');
      console.log(`[speak] elevenlabs: ${Date.now() - t1}ms`);
      console.log(`[speak] total: ${Date.now() - t0}ms`);
      return result;
    } catch (err) {
      if (err.message.includes('402') || err.message.includes('payment_required')) {
        skipElevenLabs = true;
        console.warn('ElevenLabs library voice unavailable on this plan — using Gemini TTS only.');
      } else {
        console.warn('ElevenLabs failed, falling back to Gemini TTS:', err.message);
      }
    }
  }

  try {
    const t2 = Date.now();
    const result = await speakWithGemini(text, language);
    console.log(`[speak] gemini: ${Date.now() - t2}ms`);
    console.log(`[speak] total: ${Date.now() - t0}ms`);
    return result;
  } catch (err) {
    const message = err.message || 'TTS generation failed';
    const isQuota = message.includes('429') || message.includes('RESOURCE_EXHAUSTED');
    console.error('TTS generation failed:', message);
    return new Response(
      JSON.stringify({
        error: isQuota
          ? 'Cloud TTS quota exceeded — client will use browser voice'
          : 'TTS generation failed',
      }),
      { status: isQuota ? 503 : 500 }
    );
  }
}
