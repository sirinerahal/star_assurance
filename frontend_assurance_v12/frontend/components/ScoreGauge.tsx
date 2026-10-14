type ScoreGaugeProps = {
  score: number; // 0 à 100
  size?: number;
  label?: string;
};

function couleurPourScore(score: number): string {
  if (score >= 70) return "#16a34a"; // vert : forte appétence
  if (score >= 45) return "#2563eb"; // bleu : appétence moyenne
  return "#94a3b8"; // gris : faible appétence
}

export default function ScoreGauge({ score, size = 64, label }: ScoreGaugeProps) {
  const radius = (size - 8) / 2;
  const circonference = 2 * Math.PI * radius;
  const progression = circonference * (1 - score / 100);
  const couleur = couleurPourScore(score);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={6}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={couleur}
            strokeWidth={6}
            strokeDasharray={circonference}
            strokeDashoffset={progression}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-[family-name:var(--font-mono)] font-semibold"
            style={{ fontSize: size * 0.24, color: couleur }}
          >
            {Math.round(score)}
          </span>
        </div>
      </div>
      {label && <span className="text-[11px] text-[var(--color-slate)] font-medium">{label}</span>}
    </div>
  );
}
