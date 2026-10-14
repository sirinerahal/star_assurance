"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Search, Megaphone, Users, Send, Mail, MessageSquare, Eye, X } from "lucide-react";
import { listerCampagnes, ConfirmationLancement } from "@/lib/api";
import { IconeProduit, NOMS_PRODUITS } from "@/lib/produits";

const STATUT_STYLES: Record<string, string> = {
  lancee: "bg-[var(--color-success-light)] text-[var(--color-success)]",
};
const STATUT_LABELS: Record<string, string> = {
  lancee: "Lancée",
};

export default function MesCampagnesPage() {
  const [campagnes, setCampagnes] = useState<ConfirmationLancement[]>([]);
  const [totalContactes, setTotalContactes] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [campagneOuverte, setCampagneOuverte] = useState<ConfirmationLancement | null>(null);

  useEffect(() => {
    listerCampagnes()
      .then((d) => {
        setCampagnes(d.campagnes);
        setTotalContactes(d.total_contactes);
      })
      .finally(() => setChargement(false));
  }, []);

  const campagnesFiltrees = useMemo(() => {
    if (!recherche.trim()) return campagnes;
    const q = recherche.toLowerCase();
    return campagnes.filter(
      (c) => c.nom.toLowerCase().includes(q) || c.objectif.toLowerCase().includes(q)
    );
  }, [campagnes, recherche]);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-ink)]">Mes campagnes</h1>
        <p className="text-[var(--color-slate)] text-sm mt-1">
          Toutes les campagnes que vous avez lancées
        </p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--color-primary-light)] flex items-center justify-center text-[var(--color-primary-dark)] shrink-0">
            <Megaphone size={18} />
          </div>
          <div>
            <p className="text-xl font-[family-name:var(--font-mono)] font-semibold text-[var(--color-ink)]">
              {campagnes.length}
            </p>
            <p className="text-xs text-[var(--color-slate)]">Campagnes lancées</p>
          </div>
        </div>
        <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--color-success-light)] flex items-center justify-center text-[var(--color-success)] shrink-0">
            <Users size={18} />
          </div>
          <div>
            <p className="text-xl font-[family-name:var(--font-mono)] font-semibold text-[var(--color-ink)]">
              {totalContactes.toLocaleString("fr-FR")}
            </p>
            <p className="text-xs text-[var(--color-slate)]">Clients contactés (cumulé)</p>
          </div>
        </div>
        <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#7c3aed]/10 flex items-center justify-center text-[#7c3aed] shrink-0">
            <Send size={18} />
          </div>
          <div>
            <p className="text-xl font-[family-name:var(--font-mono)] font-semibold text-[var(--color-ink)]">
              {campagnes.length > 0 ? Math.round(totalContactes / campagnes.length).toLocaleString("fr-FR") : 0}
            </p>
            <p className="text-xs text-[var(--color-slate)]">Destinataires / campagne (moy.)</p>
          </div>
        </div>
      </div>

      <div className="relative mb-5">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-slate)]" />
        <input
          type="text"
          placeholder="Rechercher par nom ou objectif..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-card)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
        />
      </div>

      <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-slate)]">
              <th className="px-5 py-3 font-medium">Campagne</th>
              <th className="px-5 py-3 font-medium">Objectif</th>
              <th className="px-5 py-3 font-medium">Destinataires</th>
              <th className="px-5 py-3 font-medium">Canaux</th>
              <th className="px-5 py-3 font-medium">Statut</th>
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {chargement ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-[var(--color-slate)]">
                  Chargement...
                </td>
              </tr>
            ) : campagnesFiltrees.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center">
                  <p className="text-[var(--color-slate)] mb-3">
                    {campagnes.length === 0
                      ? "Aucune campagne lancée pour le moment."
                      : "Aucune campagne ne correspond à votre recherche."}
                  </p>
                  {campagnes.length === 0 && (
                    <Link
                      href="/campagnes/nouvelle"
                      className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] transition-colors"
                    >
                      <Megaphone size={15} />
                      Créer votre première campagne
                    </Link>
                  )}
                </td>
              </tr>
            ) : (
              campagnesFiltrees.map((c) => (
                <tr
                  key={c.campagne_id}
                  className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface)] transition-colors"
                >
                  <td className="px-5 py-3">
                    <p className="font-medium text-[var(--color-ink)]">{c.nom}</p>
                    <p className="text-xs text-[var(--color-slate)] font-[family-name:var(--font-mono)]">
                      {c.campagne_id}
                    </p>
                  </td>
                  <td className="px-5 py-3 text-[var(--color-ink)]">{c.objectif || "—"}</td>
                  <td className="px-5 py-3 text-[var(--color-ink)]">
                    {c.nb_destinataires.toLocaleString("fr-FR")}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5 text-[var(--color-slate)]">
                      {c.canaux.includes("email") && <Mail size={14} />}
                      {c.canaux.includes("sms") && <MessageSquare size={14} />}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${
                        STATUT_STYLES[c.statut] || "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {STATUT_LABELS[c.statut] || c.statut}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[var(--color-slate)] text-xs">
                    {new Date(c.date_lancement).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => setCampagneOuverte(c)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-primary)] hover:underline"
                    >
                      <Eye size={14} />
                      Voir
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {campagneOuverte && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setCampagneOuverte(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-[var(--color-ink)]">{campagneOuverte.nom}</h2>
              <button
                onClick={() => setCampagneOuverte(null)}
                className="w-8 h-8 rounded-full hover:bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-slate)]"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--color-slate)]">Identifiant</span>
                <span className="font-[family-name:var(--font-mono)] text-[var(--color-ink)]">
                  {campagneOuverte.campagne_id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-slate)]">Objectif</span>
                <span className="text-[var(--color-ink)]">{campagneOuverte.objectif || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-slate)]">Destinataires</span>
                <span className="text-[var(--color-ink)]">
                  {campagneOuverte.nb_destinataires.toLocaleString("fr-FR")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-slate)]">Date de lancement</span>
                <span className="text-[var(--color-ink)]">
                  {new Date(campagneOuverte.date_lancement).toLocaleString("fr-FR")}
                </span>
              </div>
              <div>
                <p className="text-[var(--color-slate)] mb-1.5">Produits concernés</p>
                <div className="flex flex-wrap gap-1.5">
                  {campagneOuverte.produits.map((code) => (
                    <span
                      key={code}
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg bg-[var(--color-surface)] text-[var(--color-ink)]"
                    >
                      <IconeProduit code={code} size={11} boxSize={18} />
                      {NOMS_PRODUITS[code] || code}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
