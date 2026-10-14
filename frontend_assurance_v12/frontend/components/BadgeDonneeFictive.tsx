type BadgeDonneeFictiveProps = {
  label?: string;
};

export default function BadgeDonneeFictive({ label = "Démonstration" }: BadgeDonneeFictiveProps) {
  return (
    <span className="inline-flex items-center text-[9px] uppercase tracking-wide text-slate-500 border border-slate-300 rounded px-1.5 py-0.5 bg-slate-100">
      {label}
    </span>
  );
}
