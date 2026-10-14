"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  Users,
  TrendingUp,
  Target,
  Mail,
  MessageSquare,
  Calendar,
  Clock,
  Repeat,
} from "lucide-react";
import CampagneStepper from "@/components/CampagneStepper";
import { IconeProduit, NOMS_PRODUITS } from "@/lib/produits";
import { getAudienceMulti, AudienceMultiResult, CampagneConfig } from "@/lib/api";

const CONFIG_VIDE: CampagneConfig = {
  nom: "", produits: [], objectif: "Acquisition", canaux: "email",
  dateDebut: "", dateFin: "", frequence: "", fuseau: "", heure: "",
  desabonnement: true, description: "",
};

export default function ValidationPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[var(--color-slate)]">Chargement...</div>}>
      <ValidationContent />
    </Suspense>
  );
}

function ValidationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  let config: CampagneConfig = CONFIG_VIDE;
  try {
    config = { ...CONFIG_VIDE, ...JSON.parse(searchParams.get("config") || "{}") };
  } catch {
    config = CONFIG_VIDE;
  }

  const [audience, setAudience] = useState<AudienceMultiResult | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    if (config.produits.length === 0) return;
    getAudienceMulti(config.produits, "tous")
      .then(setAudience)
      .finally(() => setChargement(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canauxListe = config.canaux.split(",").filter(Boolean);
  const contenuEmailVide = canauxListe.includes("email") && !config.contenuEmail?.corps?.trim();
  const contenuSmsVide = canauxListe.includes("sms") && !config.contenuSms?.texte?.trim();

  const checks = [
    { label: "Nom de la campagne renseigné", ok: !!config.nom.trim() },
    { label: "Au moins un produit sélectionné", ok: config.produits.length > 0 },
    { label: "Période de validité définie", ok: !!config.dateDebut && !!config.dateFin },
    { label: "Au moins un canal de communication choisi", ok: canauxListe.length > 0 },
    { label: "Contenu du message rempli pour chaque canal", ok: !contenuEmailVide && !contenuSmsVide },
    { label: "Au moins un client cible identifié", ok: !chargement && (audience?.nb_clients_uniques ?? 0) > 0 },
  ];
  const toutValide = checks.every((c) => c.ok);

  if (config.produits.length === 0) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-[var(--color-alert-light)] border border-[var(--color-alert)] text-[var(--color-alert)] rounded-xl p-5">
          <p className="text-sm font-medium">
            Aucune donnée de campagne trouvée. Retournez à l&apos;étape 1 pour configurer la campagne.
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
    <div className="p-8 max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-ink)]">Nouvelle campagne</h1>
        <p className="text-[var(--color-slate)] text-sm mt-1">
          Vérifiez toutes les informations avant de lancer la campagne
        </p>
      </header>

      <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-6 mb-6">
        <CampagneStepper etapeActive={4} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Récapitulatif général */}
          <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-6">
            <h2 className="font-semibold text-[var(--color-ink)] text-sm mb-4">Récapitulatif de la campagne</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[11px] text-[var(--color-slate)] mb-0.5">Nom</p>
                <p className="text-[var(--color-ink)] font-medium">{config.nom || "—"}</p>
              </div>
              <div>
                <p className="text-[11px] text-[var(--color-slate)] mb-0.5">Objectif</p>
                <p className="text-[var(--color-ink)] font-medium">{config.objectif}</p>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-[var(--color-slate)]" />
                <div>
                  <p className="text-[11px] text-[var(--color-slate)]">Période</p>
                  <p className="text-[var(--color-ink)] font-medium">
                    {config.dateDebut || "—"} → {config.dateFin || "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-[var(--color-slate)]" />
                <div>
                  <p className="text-[11px] text-[var(--color-slate)]">Heure d&apos;envoi</p>
                  <p className="text-[var(--color-ink)] font-medium">{config.heure || "—"} ({config.fuseau})</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Repeat size={14} className="text-[var(--color-slate)]" />
                <div>
                  <p className="text-[11px] text-[var(--color-slate)]">Fréquence</p>
                  <p className="text-[var(--color-ink)] font-medium">{config.frequence || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canauxListe.includes("email") && <Mail size={14} className="text-[var(--color-slate)]" />}
                {canauxListe.includes("sms") && <MessageSquare size={14} className="text-[var(--color-slate)]" />}
                <div>
                  <p className="text-[11px] text-[var(--color-slate)]">Canaux</p>
                  <p className="text-[var(--color-ink)] font-medium capitalize">
                    {canauxListe.join(" + ") || "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Produits ciblés */}
          <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-6">
            <h2 className="font-semibold text-[var(--color-ink)] text-sm mb-4">
              Produits sélectionnés ({config.produits.length})
            </h2>
            <div className="flex flex-wrap gap-2">
              {config.produits.map((p) => (
                <span
                  key={p.code}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-[var(--color-surface)] text-[var(--color-ink)]"
                >
                  <IconeProduit code={p.code} size={12} boxSize={20} />
                  {NOMS_PRODUITS[p.code] || p.code} ({p.score_min}→{p.score_max})
                </span>
              ))}
            </div>
          </div>

          {/* Aperçu du contenu */}
          <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-6">
            <h2 className="font-semibold text-[var(--color-ink)] text-sm mb-4">Aperçu du contenu</h2>
            {canauxListe.includes("email") && config.contenuEmail && (
              <div className="mb-4 pb-4 border-b border-[var(--color-border)] last:border-0 last:pb-0 last:mb-0">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-[var(--color-primary-light)] flex items-center justify-center">
                    <Mail size={13} className="text-[var(--color-primary-dark)]" />
                  </div>
                  <span className="text-xs font-medium text-[var(--color-slate)]">Email</span>
                </div>
                <p className="text-sm font-medium text-[var(--color-ink)] mb-1">{config.contenuEmail.objet}</p>
                <p className="text-xs text-[var(--color-slate)] whitespace-pre-line line-clamp-4">
                  {config.contenuEmail.corps}
                </p>
              </div>
            )}
            {canauxListe.includes("sms") && config.contenuSms && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-[var(--color-primary-light)] flex items-center justify-center">
                    <MessageSquare size={13} className="text-[var(--color-primary-dark)]" />
                  </div>
                  <span className="text-xs font-medium text-[var(--color-slate)]">SMS</span>
                </div>
                <p className="text-xs text-[var(--color-slate)] whitespace-pre-line">{config.contenuSms.texte}</p>
              </div>
            )}
          </div>

          {/* Checklist */}
          <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-6">
            <h2 className="font-semibold text-[var(--color-ink)] text-sm mb-4">Vérifications avant lancement</h2>
            <div className="space-y-2.5">
              {checks.map((c) => (
                <div key={c.label} className="flex items-center gap-2.5 text-sm">
                  {c.ok ? (
                    <CheckCircle2 size={16} className="text-[var(--color-success)] shrink-0" />
                  ) : (
                    <XCircle size={16} className="text-[var(--color-danger)] shrink-0" />
                  )}
                  <span className={c.ok ? "text-[var(--color-ink)]" : "text-[var(--color-danger)]"}>{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Colonne audience */}
        <div className="space-y-4">
          <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <Users size={16} className="text-[var(--color-primary)]" />
              <p className="text-xs text-[var(--color-slate)]">Destinataires estimés</p>
            </div>
            <p className="text-2xl font-[family-name:var(--font-mono)] font-semibold text-[var(--color-ink)]">
              {chargement ? "…" : (audience?.nb_clients_uniques ?? 0).toLocaleString("fr-FR")}
            </p>
          </div>
          <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={16} className="text-[var(--color-success)]" />
              <p className="text-xs text-[var(--color-slate)]">Score IA moyen</p>
            </div>
            <p className="text-2xl font-[family-name:var(--font-mono)] font-semibold text-[var(--color-ink)]">
              {chargement ? "…" : `${audience?.score_moyen_combine ?? 0}/100`}
            </p>
          </div>
          <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <Target size={16} className="text-[#7c3aed]" />
              <p className="text-xs text-[var(--color-slate)]">Taux de réponse estimé</p>
            </div>
            <p className="text-2xl font-[family-name:var(--font-mono)] font-semibold text-[var(--color-ink)]">
              {chargement ? "…" : `${audience?.taux_reponse_estime_combine ?? 0}%`}
            </p>
          </div>

          {!toutValide && (
            <div className="bg-[var(--color-alert-light)] border border-[var(--color-alert)] text-[var(--color-alert)] rounded-xl p-4 text-xs">
              Certains éléments sont incomplets. Corrigez-les avant de pouvoir lancer la campagne.
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-6">
        <button
          onClick={() => router.push(`/campagnes/nouvelle/contenu?config=${encodeURIComponent(JSON.stringify(config))}`)}
          className="text-sm font-medium px-5 py-2.5 rounded-xl border border-[var(--color-border)] text-[var(--color-ink)] hover:bg-[var(--color-surface)] transition-colors"
        >
          ← Précédent
        </button>
        <button
          disabled={!toutValide}
          onClick={() =>
            router.push(`/campagnes/nouvelle/lancement?config=${encodeURIComponent(JSON.stringify(config))}`)
          }
          className="bg-[var(--color-primary)] text-white text-sm font-medium rounded-xl px-5 py-2.5 hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Suivant →
        </button>
      </div>
    </div>
  );
}
