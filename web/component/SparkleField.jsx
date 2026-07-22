'use client';

import { useEffect, useState } from 'react';

/**
 * Ambient twinkling sparkle field rendered behind/around the character.
 * Pure CSS/DOM — no Three.js involved. Client-only random positions are
 * generated in an effect to avoid SSR hydration mismatches.
 */
export default function SparkleField() {
  const [sparkles, setSparkles] = useState([]);

  useEffect(() => {
    const generated = Array.from({ length: 26 }, () => ({
      size: 2 + Math.random() * 3,
      left: Math.random() * 100,
      top: Math.random() * 100,
      delay: Math.random() * 6,
      duration: 4 + Math.random() * 4,
    }));
    setSparkles(generated);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {sparkles.map((s, i) => (
        <span
          key={i}
          className="sparkle absolute rounded-full"
          style={{
            width: s.size,
            height: s.size,
            left: `${s.left}%`,
            top: `${s.top}%`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        />
      ))}

      <style jsx>{`
        .sparkle {
          background: #fce6b0;
          box-shadow: 0 0 6px 1px #f4c869;
          opacity: 0;
          animation-name: twinkle;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }
        @keyframes twinkle {
          0%,
          100% {
            opacity: 0;
            transform: scale(0.6);
          }
          50% {
            opacity: 0.85;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}