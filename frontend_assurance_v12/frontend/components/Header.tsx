import { Star, ChevronDown, User } from "lucide-react";

export default function Header() {
  return (
    <header className="h-16 shrink-0 bg-white border-b border-[var(--color-border)] flex items-center justify-between px-6">
      <div className="flex items-center gap-2 w-56 shrink-0">
        <Star size={26} className="text-[var(--color-primary)] fill-[var(--color-primary)]" />
        <div className="leading-none">
          <p className="font-[family-name:var(--font-display)] font-extrabold text-[var(--color-ink)] text-base tracking-tight">
            STAR
          </p>
          <p className="text-[9px] tracking-[0.2em] text-[var(--color-slate)] font-medium">ASSURANCE</p>
        </div>
      </div>

      <div className="flex-1 text-center px-4">
        <h1 className="font-[family-name:var(--font-display)] font-bold text-[var(--color-ink)] text-lg tracking-tight">
          PROJET IAA — RECOMMANDATION DE PRODUITS D&apos;ASSURANCE
        </h1>
        <p className="text-xs text-[var(--color-slate)] mt-0.5">
          Agent IA intelligent pour recommander le bon produit, au bon client, au bon moment.
        </p>
      </div>

      <div className="flex items-center gap-2 w-56 shrink-0 justify-end">
        <div className="w-9 h-9 rounded-full bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-slate)]">
          <User size={17} />
        </div>
        <div className="text-sm leading-tight">
          <p className="text-[var(--color-slate)] text-xs">Bienvenue,</p>
          <p className="font-medium text-[var(--color-ink)]">Conseiller</p>
        </div>
        <ChevronDown size={16} className="text-[var(--color-slate)]" />
      </div>
    </header>
  );
}
