//sends child's question to Claude, gets an answer (only from vetted facts)
//ask/route.js
import { getSystemPrompt } from '@/lib/server/contentPrompt';
import { loadContent } from '@/lib/content';
import { getGeminiClient } from '@/lib/server/geminiClient';

// Cache the parsed facts across requests instead of re-reading/parsing the
// JSON file on every single call. loadContent() presumably does a
// synchronous file read — cheap per-call, but pointless repeated I/O on a
// file that never changes at runtime.
let cachedFacts = null;
function getFacts() {
  if (!cachedFacts) {
    cachedFacts = loadContent();
  }
  return cachedFacts;
}

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
        // Cap response length — an unbounded response takes noticeably
        // longer to generate than a short one, and this is a voice app
        // where the answer gets read aloud, so it should be brief anyway.
        maxOutputTokens: 150,
      },
    });
    console.log(`[ask] generateContent: ${Date.now() - t1}ms`);

    const answer = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!answer) throw new Error('No answer text returned');

    console.log(`[ask] total: ${Date.now() - t0}ms`);
    return new Response(JSON.stringify({ answer }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Ask error:', err);
    const message = err.message?.includes('GEMINI_API_KEY')
      ? err.message
      : 'Failed to generate answer';
    const status = message.includes('GEMINI_API_KEY') ? 503 : 500;
    return new Response(JSON.stringify({ error: message }), { status });
  }
}