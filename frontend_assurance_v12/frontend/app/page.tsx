import { getDashboardStats } from "@/lib/api";
import { NOMS_PRODUITS } from "@/lib/produits";
import { Users, TrendingUp, ShoppingCart, Smile } from "lucide-react";
import ScoreGauge from "@/components/ScoreGauge";

function formatMontantTND(montant: number): string {
  if (montant >= 1_000_000_000) return `${(montant / 1_000_000_000).toFixed(2)} MD TND`;
  if (montant >= 1_000_000) return `${(montant / 1_000_000).toFixed(2)} M TND`;
  return `${montant.toLocaleString("fr-FR")} TND`;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-5 flex items-start gap-4">
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: accent + "1a", color: accent }}
      >
        <Icon size={20} strokeWidth={2.2} />
      </div>
      <div>
        <p className="text-2xl font-[family-name:var(--font-mono)] font-semibold text-[var(--color-ink)]">
          {value}
        </p>
        <p className="text-sm text-[var(--color-slate)] mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  const maxProduit = Math.max(...stats.top_produits.map((p) => p.nb_contrats), 1);
  const maxProfession = Math.max(...stats.repartition_profession.map((p) => p.nb_clients), 1);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-ink)]">Vue d&apos;ensemble</h1>
        <p className="text-[var(--color-slate)] text-sm mt-1">
          Indicateurs clés de la plateforme de recommandation
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard icon={Users} label="Clients analysés" value={stats.nb_clients.toLocaleString("fr-FR")} accent="#2563eb" />
        <KpiCard icon={TrendingUp} label="Taux de conversion" value={`${stats.taux_conversion}%`} accent="#16a34a" />
        <KpiCard icon={ShoppingCart} label="Ventes additionnelles" value={formatMontantTND(stats.ventes_additionnelles)} accent="#7c3aed" />
        <KpiCard icon={Smile} label="Satisfaction client" value={`${stats.satisfaction_client}%`} accent="#f97316" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-6">
          <h2 className="font-semibold text-[var(--color-ink)] mb-4">Produits les plus souscrits</h2>
          <div className="space-y-3">
            {stats.top_produits.map((p) => (
              <div key={p.produit_code} className="flex items-center gap-3">
                <span className="text-sm text-[var(--color-slate)] w-40 shrink-0 truncate">
                  {NOMS_PRODUITS[p.produit_code] || p.produit_code}
                </span>
                <div className="flex-1 h-2.5 bg-[var(--color-surface)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-primary)] rounded-full"
                    style={{ width: `${(p.nb_contrats / maxProduit) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-[family-name:var(--font-mono)] text-[var(--color-ink)] w-10 text-right">
                  {p.nb_contrats}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-6">
          <h2 className="font-semibold text-[var(--color-ink)] mb-4">Répartition des clients par profession</h2>
          <div className="space-y-3">
            {stats.repartition_profession.slice(0, 6).map((p) => (
              <div key={p.profession} className="flex items-center gap-3">
                <span className="text-sm text-[var(--color-slate)] w-32 shrink-0 truncate">{p.profession}</span>
                <div className="flex-1 h-2.5 bg-[var(--color-surface)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-success)] rounded-full"
                    style={{ width: `${(p.nb_clients / maxProfession) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-[family-name:var(--font-mono)] text-[var(--color-ink)] w-10 text-right">
                  {p.nb_clients}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-6 flex items-center gap-6">
        <ScoreGauge score={stats.score_moyen_recommandations} size={72} />
        <div>
          <h2 className="font-semibold text-[var(--color-ink)]">Score moyen des recommandations IA</h2>
          <p className="text-[var(--color-slate)] text-sm mt-1">
            Moyenne des scores IA sur l&apos;historique des recommandations déjà générées.
          </p>
          <p className="text-[var(--color-slate)] text-sm mt-1">
            Revenu annuel moyen des clients : {stats.revenu_annuel_moyen.toLocaleString("fr-FR")} € / an
          </p>
        </div>
      </div>
    </div>
  );
}
