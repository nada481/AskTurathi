import { getSystemPrompt } from '@/lib/server/contentPrompt';
import { loadContent } from '@/lib/content';
import { getGeminiClient } from '@/lib/server/geminiClient';
import { synthesizeSpeech } from '@/lib/server/synthesizeSpeech';

let cachedFacts = null;
function getFacts() {
  if (!cachedFacts) cachedFacts = loadContent();
  return cachedFacts;
}

/** Ask Gemini and synthesize TTS in one request (saves a client round trip). */
export async function POST(request) {
  const t0 = Date.now();
  try {
    const { question, language = 'en' } = await request.json();
    if (!question) {
      return new Response(JSON.stringify({ error: 'Missing question' }), { status: 400 });
    }

    const facts = getFacts();
    const ai = getGeminiClient();

    const t1 = Date.now();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: question }] }],
      config: {
        systemInstruction: getSystemPrompt(facts, language),
        maxOutputTokens: 180,
      },
    });
    console.log(`[converse] generateContent: ${Date.now() - t1}ms`);

    const answer = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!answer) throw new Error('No answer text returned');

    const { buffer, mime, provider } = await synthesizeSpeech(answer, language);
    console.log(`[converse] total: ${Date.now() - t0}ms (tts=${provider})`);

    return new Response(
      JSON.stringify({
        answer,
        audio: buffer.toString('base64'),
        audioMime: mime,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Converse error:', err);
    const message = err.message?.includes('GEMINI_API_KEY')
      ? err.message
      : 'Failed to generate response';
    const status = message.includes('GEMINI_API_KEY') ? 503 : 500;
    return new Response(JSON.stringify({ error: message }), { status });
  }
}
