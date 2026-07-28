export default function CharacterCaption({ character }) {
  return (
    <div className="text-center min-h-[52px]">
      <div className="font-orbitron font-bold text-2xl tracking-[0.12em] text-[#eae6f6]">
        {character.name}
      </div>
      <div
        className="text-[11px] tracking-[0.2em] uppercase mt-0.5"
        style={{ color: character.accent }}
      >
        {character.role}
      </div>
    </div>
  );
}