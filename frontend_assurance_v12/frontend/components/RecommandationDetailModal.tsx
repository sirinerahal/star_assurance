"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { Recommandation } from "@/lib/api";
import { NOMS_PRODUITS } from "@/lib/produits";

export default function RecommandationDetailModal({ recommandation }: { recommandation: Recommandation }) {
  const [ouverte, setOuverte] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOuverte(true)}
        className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-ink)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors shrink-0"
      >
        Voir le détail
      </button>

      {ouverte && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setOuverte(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--color-slate)]">Détail de la recommandation</p>
                <h3 className="mt-1 text-xl font-semibold text-[var(--color-ink)]">
                  {recommandation.produit_nom || NOMS_PRODUITS[recommandation.produit] || recommandation.produit}
                </h3>
                {recommandation.packs_disponibles.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {recommandation.packs_disponibles.map((pack) => (
                      <p key={`${pack.pack_code}-${pack.valeur}`} className="text-sm text-[var(--color-slate)]">
                        {pack.pack_nom}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOuverte(false)}
                className="rounded-full p-2 text-[var(--color-slate)] hover:bg-slate-100 hover:text-[var(--color-ink)]"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-4 text-sm">
              <div className="rounded-xl bg-[var(--color-surface)] p-3">
                <p className="text-xs uppercase tracking-wide text-[var(--color-slate)]">Score</p>
                <p className="mt-1 text-lg font-[family-name:var(--font-mono)] font-semibold text-[var(--color-ink)]">
                  {recommandation.score}%
                </p>
              </div>

              <div className="rounded-xl bg-[var(--color-surface)] p-3">
                <p className="text-xs uppercase tracking-wide text-[var(--color-slate)]">Explication</p>
                <p className="mt-2 leading-relaxed text-[var(--color-ink)]">
                  {recommandation.explication_produit || recommandation.explication || "Aucune explication disponible pour cette recommandation."}
                </p>
                <p className="mt-3 leading-relaxed text-[var(--color-ink)]">
                  <span className="font-medium">Pack recommandé :</span>{" "}
                  {recommandation.pack_recommande
                    ? recommandation.pack_recommande.pack_nom
                    : "Non déterminé par les données disponibles."}
                </p>
                <p className="mt-2 leading-relaxed text-[var(--color-ink)]">
                  <span className="font-medium">Pourquoi ce pack :</span>{" "}
                  {recommandation.explication_pack}
                </p>
                {recommandation.pack_recommande?.source_donnee === "fictive_prototype" && (
                  <p className="mt-2 text-xs text-amber-700">
                    Sélection issue de données fictives de prototype, non représentative d&apos;une performance métier.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
