"use client";

type Props = {
  valeurMin: number;
  valeurMax: number;
  onChange: (min: number, max: number) => void;
  couleur?: string;
};

export default function DualRangeSlider({ valeurMin, valeurMax, onChange, couleur = "#2563eb" }: Props) {
  function changerMin(v: number) {
    const nouveauMin = Math.min(v, valeurMax - 1);
    onChange(nouveauMin, valeurMax);
  }
  function changerMax(v: number) {
    const nouveauMax = Math.max(v, valeurMin + 1);
    onChange(valeurMin, nouveauMax);
  }

  return (
    <div className="relative h-6 flex items-center">
      <div className="absolute w-full h-1.5 bg-[var(--color-border)] rounded-full" />
      <div
        className="absolute h-1.5 rounded-full"
        style={{ left: `${valeurMin}%`, width: `${valeurMax - valeurMin}%`, backgroundColor: couleur }}
      />
      <input
        type="range"
        min={0}
        max={100}
        value={valeurMin}
        onChange={(e) => changerMin(Number(e.target.value))}
        className="dual-range-thumb"
        style={{ "--thumb-color": couleur } as React.CSSProperties}
      />
      <input
        type="range"
        min={0}
        max={100}
        value={valeurMax}
        onChange={(e) => changerMax(Number(e.target.value))}
        className="dual-range-thumb"
        style={{ "--thumb-color": couleur } as React.CSSProperties}
      />
    </div>
  );
}
