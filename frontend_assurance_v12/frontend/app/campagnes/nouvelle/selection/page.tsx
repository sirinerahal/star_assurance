"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Users, TrendingUp, Target, Mail, Eye, AlertTriangle } from "lucide-react";
import CampagneStepper from "@/components/CampagneStepper";
import DetailAudienceModal from "@/components/DetailAudienceModal";
import { IconeProduit, NOMS_PRODUITS } from "@/lib/produits";
import {
  getAudienceMulti,
  getClientsProduit,
  getSegments,
  AudienceMultiResult,
  SegmentStats,
  CampagneConfig,
} from "@/lib/api";

type Onglet = "tous" | "segment";

const CONFIG_VIDE: CampagneConfig = {
  nom: "", produits: [], objectif: "Acquisition", canaux: "email",
  dateDebut: "", dateFin: "", frequence: "", fuseau: "", heure: "",
  desabonnement: true, description: "",
};

export default function SelectionClientsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[var(--color-slate)]">Chargement...</div>}>
      <SelectionClientsContent />
    </Suspense>
  );
}

function SelectionClientsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  let config: CampagneConfig = CONFIG_VIDE;
  try {
    config = { ...CONFIG_VIDE, ...JSON.parse(searchParams.get("config") || "{}") };
  } catch {
    config = CONFIG_VIDE;
  }
  const produits = config.produits;

  const [onglet, setOnglet] = useState<Onglet>("tous");
  const [segmentsDispo, setSegmentsDispo] = useState<SegmentStats[]>([]);
  const [segmentChoisi, setSegmentChoisi] = useState("");

  const [audience, setAudience] = useState<AudienceMultiResult | null>(null);
  const [chargementAudience, setChargementAudience] = useState(true);

  const [modal, setModal] = useState<{ produit: string; scoreMin: number; scoreMax: number; label: string } | null>(
    null
  );

  useEffect(() => {
    if (produits.length === 0) return;
    // On utilise le premier produit uniquement pour récupérer la LISTE des
    // segments disponibles (noms/ids) -- ces libellés ne dépendent pas du
    // produit, seuls les chiffres en dépendent, recalculés via audience-multi.
    getSegments(produits[0].code, 0, 100).then((d) => {
      setSegmentsDispo(d.segments);
      if (d.segments.length > 0) setSegmentChoisi(d.segments[0].segment_id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chargerAudience = useCallback(async () => {
    if (produits.length === 0) return;
    setChargementAudience(true);
    try {
      if (onglet === "segment" && segmentChoisi) {
        setAudience(await getAudienceMulti(produits, "segment", segmentChoisi));
      } else if (onglet === "tous") {
        setAudience(await getAudienceMulti(produits, "tous"));
      }
    } finally {
      setChargementAudience(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onglet, segmentChoisi, JSON.stringify(produits)]);

  useEffect(() => {
    if (onglet === "segment" && !segmentChoisi) return;
    chargerAudience();
  }, [chargerAudience, onglet, segmentChoisi]);

  if (produits.length === 0) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-[var(--color-alert-light)] border border-[var(--color-alert)] text-[var(--color-alert)] rounded-xl p-5 flex items-center gap-3">
          <AlertTriangle size={20} />
          <p className="text-sm font-medium">
            Aucun produit sélectionné. Retournez à l&apos;étape 1 pour configurer la campagne.
          </p>
        </div>
        <button
          onClick={() => router.push("/campagnes/nouvelle")}
          className="mt-4 text-sm font-medium px-5 py-2.5 rounded-xl border border-[var(--color-border)] text-[var(--color-ink)] hover:bg-[var(--color-surface)] transition-colors"
        >
          ← Retour à la configuration
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-ink)]">Nouvelle campagne</h1>
        <p className="text-[var(--color-slate)] text-sm mt-1">
          Sélectionnez les clients qui recevront cette campagne
        </p>
      </header>

      <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-6 mb-6">
        <CampagneStepper etapeActive={2} />
      </div>

      {/* Bandeau de contexte : produits + plages choisis à l'étape 1 */}
      <div className="bg-[var(--color-primary-light)] rounded-2xl p-4 mb-6">
        <p className="text-[10px] text-[var(--color-primary-dark)] uppercase tracking-wide mb-2">
          Produits ciblés ({produits.length})
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {produits.map((p) => (
            <span
              key={p.code}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-white text-[var(--color-primary-dark)]"
            >
              <IconeProduit code={p.code} size={12} boxSize={20} />
              {NOMS_PRODUITS[p.code] || p.code} ({p.score_min}→{p.score_max})
            </span>
          ))}
          <button
            onClick={() => router.push("/campagnes/nouvelle")}
            className="ml-auto text-xs font-medium text-[var(--color-primary-dark)] hover:underline"
          >
            Modifier
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-5 border-b border-[var(--color-border)]">
        {[
          { id: "tous" as const, label: "Tous les clients" },
          { id: "segment" as const, label: "Par segment" },
        ].map((o) => (
          <button
            key={o.id}
            onClick={() => setOnglet(o.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              onglet === o.id
                ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                : "border-transparent text-[var(--color-slate)] hover:text-[var(--color-ink)]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {onglet === "segment" && (
        <div className="mb-5">
          <label className="block text-xs text-[var(--color-slate)] mb-1.5">Choisir un segment</label>
          <select
            value={segmentChoisi}
            onChange={(e) => setSegmentChoisi(e.target.value)}
            className="w-full max-w-sm px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            {segmentsDispo.map((s) => (
              <option key={s.segment_id} value={s.segment_id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {audience && !chargementAudience && audience.nb_clients_uniques === 0 && (
        <div className="bg-[var(--color-alert-light)] border border-[var(--color-alert)] text-[var(--color-alert)] rounded-xl p-4 mb-6 flex items-center gap-3">
          <AlertTriangle size={18} className="shrink-0" />
          <p className="text-sm">
            Aucun client ne correspond à ces critères. Retournez à l&apos;étape 1 pour élargir les plages de score.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          icon={Users}
          label="Clients cibles (uniques)"
          value={chargementAudience ? "…" : (audience?.nb_clients_uniques ?? 0).toLocaleString("fr-FR")}
          sousTexte="Dédupliqués entre produits"
          accent="#2563eb"
        />
        <KpiCard
          icon={TrendingUp}
          label="Score IA moyen combiné"
          value={chargementAudience ? "…" : `${audience?.score_moyen_combine ?? 0}/100`}
          sousTexte="Meilleur score par client"
          accent="#16a34a"
        />
        <KpiCard
          icon={Target}
          label="Taux de réponse estimé"
          value={chargementAudience ? "…" : `${audience?.taux_reponse_estime_combine ?? 0}%`}
          sousTexte=""
          accent="#7c3aed"
        />
        <KpiCard
          icon={Mail}
          label="Messages à envoyer"
          value={chargementAudience ? "…" : (audience?.nb_clients_uniques ?? 0).toLocaleString("fr-FR")}
          sousTexte={
            audience && !chargementAudience
              ? `Email: ${audience.messages_email.toLocaleString("fr-FR")} | SMS: ${audience.messages_sms.toLocaleString("fr-FR")}`
              : ""
          }
          accent="#f97316"
        />
      </div>

      <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-6 mb-6">
        <h2 className="font-semibold text-[var(--color-ink)] text-sm mb-1">Détail par produit</h2>
        <p className="text-xs text-[var(--color-slate)] mb-4">
          Audience et score propres à chaque produit sélectionné (avant déduplication)
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-slate)]">
              <th className="py-2.5 font-medium">Produit</th>
              <th className="py-2.5 font-medium">Plage de score</th>
              <th className="py-2.5 font-medium">Clients</th>
              <th className="py-2.5 font-medium">Score moyen</th>
              <th className="py-2.5 font-medium">Taux de réponse estimé</th>
              <th className="py-2.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(audience?.detail_par_produit ?? []).map((d) => (
              <tr key={d.produit} className="border-b border-[var(--color-border)] last:border-0">
                <td className="py-2.5 text-[var(--color-ink)] flex items-center gap-2">
                  <IconeProduit code={d.produit} size={12} boxSize={22} />
                  {NOMS_PRODUITS[d.produit] || d.produit}
                </td>
                <td className="py-2.5 text-[var(--color-ink)]">
                  {d.score_min}→{d.score_max}
                </td>
                <td className="py-2.5 text-[var(--color-ink)]">{d.nb_clients.toLocaleString("fr-FR")}</td>
                <td className="py-2.5 text-[var(--color-ink)]">{d.score_moyen}/100</td>
                <td className="py-2.5 text-[var(--color-ink)]">{d.taux_reponse_estime}%</td>
                <td className="py-2.5 text-right">
                  <button
                    onClick={() =>
                      setModal({
                        produit: d.produit,
                        scoreMin: d.score_min,
                        scoreMax: d.score_max,
                        label: NOMS_PRODUITS[d.produit] || d.produit,
                      })
                    }
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-primary)] hover:underline"
                  >
                    <Eye size={14} />
                    Voir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/campagnes/nouvelle")}
          className="text-sm font-medium px-5 py-2.5 rounded-xl border border-[var(--color-border)] text-[var(--color-ink)] hover:bg-[var(--color-surface)] transition-colors"
        >
          ← Précédent
        </button>
        <button
          onClick={() => router.push(`/campagnes/nouvelle/contenu?config=${encodeURIComponent(JSON.stringify(config))}`)}
          className="bg-[var(--color-primary)] text-white text-sm font-medium rounded-xl px-5 py-2.5 hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          Suivant →
        </button>
      </div>

      {modal && (
        <DetailAudienceModal
          titre={modal.label}
          chargerClients={(page) => getClientsProduit(modal.produit, modal.scoreMin, modal.scoreMax, page)}
          onFermer={() => setModal(null)}
        />
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sousTexte,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sousTexte: string;
  accent: string;
}) {
  return (
    <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-5">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
        style={{ backgroundColor: accent + "1a", color: accent }}
      >
        <Icon size={18} strokeWidth={2.2} />
      </div>
      <p className="text-xl font-[family-name:var(--font-mono)] font-semibold text-[var(--color-ink)]">{value}</p>
      <p className="text-xs text-[var(--color-slate)] mt-0.5">{label}</p>
      {sousTexte && <p className="text-[11px] text-[var(--color-slate)] mt-1">{sousTexte}</p>}
    </div>
  );
}
