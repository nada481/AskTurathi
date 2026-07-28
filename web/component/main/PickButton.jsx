"use client";

import { useState } from "react";

export default function PickButton({ character, onPick }) {
  const [confirmed, setConfirmed] = useState(false);

  function handleClick() {
    onPick();
    setConfirmed(true);
    setTimeout(() => setConfirmed(false), 1400);
  }

  return (
    <button
      onClick={handleClick}
      className={`px-8 py-3 rounded-full font-semibold text-[13px] tracking-[0.08em] uppercase
        transition-transform hover:-translate-y-0.5 active:scale-95
        ${confirmed ? "bg-[#f0c674] text-[#14102b]" : "bg-[#eae6f6] text-[#14102b]"}`}
    >
      {confirmed ? `${character.name} selected` : `Pick ${character.name}`}
    </button>
  );
}