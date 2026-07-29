import { synthesizeSpeech } from '@/lib/server/synthesizeSpeech';

export async function POST(request) {
  const t0 = Date.now();
  const { text, language = 'en' } = await request.json();
  if (!text) {
    return new Response(JSON.stringify({ error: 'Missing text' }), { status: 400 });
  }

  try {
    const { buffer, mime, provider } = await synthesizeSpeech(text, language);
    console.log(`[speak] total: ${Date.now() - t0}ms (${provider})`);
    return new Response(buffer, {
      headers: { 'Content-Type': mime, 'X-TTS-Provider': provider },
    });
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
