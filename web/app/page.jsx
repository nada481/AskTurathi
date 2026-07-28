'use client';
 
import { useState } from "react";
import Starfield from "@/component/main/Starfield";
import CharacterRow from "@/component/main/CharacterRow";
import CharacterCaption from "@/component/main/CharacterCaption";
import PickButton from "@/component/main/PickButton";
import { CHARACTERS } from "@/lib/data/character.js";
 
export default function SelectUnitPage() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [focusIndex, setFocusIndex] = useState(0);
 
  function handleSelect(i) {
    setActiveIndex(i);
    setFocusIndex(i);
  }
 
  const focused = CHARACTERS[focusIndex];
 
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#07071a] text-[#eae6f6] font-sans">
      {/* nebula backdrop */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 45% at 50% 62%, rgba(140,110,230,0.28), transparent 60%), radial-gradient(ellipse 80% 60% at 50% 30%, rgba(70,50,150,0.32), transparent 65%)",
        }}
      />
      <Starfield />
 
      <div className="fixed top-6 left-6 z-10 w-[42px] h-[42px] rounded-full border border-white/25 bg-black/40 backdrop-blur-sm flex items-center justify-center font-orbitron text-sm text-[#f0c674]">
        ✦
      </div>
 
      <div className="relative z-10 h-full flex flex-col items-center justify-center gap-6 px-4">
        <header className="text-center">
          <h1 className="font-orbitron font-black text-2xl md:text-3xl tracking-[0.18em] [text-shadow:0_0_20px_rgba(150,120,255,0.4)]">
            Select Unit
          </h1>
          <p className="mt-2 text-sm tracking-wide text-[#9b93c2]">
            Hover a character to preview, click to pick
          </p>
        </header>
 
        <CharacterRow
          characters={CHARACTERS}
          activeIndex={activeIndex}
          focusIndex={focusIndex}
          onFocus={setFocusIndex}
          onSelect={handleSelect}
        />
 
        <div className="flex flex-col items-center gap-3.5">
          <CharacterCaption character={focused} />
          <PickButton character={focused} onPick={() => handleSelect(focusIndex)} />
          <footer className="text-[10.5px] tracking-wide uppercase text-[#9b93c2]">
            Developed by Nada 2026
          </footer>
        </div>
      </div>
    </div>
  );
}