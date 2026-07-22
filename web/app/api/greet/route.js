import { getGreetingPrompt } from '@/lib/server/contentPrompt';
import { getGeminiClient } from '@/lib/server/geminiClient';

export async function POST(request) {
  try {
    const { language = 'en' } = await request.json();
    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: 'Greet the child now.' }] }],
      config: { systemInstruction: getGreetingPrompt(language) },
    });

    const greeting = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!greeting) throw new Error('No greeting generated');

    return new Response(JSON.stringify({ greeting }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Greeting error:', err);
    const message = err.message?.includes('GEMINI_API_KEY')
      ? err.message
      : 'Failed to generate greeting';
    const status = message.includes('GEMINI_API_KEY') ? 503 : 500;
    return new Response(JSON.stringify({ error: message }), { status });
  }
}