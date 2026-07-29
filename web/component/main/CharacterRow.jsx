"use client";

import { useEffect, useRef } from "react";
import CharacterCard from "./CharacterCard";

function NavArrow({ direction, onClick, label }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex-none flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full border border-white/20 bg-black/35 text-[#eae6f6] backdrop-blur-sm transition-all hover:border-[#f0c674]/50 hover:bg-black/55 hover:text-[#f0c674] active:scale-95"
    >
      <span className="text-xl leading-none">{direction === "left" ? "‹" : "›"}</span>
    </button>
  );
}

export default function CharacterRow({
  characters,
  activeIndex,
  focusIndex,
  playKey,
  onFocus,
  onFocusReset,
  onPreviewEnd,
  onSelect,
}) {
  const viewportRef = useRef(null);
  const rowRef = useRef(null);

  function shiftTo(i) {
    const viewport = viewportRef.current;
    const row = rowRef.current;
    const card = row?.children[i];
    if (!viewport || !row || !card) return;

    const viewportWidth = viewport.clientWidth;
    const rowWidth = row.scrollWidth;
    const cardCenter = card.offsetLeft + card.offsetWidth / 2;
    const desired = viewportWidth / 2 - cardCenter;

    const minOffset = Math.min(0, viewportWidth - rowWidth);
    const clamped = Math.max(minOffset, Math.min(0, desired));

    row.style.transform = `translateX(${clamped}px)`;
  }

  function goTo(delta) {
    const next =
      (focusIndex + delta + characters.length) % characters.length;
    onFocus(next);
  }

  useEffect(() => {
    shiftTo(focusIndex);
    const handleResize = () => shiftTo(focusIndex);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [focusIndex]);

  return (
    <div className="flex w-[96vw] max-w-[980px] items-center gap-2 sm:gap-4">
      <NavArrow
        direction="left"
        label="Previous character"
        onClick={() => goTo(-1)}
      />

      <div
        ref={viewportRef}
        onMouseLeave={() => {
          onFocusReset(activeIndex);
          onPreviewEnd?.();
        }}
        className="min-w-0 flex-1 overflow-x-hidden overflow-y-visible py-3"
      >
        <div
          ref={rowRef}
          className="flex w-max items-center gap-2 sm:gap-4 md:gap-5 transition-transform duration-[450ms] ease-[cubic-bezier(.2,.8,.2,1)] will-change-transform"
        >
          {characters.map((c, i) => (
            <CharacterCard
              key={c.id}
              character={c}
              index={i}
              isFocused={i === focusIndex}
              isSelected={i === activeIndex}
              playKey={playKey}
              onHover={onFocus}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>

      <NavArrow
        direction="right"
        label="Next character"
        onClick={() => goTo(1)}
      />
    </div>
  );
}
