'use client';
 
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Starfield from "@/component/main/Starfield";
import CharacterRow from "@/component/main/CharacterRow";
import CharacterCaption from "@/component/main/CharacterCaption";
import PickButton from "@/component/main/PickButton";
import { CHARACTERS } from "@/lib/data/character.js";
 
export default function SelectUnitPage() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const [focusIndex, setFocusIndex] = useState(0);
  const [previewKey, setPreviewKey] = useState(0);

  function handleSelect(i) {
    setActiveIndex(i);
    setFocusIndex(i);
  }

  function handleFocus(i) {
    setFocusIndex(i);
    setPreviewKey((key) => key + 1);
  }

  function handlePreviewEnd() {
    setPreviewKey(0);
  }

  function handlePick() {
    const character = CHARACTERS[focusIndex];
    handleSelect(focusIndex);
    if (character.route) {
      router.push(character.route);
    }
  }
 
  const focused = CHARACTERS[focusIndex];

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setFocusIndex((i) => {
          const next = (i - 1 + CHARACTERS.length) % CHARACTERS.length;
          setPreviewKey((key) => key + 1);
          return next;
        });
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setFocusIndex((i) => {
          const next = (i + 1) % CHARACTERS.length;
          setPreviewKey((key) => key + 1);
          return next;
        });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
 
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#07071a] text-[#eae6f6] font-sans">
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
 
      <div className="relative z-10 h-full flex flex-col items-center justify-center gap-5 px-4">
        <header className="text-center">
          <h1 className="font-orbitron font-black text-2xl md:text-3xl tracking-[0.12em] [text-shadow:0_0_20px_rgba(150,120,255,0.4)]">
            Choose a Character
          </h1>
          <p className="mt-2 text-sm tracking-wide text-[#9b93c2]">
            Hover over a character or use the arrow keys to hear a preview, then click to choose.
          </p>
        </header>

        <CharacterRow
          characters={CHARACTERS}
          activeIndex={activeIndex}
          focusIndex={focusIndex}
          playKey={previewKey}
          onFocus={handleFocus}
          onFocusReset={setFocusIndex}
          onPreviewEnd={handlePreviewEnd}
          onSelect={handleSelect}
        />
 
        <div className="flex flex-col items-center gap-3.5">
          <CharacterCaption character={focused} />
          <PickButton character={focused} onPick={handlePick} />
          <footer className="text-[10.5px] tracking-wide uppercase text-[#9b93c2]">
            Developed by Nada 2026
          </footer>
        </div>
      </div>
    </div>
  );
}
