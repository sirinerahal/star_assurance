"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Search, ChevronRight } from "lucide-react";
import { listerClients, ClientResume } from "@/lib/api";

export default function ClientsPage() {
  const [recherche, setRecherche] = useState("");
  const [clients, setClients] = useState<ClientResume[]>([]);
  const [total, setTotal] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [page, setPage] = useState(1);
  const taillePage = 20;

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const data = await listerClients(recherche, page, taillePage);
      setClients(data.clients);
      setTotal(data.total);
    } finally {
      setChargement(false);
    }
  }, [recherche, page]);

  useEffect(() => {
    const debounce = setTimeout(charger, 300);
    return () => clearTimeout(debounce);
  }, [charger]);

  const nbPages = Math.max(1, Math.ceil(total / taillePage));
  const valeur = (champ: string | number | null | undefined) =>
    champ === null || champ === undefined || champ === "" ? "Non renseigné" : String(champ);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-ink)]">Clients</h1>
        <p className="text-[var(--color-slate)] text-sm mt-1">
          {total.toLocaleString("fr-FR")} client{total > 1 ? "s" : ""} au total
        </p>
        <p className="text-[var(--color-slate)] text-xs mt-1">Contrats simulés</p>
      </header>

      <div className="relative mb-5">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-slate)]" />
        <input
          type="text"
          placeholder="Rechercher par nom, prénom, identifiant, profession, adresse..."
          value={recherche}
          onChange={(e) => {
            setPage(1);
            setRecherche(e.target.value);
          }}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-card)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
        />
      </div>

      <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-slate)]">
              <th className="px-5 py-3 font-medium">Client</th>
              <th className="px-5 py-3 font-medium">Âge</th>
              <th className="px-5 py-3 font-medium">Profession</th>
              <th className="px-5 py-3 font-medium">Situation</th>
              <th className="px-5 py-3 font-medium">Contrats</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {chargement ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-[var(--color-slate)]">
                  Chargement...
                </td>
              </tr>
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-[var(--color-slate)]">
                  Aucun client trouvé.
                </td>
              </tr>
            ) : (
              clients.map((c) => (
                <tr
                  key={c.client_id}
                  className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface)] transition-colors"
                >
                  <td className="px-5 py-3">
                    <Link href={`/clients/${c.client_id}`} className="block">
                      <p className="font-medium text-[var(--color-ink)]">
                        {[c.prenom, c.nom].filter(Boolean).join(" ") || `Client ${c.client_id}`}
                      </p>
                      <p className="text-xs text-[var(--color-slate)] font-[family-name:var(--font-mono)]">
                        {c.client_id}
                      </p>
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-[var(--color-ink)]">{c.age === null ? "Non renseigné" : `${c.age} ans`}</td>
                  <td className="px-5 py-3 text-[var(--color-ink)]">{valeur(c.profession)}</td>
                  <td className="px-5 py-3 text-[var(--color-ink)]">{valeur(c.situation_familiale)}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] text-xs font-medium">
                      {c.nb_contrats_existants ?? 0}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/clients/${c.client_id}`}>
                      <ChevronRight size={18} className="text-[var(--color-slate)]" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {nbPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-5">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm rounded-lg border border-[var(--color-border)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--color-surface)]"
          >
            Précédent
          </button>
          <span className="text-sm text-[var(--color-slate)] px-2">
            Page {page} / {nbPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(nbPages, p + 1))}
            disabled={page === nbPages}
            className="px-3 py-1.5 text-sm rounded-lg border border-[var(--color-border)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--color-surface)]"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}
