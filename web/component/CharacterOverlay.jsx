'use client';

/**
 * Purely visual chrome layered over the 3D canvas — no text anywhere.
 * Just the vignette and the dashed "tap me" hint ring shape (shown only
 * while idle) so there's a subtle affordance without any on-screen copy.
 */
export default function CharacterOverlay({ awake }) {
  return (
    <>
      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_45%,_transparent_40%,_rgba(6,4,18,0.55)_85%,_rgba(4,3,12,0.85)_100%)]" />

      {/* Hint ring, only while idle — shape only, no text */}
      {!awake && (
        <div className="hint-ring absolute left-1/2 top-1/2 w-[230px] h-[230px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[rgba(244,200,105,0.35)] pointer-events-none" />
      )}

      <style jsx>{`
        .hint-ring {
          animation: spin 18s linear infinite, ring-pulse 2.4s ease-in-out infinite;
        }
        @keyframes spin {
          from {
            transform: translate(-50%, -50%) rotate(0deg);
          }
          to {
            transform: translate(-50%, -50%) rotate(360deg);
          }
        }
        @keyframes ring-pulse {
          0%,
          100% {
            opacity: 0.35;
          }
          50% {
            opacity: 0.75;
          }
        }
      `}</style>
    </>
  );
}