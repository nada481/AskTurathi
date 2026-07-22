import fs from 'fs';
import path from 'path';

let cachedContent = null;

export function loadContent() {
  if (cachedContent) return cachedContent;

  const filePath = path.join(process.cwd(), 'content', 'kohol.json');
  cachedContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return cachedContent;
}
