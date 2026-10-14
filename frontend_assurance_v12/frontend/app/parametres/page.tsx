import Link from "next/link";
import { CheckCircle2, Package, Settings } from "lucide-react";

export default function ParametresPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-ink)] flex items-center gap-2.5">
          <Settings size={23} className="text-[var(--color-primary)]" />
          Paramètres
        </h1>
        <p className="text-[var(--color-slate)] text-sm mt-1">
          Réglages opérationnels de la plateforme de recommandation.
        </p>
      </header>

      <section className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-6 mb-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 text-green-700 flex items-center justify-center shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <h2 className="font-semibold text-[var(--color-ink)]">API et catalogue connectés</h2>
            <p className="text-sm text-[var(--color-slate)] mt-1">
              Les recommandations et campagnes utilisent uniquement les produits actifs du catalogue persistant.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[var(--color-primary)] flex items-center justify-center shrink-0">
            <Package size={20} />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-[var(--color-ink)]">Disponibilité des produits</h2>
            <p className="text-sm text-[var(--color-slate)] mt-1 mb-4">
              Activez ou désactivez un produit sans le supprimer de la base de données.
            </p>
            <Link
              href="/produits"
              className="inline-flex items-center rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
              Gérer les produits
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}