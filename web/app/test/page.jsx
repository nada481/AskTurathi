'use client';

import { useState, useRef, useEffect } from 'react';
import { useSpeechToText } from '@/lib/useSpeechToText';
import CharacterCanvas from '@/component/CharacterCanvas';
import { useConversation } from '@/lib/useConversation';
 
export default function TestPage() {
  const characterRef = useRef(null);
  const { state, subtitle, wake, audioRef } = useConversation(characterRef, 'en');
 
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <CharacterCanvas
        ref={characterRef}
        state={state}
        subtitle={subtitle}
        onWake={wake}
      />
      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  );
}
 