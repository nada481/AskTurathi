"use client";

import { useRef, useState } from "react";

export default function CharacterCard({
  character,
  index,
  isFocused,
  isSelected,
  onHover,
  onSelect,
}) {
  const videoRef = useRef(null);
  const [videoBroken, setVideoBroken] = useState(false);
  const canPlayVideo = Boolean(character.video) && !videoBroken;

  function handleMouseEnter() {
    onHover(index);
    const v = videoRef.current;
    if (v && canPlayVideo) {
      v.currentTime = 0;
      v.play().catch(() => {});
    }
  }

  function handleMouseLeave() {
    const v = videoRef.current;
    if (v) v.pause();
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => onSelect(index)}
      onKeyDown={(e) => e.key === "Enter" && onSelect(index)}
      style={{ "--card-accent": character.accent }}
      className={`
        relative flex-none aspect-square w-24 sm:w-32 md:w-36 lg:w-[150px]
        rounded-2xl border-[1.5px] bg-transparent cursor-pointer
        flex flex-col items-center justify-end p-3
        transition-all duration-[400ms] ease-[cubic-bezier(.2,.8,.2,1)]
        ${
          isFocused
            ? "opacity-100 scale-[1.18] -translate-y-1.5 z-10 shadow-[0_0_26px_-4px_var(--card-accent)] border-[color:var(--card-accent)]"
            : isSelected
            ? "opacity-80 border-[color:var(--card-accent)] shadow-[0_0_14px_-4px_var(--card-accent)]"
            : "opacity-55 border-white/15"
        }
      `}
    >
      {isSelected && (
        <span
          className="absolute top-2 right-2 w-[18px] h-[18px] rounded-full text-[11px] font-bold text-[#14102b] flex items-center justify-center"
          style={{ background: "var(--card-accent)" }}
        >
          ✓
        </span>
      )}

      <div className="absolute inset-2 bottom-9 rounded-lg overflow-hidden">
        {/* Static picture — always present underneath */}
        <img
          src={character.image}
          alt={character.name}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            isFocused && canPlayVideo ? "opacity-0" : "opacity-100"
          }`}
        />

        {/* Video — only mounted if one exists, plays on hover, falls back to image on error */}
        {character.video && (
          <video
            ref={videoRef}
            src={character.video}
            muted
            loop
            playsInline
            preload="none"
            onError={() => setVideoBroken(true)}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              isFocused && canPlayVideo ? "opacity-100" : "opacity-0"
            }`}
          />
        )}
      </div>

      <div className="relative z-10 font-orbitron text-[11px] tracking-[0.12em] uppercase text-[#eae6f6]">
        {character.name}
      </div>
    </div>
  );
}