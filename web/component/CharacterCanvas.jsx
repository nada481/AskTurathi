'use client';

import { useEffect, useRef, forwardRef } from 'react';
import { useCharacterScene } from './useCharacterScene';
import SparkleField from './SparkleField';
import CharacterOverlay from './CharacterOverlay';

/**
 * "Living artifact" character. All Three.js/WebGL logic lives in
 * useCharacterScene(); this component is just wiring + layout:
 *   - useCharacterScene.js  — GLTF loading, render loop, setMouthWeights API
 *   - SparkleField.jsx      — ambient CSS sparkle background
 *   - CharacterOverlay.jsx  — vignette + hint ring only, no on-screen text
 *
 * Props:
 *   state    - 'idle' | 'waking' | 'listening' | 'thinking' | 'speaking'
 *   subtitle - accepted for API compatibility but intentionally not
 *              rendered anywhere; nothing here shows on-screen text/bubbles
 *   onWake   - called when the user taps/clicks the character while idle
 *
 * Ref methods:
 *   setMouthWeights(weights) - called every frame during speech by useMouthSync
 */
const CharacterCanvas = forwardRef(function CharacterCanvas(
  { state = 'idle', subtitle = '', onWake },
  ref
) {
  const containerRef = useRef(null);
  const { modelError } = useCharacterScene(containerRef, ref, state, onWake);
  const awake = state !== 'idle';

  // Model load failures are surfaced to the console only — no on-screen text
  useEffect(() => {
    if (modelError) {
      console.error('[CharacterCanvas] model error:', modelError);
    }
  }, [modelError]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[radial-gradient(ellipse_at_50%_38%,_#2E2159_0%,_#1B1440_32%,_#100C2E_58%,_#0A0818_100%)]">
      {/* Three.js canvas mounts here */}
      <div ref={containerRef} className="absolute inset-0" />

      <SparkleField />
      <CharacterOverlay awake={awake} />
    </div>
  );
});

export default CharacterCanvas;