"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { History, Megaphone, Mail, MessageSquare, Users, Target } from "lucide-react";
import { listerCampagnes, ConfirmationLancement } from "@/lib/api";
import { NOMS_PRODUITS } from "@/lib/produits";

function formaterDateJour(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function formaterHeure(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export default function HistoriquePage() {
  const [campagnes, setCampagnes] = useState<ConfirmationLancement[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    listerCampagnes()
      .then((d) => setCampagnes(d.campagnes))
      .finally(() => setChargement(false));
  }, []);

  // Regroupement par jour, pour une frise chronologique
  const groupes = useMemo(() => {
    const map = new Map<string, ConfirmationLancement[]>();
    for (const c of campagnes) {
      const jour = new Date(c.date_lancement).toDateString();
      if (!map.has(jour)) map.set(jour, []);
      map.get(jour)!.push(c);
    }
    return Array.from(map.entries());
  }, [campagnes]);

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-ink)] flex items-center gap-2.5">
          <History size={22} className="text-[var(--color-primary)]" />
          Historique des campagnes
        </h1>
        <p className="text-[var(--color-slate)] text-sm mt-1">
          Journal chronologique de tous les envois réalisés
        </p>
      </header>

      {chargement ? (
        <p className="text-sm text-[var(--color-slate)]">Chargement...</p>
      ) : campagnes.length === 0 ? (
        <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-10 text-center">
          <History size={28} className="text-[var(--color-slate)] mx-auto mb-3" />
          <p className="text-sm text-[var(--color-slate)] mb-4">Aucune campagne n&apos;a encore été lancée.</p>
          <Link
            href="/campagnes/nouvelle"
            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            <Megaphone size={15} />
            Créer une campagne
          </Link>
        </div>
      ) : (
        <div className="relative pl-8">
          <div className="absolute left-[9px] top-2 bottom-2 w-px bg-[var(--color-border)]" />
          {groupes.map(([jour, items]) => (
            <div key={jour} className="mb-8 last:mb-0">
              <div className="relative mb-4">
                <div className="absolute -left-8 top-1 w-[19px] h-[19px] rounded-full bg-[var(--color-primary)] border-4 border-[var(--color-surface)]" />
                <p className="text-sm font-semibold text-[var(--color-ink)] capitalize">
                  {formaterDateJour(items[0].date_lancement)}
                </p>
              </div>

              <div className="space-y-3">
                {items.map((c) => (
                  <div
                    key={c.campagne_id}
                    className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-sm text-[var(--color-ink)]">{c.nom}</p>
                        <p className="text-xs text-[var(--color-slate)]">
                          Lancée à {formaterHeure(c.date_lancement)} · {c.campagne_id}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 text-[var(--color-slate)] shrink-0">
                        {c.canaux.includes("email") && <Mail size={14} />}
                        {c.canaux.includes("sms") && <MessageSquare size={14} />}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-[var(--color-slate)]">
                      <span className="flex items-center gap-1.5">
                        <Users size={13} />
                        {c.nb_destinataires.toLocaleString("fr-FR")} destinataires
                      </span>
                      {c.objectif && (
                        <span className="flex items-center gap-1.5">
                          <Target size={13} />
                          {c.objectif}
                        </span>
                      )}
                    </div>

                    {c.produits.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {c.produits.map((code) => (
                          <span
                            key={code}
                            className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-surface)] text-[var(--color-slate)]"
                          >
                            {NOMS_PRODUITS[code] || code}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
