"use client";

import { useState } from "react";
import { Recommandation } from "@/lib/api";
import { NOMS_PRODUITS } from "@/lib/produits";

const FORMULES = ["Basique", "Confort", "Premium"];
const MULTIPLICATEUR_FORMULE: Record<string, number> = { Basique: 0.75, Confort: 1, Premium: 1.4 };

export default function SimulationRapide({ recommandations }: { recommandations: Recommandation[] }) {
  const [produit, setProduit] = useState(recommandations[0]?.produit || "");
  const [formule, setFormule] = useState("Confort");

  // Estimation simple à partir du score IA : sert de base de départ pour le conseiller,
  // à affiner avec un vrai moteur de tarification.
  const primeBase = 250 + (100 - (recommandations.find((r) => r.produit === produit)?.score || 50)) * 6;
  const primeEstimee = Math.round(primeBase * MULTIPLICATEUR_FORMULE[formule]);

  if (recommandations.length === 0) return null;

  return (
    <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-5">
      <h2 className="font-semibold text-[var(--color-ink)] text-sm mb-4">4. Simulation rapide</h2>

      <label className="block text-xs text-[var(--color-slate)] mb-1.5">Produit sélectionné</label>
      <select
        value={produit}
        onChange={(e) => setProduit(e.target.value)}
        className="w-full mb-3 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
      >
        {recommandations.map((r) => (
          <option key={r.produit} value={r.produit}>
            {NOMS_PRODUITS[r.produit] || r.produit}
          </option>
        ))}
      </select>

      <label className="block text-xs text-[var(--color-slate)] mb-1.5">Formule</label>
      <select
        value={formule}
        onChange={(e) => setFormule(e.target.value)}
        className="w-full mb-4 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
      >
        {FORMULES.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>

      <p className="text-xs text-[var(--color-slate)] mb-1">Prime annuelle estimée</p>
      <p className="text-2xl font-[family-name:var(--font-mono)] font-semibold text-[var(--color-ink)] mb-4">
        {primeEstimee.toLocaleString("fr-FR")}{" "}
        <span className="text-sm font-normal text-[var(--color-slate)]">TND</span>
      </p>

      <button
        type="button"
        disabled
        className="w-full bg-[var(--color-primary)] text-white text-sm font-medium rounded-xl py-2.5 opacity-60 cursor-not-allowed"
      >
        Créer une offre détaillée
      </button>
      <div className="mt-2 flex justify-center">
        <span className="inline-flex items-center text-[9px] uppercase tracking-wide text-slate-500 border border-slate-300 rounded px-1.5 py-0.5 bg-slate-100">
          Bientôt disponible
        </span>
      </div>
    </div>
  );
}
