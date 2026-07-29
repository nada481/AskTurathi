"use client";

import { useEffect, useRef, useState } from "react";

export default function CharacterCard({
  character,
  index,
  isFocused,
  isSelected,
  playKey,
  onHover,
  onSelect,
}) {
  const videoRef = useRef(null);
  const [videoBroken, setVideoBroken] = useState(false);
  const canPlayVideo = Boolean(character.video) && !videoBroken;
  const shouldPlay = isFocused && playKey > 0 && canPlayVideo;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !canPlayVideo) return;

    if (!shouldPlay) {
      video.pause();
      video.currentTime = 0;
      return;
    }

    video.currentTime = 0;
    video.muted = false;
    video.volume = 0.9;
    video.play().catch(() => {
      video.muted = true;
      video.play().catch(() => {});
    });

    return () => {
      video.pause();
      video.currentTime = 0;
    };
  }, [shouldPlay, canPlayVideo, character.video, playKey]);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onMouseEnter={() => onHover(index)}
      onClick={() => onSelect(index)}
      onKeyDown={(e) => e.key === "Enter" && onSelect(index)}
      style={{ "--card-accent": character.accent }}
      className={`
        relative flex-none cursor-pointer rounded-2xl border-[1.5px] bg-transparent
        flex flex-col items-center justify-end p-3
        transition-all duration-[400ms] ease-[cubic-bezier(.2,.8,.2,1)]
        ${
          isFocused
            ? "aspect-square w-40 sm:w-48 md:w-52 opacity-100 scale-100 z-10 shadow-[0_0_30px_-4px_var(--card-accent)] border-[color:var(--card-accent)]"
            : "aspect-square w-20 sm:w-24 md:w-28 opacity-55 border-white/15 scale-95"
        }
        ${
          isSelected && !isFocused
            ? "opacity-80 border-[color:var(--card-accent)] shadow-[0_0_14px_-4px_var(--card-accent)]"
            : ""
        }
      `}
    >
      {isSelected && (
        <span
          className="absolute top-2 right-2 z-20 w-[18px] h-[18px] rounded-full text-[11px] font-bold text-[#14102b] flex items-center justify-center"
          style={{ background: "var(--card-accent)" }}
        >
          ✓
        </span>
      )}

      <div className="absolute inset-2 bottom-9 rounded-lg overflow-hidden">
        <img
          src={character.image}
          alt={character.name}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            shouldPlay ? "opacity-0" : "opacity-100"
          }`}
        />

        {character.video && (
          <video
            ref={videoRef}
            src={character.video}
            loop
            playsInline
            preload="metadata"
            onError={() => setVideoBroken(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
              shouldPlay ? "opacity-100" : "opacity-0"
            }`}
          />
        )}
      </div>

      {isFocused && shouldPlay && (
        <span className="absolute top-2 left-2 z-20 text-[9px] tracking-wide text-[#9b93c2]">
          🔊
        </span>
      )}

      <div className="relative z-10 font-orbitron text-[10px] sm:text-[11px] tracking-[0.12em] uppercase text-[#eae6f6]">
        {character.name}
      </div>
    </div>
  );
}
