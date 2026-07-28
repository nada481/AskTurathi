"use client";

import { useEffect, useRef } from "react";
import CharacterCard from "./CharacterCard";

export default function CharacterRow({
  characters,
  activeIndex,
  focusIndex,
  onFocus,
  onSelect,
}) {
  const viewportRef = useRef(null);
  const rowRef = useRef(null);

  // Only shifts the row when the cards don't all fit in the viewport.
  // If everything already fits, the offset clamps back to 0 and nothing moves.
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

  useEffect(() => {
    shiftTo(focusIndex);
    const handleResize = () => shiftTo(focusIndex);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [focusIndex]);

  return (
    <div
      ref={viewportRef}
      onMouseLeave={() => onFocus(activeIndex)}
      className="w-[94vw] max-w-[900px] overflow-x-hidden overflow-y-visible py-5"
    >
      <div
        ref={rowRef}
        className="flex items-center gap-2.5 sm:gap-5 md:gap-6 w-max transition-transform duration-[450ms] ease-[cubic-bezier(.2,.8,.2,1)] will-change-transform"
      >
        {characters.map((c, i) => (
          <CharacterCard
            key={c.id}
            character={c}
            index={i}
            isFocused={i === focusIndex}
            isSelected={i === activeIndex}
            onHover={onFocus}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}