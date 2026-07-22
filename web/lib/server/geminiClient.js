import { GoogleGenAI } from '@google/genai';

export function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Add it to web/.env.local and restart the dev server.'
    );
  }
  return new GoogleGenAI({ apiKey });
}
