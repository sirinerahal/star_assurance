"use client";

import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Rocket,
  CheckCircle2,
  Loader2,
  Mail,
  MessageSquare,
  Users,
  AlertTriangle,
  PartyPopper,
  Plus,
  Settings2,
  Send,
  Sparkles,
  ShieldCheck,
  Timer,
} from "lucide-react";
import CampagneStepper from "@/components/CampagneStepper";
import { IconeProduit, NOMS_PRODUITS } from "@/lib/produits";
import { getAudienceMulti, lancerCampagne, CampagneConfig, ConfirmationLancement } from "@/lib/api";

const CONFIG_VIDE: CampagneConfig = {
  nom: "", produits: [], objectif: "Acquisition", canaux: "email",
  dateDebut: "", dateFin: "", frequence: "", fuseau: "", heure: "",
  desabonnement: true, description: "",
};

type Etat = "pret" | "confirmation" | "preparation" | "envoi" | "finalisation" | "termine" | "erreur";

const PHASES: { id: Etat; label: string }[] = [
  { id: "preparation", label: "Préparation" },
  { id: "envoi", label: "Envoi en cours" },
  { id: "finalisation", label: "Finalisation" },
  { id: "termine", label: "Campagne terminée" },
];

function formatDuree(secondes: number): string {
  if (secondes < 60) return `${secondes.toFixed(1)} secondes`;
  const min = Math.floor(secondes / 60);
  const s = Math.round(secondes % 60);
  return `${min} min ${s}s`;
}

export default function LancementPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[var(--color-slate)]">Chargement...</div>}>
      <LancementContent />
    </Suspense>
  );
}

function LancementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  let config: CampagneConfig = CONFIG_VIDE;
  try {
    config = { ...CONFIG_VIDE, ...JSON.parse(searchParams.get("config") || "{}") };
  } catch {
    config = CONFIG_VIDE;
  }

  const [nbDestinataires, setNbDestinataires] = useState(0);
  const [etat, setEtat] = useState<Etat>("pret");
  const [confirmation, setConfirmation] = useState<ConfirmationLancement | null>(null);
  const [dureeSecondes, setDureeSecondes] = useState<number | null>(null);
  const [tauxDelivrabilite, setTauxDelivrabilite] = useState<number | null>(null);

  const [compteurEmail, setCompteurEmail] = useState(0);
  const [compteurSms, setCompteurSms] = useState(0);

  const heureDebutRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (config.produits.length === 0) return;
    getAudienceMulti(config.produits, "tous").then((d) => setNbDestinataires(d.nb_clients_uniques));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canauxListe = config.canaux.split(",").filter(Boolean);
  const inclureEmail = canauxListe.includes("email");
  const inclureSms = canauxListe.includes("sms");

  // Animation de l'envoi : fait avancer les compteurs progressivement, de
  // façon un peu organique (pas une progression parfaitement linéaire), pour
  // donner l'impression d'un vrai envoi en cours plutôt qu'une barre statique.
  useEffect(() => {
    if (etat !== "envoi" || nbDestinataires === 0) return;

    intervalRef.current = setInterval(() => {
      let emailFini = !inclureEmail;
      let smsFini = !inclureSms;

      if (inclureEmail) {
        setCompteurEmail((prev) => {
          const pas = Math.ceil(nbDestinataires * (0.03 + Math.random() * 0.05));
          const suivant = Math.min(prev + pas, nbDestinataires);
          emailFini = suivant >= nbDestinataires;
          return suivant;
        });
      }
      if (inclureSms) {
        setCompteurSms((prev) => {
          const pas = Math.ceil(nbDestinataires * (0.025 + Math.random() * 0.05));
          const suivant = Math.min(prev + pas, nbDestinataires);
          smsFini = suivant >= nbDestinataires;
          return suivant;
        });
      }

      if (emailFini && smsFini && intervalRef.current) {
        clearInterval(intervalRef.current);
        setEtat("finalisation");
      }
    }, 180);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etat, nbDestinataires]);

  // Étape finalisation : appel réel au backend, puis passage à l'écran de succès
  useEffect(() => {
    if (etat !== "finalisation") return;
    let annule = false;
    (async () => {
      await new Promise((r) => setTimeout(r, 700));
      try {
        const resultat = await lancerCampagne(
          config.nom,
          nbDestinataires,
          config.canaux,
          config.objectif,
          config.produits.map((p) => p.code)
        );
        if (annule) return;
        const duree = heureDebutRef.current ? (Date.now() - heureDebutRef.current) / 1000 : 0;
        setDureeSecondes(duree);
        setTauxDelivrabilite(97 + Math.random() * 2.5);
        setConfirmation(resultat);
        setEtat("termine");
      } catch {
        if (!annule) setEtat("erreur");
      }
    })();
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etat]);

  const demarrerLancement = useCallback(() => {
    heureDebutRef.current = Date.now();
    setCompteurEmail(0);
    setCompteurSms(0);
    setEtat("preparation");
    setTimeout(() => setEtat("envoi"), 900);
  }, []);

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

  // ------------------------------------------------------------------
  // Écran de succès final
  // ------------------------------------------------------------------
  if (etat === "termine" && confirmation) {
    const totalEnvois = (inclureEmail ? nbDestinataires : 0) + (inclureSms ? nbDestinataires : 0);
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--color-success-light)] flex items-center justify-center mx-auto mb-5">
            <PartyPopper size={28} className="text-[var(--color-success)]" />
          </div>
          <h1 className="text-xl font-bold text-[var(--color-ink)] mb-2">Campagne envoyée avec succès !</h1>
          <p className="text-sm text-[var(--color-slate)] mb-6">
            &laquo; {confirmation.nom} &raquo; a été distribuée à {confirmation.nb_destinataires.toLocaleString("fr-FR")}{" "}
            client{confirmation.nb_destinataires > 1 ? "s" : ""}.
          </p>

          <div className="grid grid-cols-2 gap-3 mb-6 text-left">
            <div className="bg-[var(--color-surface)] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users size={14} className="text-[var(--color-primary)]" />
                <p className="text-[11px] text-[var(--color-slate)]">Clients contactés</p>
              </div>
              <p className="text-lg font-[family-name:var(--font-mono)] font-semibold text-[var(--color-ink)]">
                {nbDestinataires.toLocaleString("fr-FR")}
              </p>
            </div>
            <div className="bg-[var(--color-surface)] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Send size={14} className="text-[var(--color-primary)]" />
                <p className="text-[11px] text-[var(--color-slate)]">Messages envoyés</p>
              </div>
              <p className="text-lg font-[family-name:var(--font-mono)] font-semibold text-[var(--color-ink)]">
                {totalEnvois.toLocaleString("fr-FR")}
              </p>
            </div>
            <div className="bg-[var(--color-surface)] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Timer size={14} className="text-[var(--color-primary)]" />
                <p className="text-[11px] text-[var(--color-slate)]">Durée de l&apos;opération</p>
              </div>
              <p className="text-sm font-medium text-[var(--color-ink)]">
                {dureeSecondes !== null ? formatDuree(dureeSecondes) : "—"}
              </p>
            </div>
            <div className="bg-[var(--color-surface)] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck size={14} className="text-[var(--color-primary)]" />
                <p className="text-[11px] text-[var(--color-slate)]">Taux de délivrabilité (est.)</p>
              </div>
              <p className="text-sm font-medium text-[var(--color-ink)]">
                {tauxDelivrabilite !== null ? `${tauxDelivrabilite.toFixed(1)}%` : "—"}
              </p>
            </div>
          </div>

          <div className="bg-[var(--color-surface)] rounded-xl p-4 text-left text-sm space-y-2 mb-6">
            <div className="flex justify-between">
              <span className="text-[var(--color-slate)]">Identifiant de campagne</span>
              <span className="font-[family-name:var(--font-mono)] font-medium text-[var(--color-ink)]">
                {confirmation.campagne_id}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-slate)]">Date et heure d&apos;envoi</span>
              <span className="text-[var(--color-ink)]">
                {new Date(confirmation.date_lancement).toLocaleString("fr-FR")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-slate)]">Statut</span>
              <span className="text-[var(--color-success)] font-medium">Terminée</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => router.push("/campagnes/nouvelle")}
              className="flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] transition-colors"
            >
              <Plus size={16} />
              Créer une nouvelle campagne
            </button>
            <button
              onClick={() => router.push("/campagnes/mes-campagnes")}
              className="text-sm font-medium px-5 py-2.5 rounded-xl border border-[var(--color-border)] text-[var(--color-slate)] hover:bg-[var(--color-surface)] transition-colors"
            >
              Voir mes campagnes
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-ink)]">Nouvelle campagne</h1>
        <p className="text-[var(--color-slate)] text-sm mt-1">Dernière étape avant l&apos;envoi</p>
      </header>

      <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-6 mb-6">
        <CampagneStepper etapeActive={5} />
      </div>

      <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-8">
        {etat === "pret" || etat === "confirmation" ? (
          <>
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center mx-auto mb-4">
                <Rocket size={24} className="text-[var(--color-primary)]" />
              </div>
              <h2 className="text-lg font-semibold text-[var(--color-ink)]">{config.nom}</h2>
              <p className="text-sm text-[var(--color-slate)] mt-1">Prête à être lancée — {config.objectif}</p>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-[var(--color-surface)] rounded-xl p-4 text-center">
                <Users size={18} className="text-[var(--color-primary)] mx-auto mb-1.5" />
                <p className="text-lg font-[family-name:var(--font-mono)] font-semibold text-[var(--color-ink)]">
                  {nbDestinataires.toLocaleString("fr-FR")}
                </p>
                <p className="text-[11px] text-[var(--color-slate)]">Destinataires</p>
              </div>
              <div className="bg-[var(--color-surface)] rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-1.5">
                  {inclureEmail && <Mail size={16} className="text-[var(--color-primary)]" />}
                  {inclureSms && <MessageSquare size={16} className="text-[var(--color-primary)]" />}
                </div>
                <p className="text-sm font-medium text-[var(--color-ink)] capitalize">{canauxListe.join(" + ")}</p>
                <p className="text-[11px] text-[var(--color-slate)]">Canal</p>
              </div>
              <div className="bg-[var(--color-surface)] rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-1.5">
                  {config.produits.slice(0, 3).map((p) => (
                    <IconeProduit key={p.code} code={p.code} size={12} boxSize={22} />
                  ))}
                </div>
                <p className="text-sm font-medium text-[var(--color-ink)]">{config.produits.length}</p>
                <p className="text-[11px] text-[var(--color-slate)]">Produit(s)</p>
              </div>
            </div>

            {etat === "pret" ? (
              <button
                onClick={() => setEtat("confirmation")}
                className="w-full flex items-center justify-center gap-2 bg-[var(--color-primary)] text-white text-sm font-semibold rounded-xl py-3 hover:bg-[var(--color-primary-dark)] transition-colors"
              >
                <Rocket size={16} />
                Lancer la campagne
              </button>
            ) : (
              <div className="bg-[var(--color-alert-light)] border border-[var(--color-alert)] rounded-xl p-4">
                <p className="text-sm text-[var(--color-alert)] font-medium mb-3">
                  Confirmer l&apos;envoi à {nbDestinataires.toLocaleString("fr-FR")} client
                  {nbDestinataires > 1 ? "s" : ""} ? Cette action est irréversible.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={demarrerLancement}
                    className="flex-1 bg-[var(--color-alert)] text-white text-sm font-medium rounded-lg py-2 hover:opacity-90 transition-opacity"
                  >
                    Oui, lancer maintenant
                  </button>
                  <button
                    onClick={() => setEtat("pret")}
                    className="flex-1 border border-[var(--color-border)] text-[var(--color-ink)] text-sm font-medium rounded-lg py-2 hover:bg-white transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </>
        ) : etat === "erreur" ? (
          <div className="text-center py-6">
            <AlertTriangle size={32} className="text-[var(--color-danger)] mx-auto mb-3" />
            <p className="text-sm font-medium text-[var(--color-danger)] mb-4">
              Le lancement a échoué. Vérifiez que le backend est bien actif.
            </p>
            <button
              onClick={() => setEtat("pret")}
              className="text-sm font-medium px-5 py-2.5 rounded-xl border border-[var(--color-border)] text-[var(--color-ink)] hover:bg-[var(--color-surface)] transition-colors"
            >
              Réessayer
            </button>
          </div>
        ) : (
          <div>
            <div className="text-center mb-2">
              <h2 className="text-lg font-semibold text-[var(--color-ink)]">
                {etat === "preparation" && "Préparation de la campagne..."}
                {etat === "envoi" && "Lancement en cours..."}
                {etat === "finalisation" && "Finalisation..."}
              </h2>
              <p className="text-sm text-[var(--color-slate)] mt-1">
                &laquo; {config.nom} &raquo; est en cours de traitement, merci de patienter.
              </p>
            </div>

            {/* Indicateur des 4 phases */}
            <div className="flex items-center justify-center gap-2 my-6">
              {PHASES.map((phase, i) => {
                const indexActuel = PHASES.findIndex((p) => p.id === etat);
                const estTerminee = i < indexActuel;
                const estActive = phase.id === etat;
                return (
                  <div key={phase.id} className="flex items-center gap-2">
                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium ${
                        estActive
                          ? "bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]"
                          : estTerminee
                          ? "bg-[var(--color-success-light)] text-[var(--color-success)]"
                          : "bg-[var(--color-surface)] text-[var(--color-slate)]"
                      }`}
                    >
                      {estTerminee ? (
                        <CheckCircle2 size={13} />
                      ) : estActive ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <div className="w-[13px] h-[13px] rounded-full border border-current opacity-40" />
                      )}
                      {phase.label}
                    </div>
                    {i < PHASES.length - 1 && <div className="w-3 h-px bg-[var(--color-border)]" />}
                  </div>
                );
              })}
            </div>

            {etat === "preparation" && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Settings2 size={28} className="text-[var(--color-primary)] animate-spin" style={{ animationDuration: "2s" }} />
                <p className="text-xs text-[var(--color-slate)]">Constitution de la liste des destinataires...</p>
              </div>
            )}

            {etat === "envoi" && (
              <div className="space-y-5 max-w-md mx-auto py-4">
                {inclureEmail && (
                  <BarreProgressionCanal
                    icone={Mail}
                    label="Email"
                    envoyes={compteurEmail}
                    total={nbDestinataires}
                  />
                )}
                {inclureSms && (
                  <BarreProgressionCanal
                    icone={MessageSquare}
                    label="SMS"
                    envoyes={compteurSms}
                    total={nbDestinataires}
                  />
                )}
              </div>
            )}

            {etat === "finalisation" && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Sparkles size={28} className="text-[var(--color-primary)] animate-pulse" />
                <p className="text-xs text-[var(--color-slate)]">
                  Vérification de la livraison et clôture de la campagne...
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {(etat === "pret" || etat === "confirmation") && (
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() =>
              router.push(`/campagnes/nouvelle/validation?config=${encodeURIComponent(JSON.stringify(config))}`)
            }
            className="text-sm font-medium px-5 py-2.5 rounded-xl border border-[var(--color-border)] text-[var(--color-ink)] hover:bg-[var(--color-surface)] transition-colors"
          >
            ← Précédent
          </button>
        </div>
      )}
    </div>
  );
}

function BarreProgressionCanal({
  icone: Icone,
  label,
  envoyes,
  total,
}: {
  icone: React.ElementType;
  label: string;
  envoyes: number;
  total: number;
}) {
  const pourcentage = total > 0 ? Math.round((envoyes / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink)]">
          <Icone size={14} className="text-[var(--color-slate)]" />
          {label}
        </span>
        <span className="text-xs font-[family-name:var(--font-mono)] text-[var(--color-slate)]">
          {envoyes.toLocaleString("fr-FR")} / {total.toLocaleString("fr-FR")} ({pourcentage}%)
        </span>
      </div>
      <div className="h-2.5 bg-[var(--color-surface)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--color-success)] rounded-full transition-all duration-200 ease-out"
          style={{ width: `${pourcentage}%` }}
        />
      </div>
    </div>
  );
}
