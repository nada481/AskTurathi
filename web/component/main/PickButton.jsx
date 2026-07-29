"use client";

import { useState } from "react";

export default function PickButton({ character, onPick }) {
  const [confirmed, setConfirmed] = useState(false);
  const isAvailable = character.available !== false;

  function handleClick() {
    if (!isAvailable) return;
    onPick();
    setConfirmed(true);
    setTimeout(() => setConfirmed(false), 1400);
  }

  let label = "Coming Soon";
  if (isAvailable) {
    label = confirmed ? `${character.name} selected` : `Pick ${character.name}`;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!isAvailable}
      className={`px-8 py-3 rounded-full font-semibold text-[13px] tracking-[0.08em] uppercase
        transition-transform active:scale-95
        ${
          !isAvailable
            ? "bg-white/10 text-[#9b93c2] cursor-not-allowed"
            : confirmed
            ? "bg-[#f0c674] text-[#14102b] hover:-translate-y-0.5"
            : "bg-[#eae6f6] text-[#14102b] hover:-translate-y-0.5"
        }`}
    >
      {label}
    </button>
  );
}
