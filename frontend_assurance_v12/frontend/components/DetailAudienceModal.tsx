"use client";

import { useEffect, useState, useCallback } from "react";
import { X } from "lucide-react";
import { ClientAvecScore } from "@/lib/api";

type Props = {
  titre: string;
  chargerClients: (page: number) => Promise<{ total: number; clients: ClientAvecScore[] }>;
  onFermer: () => void;
};

export default function DetailAudienceModal({ titre, chargerClients, onFermer }: Props) {
  const [clients, setClients] = useState<ClientAvecScore[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [chargement, setChargement] = useState(true);
  const taillePage = 20;

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const data = await chargerClients(page);
      setClients(data.clients);
      setTotal(data.total);
    } finally {
      setChargement(false);
    }
  }, [chargerClients, page]);

  useEffect(() => {
    charger();
  }, [charger]);

  const nbPages = Math.max(1, Math.ceil(total / taillePage));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onFermer} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <div>
            <h2 className="font-semibold text-[var(--color-ink)]">{titre}</h2>
            <p className="text-xs text-[var(--color-slate)] mt-0.5">
              {total.toLocaleString("fr-FR")} client{total > 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={onFermer}
            className="w-8 h-8 rounded-full hover:bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-slate)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-slate)]">
                <th className="px-6 py-2.5 font-medium">Client</th>
                <th className="px-6 py-2.5 font-medium">Âge</th>
                <th className="px-6 py-2.5 font-medium">Profession</th>
                <th className="px-6 py-2.5 font-medium">Score IA</th>
              </tr>
            </thead>
            <tbody>
              {chargement ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-[var(--color-slate)]">
                    Chargement...
                  </td>
                </tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-[var(--color-slate)]">
                    Aucun client dans cette catégorie.
                  </td>
                </tr>
              ) : (
                clients.map((c) => (
                  <tr key={c.client_id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-6 py-2.5">
                      <p className="font-medium text-[var(--color-ink)]">
                        {c.prenom} {c.nom}
                      </p>
                      <p className="text-xs text-[var(--color-slate)] font-[family-name:var(--font-mono)]">
                        {c.client_id}
                      </p>
                    </td>
                    <td className="px-6 py-2.5 text-[var(--color-ink)]">{c.age} ans</td>
                    <td className="px-6 py-2.5 text-[var(--color-ink)]">{c.profession}</td>
                    <td className="px-6 py-2.5">
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-[var(--color-success-light)] text-[var(--color-success)]">
                        {c.score}/100
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {nbPages > 1 && (
          <div className="flex items-center justify-center gap-2 py-3 border-t border-[var(--color-border)]">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] disabled:opacity-40"
            >
              Précédent
            </button>
            <span className="text-xs text-[var(--color-slate)] px-2">
              Page {page} / {nbPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(nbPages, p + 1))}
              disabled={page === nbPages}
              className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] disabled:opacity-40"
            >
              Suivant
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
