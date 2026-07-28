// component/data/holoPaths.js

// Simple placeholder silhouette — generic humanoid-ish blob.
// Swap this out per-character once real artwork is ready.
const PLACEHOLDER_PATH =
  'M50 8 C62 8 70 18 70 32 C70 44 64 50 58 54 ' +
  'C74 60 84 76 84 96 L84 132 L16 132 L16 96 ' +
  'C16 76 26 60 42 54 C36 50 30 44 30 32 C30 18 38 8 50 8 Z';

// Deterministic hue per character id so placeholders look distinct
const HUES = [
  '#38bdf8', // sky
  '#a78bfa', // violet
  '#fb923c', // orange
  '#4ade80', // green
  '#f472b6', // pink
  '#facc15', // yellow
  '#22d3ee', // cyan
  '#f87171', // red
];

function hashId(id) {
  let hash = 0;
  const str = String(id ?? '');
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getHolo(characterId) {
  const hue = HUES[hashId(characterId) % HUES.length];

  return {
    d: PLACEHOLDER_PATH,
    hue,
  };
}