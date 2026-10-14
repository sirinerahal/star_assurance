"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Check } from "lucide-react";
import CampagneStepper from "@/components/CampagneStepper";
import DualRangeSlider from "@/components/DualRangeSlider";
import { IconeProduit } from "@/lib/produits";
import { getProduits, getRepartitionScore, Produit, RepartitionScoreItem, CampagneConfig } from "@/lib/api";

const OBJECTIFS = ["Acquisition", "Fidélisation", "Cross-selling", "Up-selling", "Rétention"];
const FREQUENCES = ["Envoi unique", "Quotidien", "Hebdomadaire", "Mensuel"];
const FUSEAUX = ["(UTC+01:00) Tunis"];

const BORNES_TIER: Record<string, [number, number]> = {
  tres_eleve: [80, 100],
  eleve: [60, 79.999],
  moyen: [40, 59.999],
  faible: [0, 39.999],
};

const COULEURS_TIER: Record<string, string> = {
  tres_eleve: "#16a34a",
  eleve: "#84cc16",
  moyen: "#f59e0b",
  faible: "#ef4444",
};

type PlageProduit = { min: number; max: number; tiers: Set<string> };

export default function NouvelleCampagnePage() {
  const router = useRouter();
  const [nom, setNom] = useState("");
  const [produitsChoisis, setProduitsChoisis] = useState<string[]>([]);
  const [objectif, setObjectif] = useState(OBJECTIFS[0]);
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [email, setEmail] = useState(true);
  const [sms, setSms] = useState(false);
  const [frequence, setFrequence] = useState(FREQUENCES[0]);
  const [fuseau, setFuseau] = useState(FUSEAUX[0]);
  const [heure, setHeure] = useState("09:00");
  const [desabonnement, setDesabonnement] = useState(true);
  const [description, setDescription] = useState("");
  const [erreur, setErreur] = useState("");
  const [produits, setProduits] = useState<Produit[]>([]);

  const [repartitions, setRepartitions] = useState<Record<string, RepartitionScoreItem[]>>({});
  const [plages, setPlages] = useState<Record<string, PlageProduit>>({});

  const aujourdHui = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    getProduits(false).then(setProduits).catch(() => setErreur("Le catalogue des produits est indisponible."));
  }, []);

  // Charger la répartition par score dès qu'un produit est sélectionné
  useEffect(() => {
    produitsChoisis.forEach((code) => {
      if (!repartitions[code]) {
        getRepartitionScore(code).then((d) =>
          setRepartitions((prev) => ({ ...prev, [code]: d.repartition }))
        );
      }
      if (!plages[code]) {
        setPlages((prev) => ({ ...prev, [code]: { min: 0, max: 100, tiers: new Set() } }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produitsChoisis]);

  function toggleProduit(code: string) {
    setProduitsChoisis((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  function toggleTier(produitCode: string, tierId: string) {
    setPlages((prev) => {
      const plageActuelle = prev[produitCode] || { min: 0, max: 100, tiers: new Set<string>() };
      const nouveauxTiers = new Set(plageActuelle.tiers);
      if (nouveauxTiers.has(tierId)) {
        nouveauxTiers.delete(tierId);
      } else {
        nouveauxTiers.add(tierId);
      }

      let min = 0;
      let max = 100;
      if (nouveauxTiers.size > 0) {
        const bornes = Array.from(nouveauxTiers).map((t) => BORNES_TIER[t]);
        min = Math.min(...bornes.map((b) => b[0]));
        max = Math.max(...bornes.map((b) => b[1]));
      }

      return { ...prev, [produitCode]: { min, max, tiers: nouveauxTiers } };
    });
  }

  const champLabel = "block text-sm font-medium text-[var(--color-ink)] mb-1.5";
  const champInput =
    "w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent";

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-ink)] flex items-center gap-2.5">
          <Megaphone size={22} className="text-[var(--color-primary)]" />
          Nouvelle campagne
        </h1>
        <p className="text-[var(--color-slate)] text-sm mt-1">
          Créez une campagne massive ciblée à partir des scores de recommandation IA
        </p>
      </header>

      <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-6 mb-6">
        <CampagneStepper etapeActive={1} />
      </div>

      <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-6">
        <h2 className="font-semibold text-[var(--color-ink)] mb-5">Informations générales</h2>

        <div className="space-y-5">
          <div>
            <label className={champLabel}>
              Nom de la campagne <span className="text-[var(--color-danger)]">*</span>
            </label>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Proposition Auto — Été 2026"
              className={champInput}
            />
          </div>

          {/* Sélection multi-produits sous forme de chips */}
          <div>
            <label className={champLabel}>
              Produit(s) proposé(s) <span className="text-[var(--color-danger)]">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {produits.map((produit) => {
                const code = produit.produit_code;
                const selectionne = produitsChoisis.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => toggleProduit(code)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium transition-colors ${
                      selectionne
                        ? "border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]"
                        : "border-[var(--color-border)] text-[var(--color-ink)] hover:border-[var(--color-primary)]"
                    }`}
                  >
                    {selectionne && <Check size={14} />}
                    {produit.produit_nom}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-[var(--color-slate)] mt-1.5">
              Sélectionnez un ou plusieurs produits pour cette campagne.
            </p>
          </div>

          {/* Répartition par score IA + catégories cliquables, pour CHAQUE produit choisi */}
          {produitsChoisis.map((code) => {
            const repartition = repartitions[code] || [];
            const plage = plages[code] || { min: 0, max: 100, tiers: new Set<string>() };
            const total = repartition.reduce((acc, r) => acc + r.nb_clients, 0);
            return (
              <div key={code} className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)]">
                <div className="flex items-center gap-2 mb-3">
                  <IconeProduit code={code} size={14} boxSize={26} />
                  <p className="text-sm font-semibold text-[var(--color-ink)]">
                    Répartition par score IA — {produits.find((produit) => produit.produit_code === code)?.produit_nom || code}
                  </p>
                </div>

                {repartition.length === 0 ? (
                  <p className="text-xs text-[var(--color-slate)]">Chargement...</p>
                ) : (
                  <>
                    <div className="flex h-2.5 rounded-full overflow-hidden mb-3">
                      {repartition.map((r) => (
                        <div key={r.tier} style={{ width: `${r.pourcentage}%`, backgroundColor: COULEURS_TIER[r.tier] }} />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {repartition.map((r) => {
                        const actif = plage.tiers.has(r.tier);
                        return (
                          <button
                            key={r.tier}
                            type="button"
                            onClick={() => toggleTier(code, r.tier)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                              actif ? "text-white border-transparent" : "border-[var(--color-border)] text-[var(--color-ink)]"
                            }`}
                            style={actif ? { backgroundColor: COULEURS_TIER[r.tier] } : {}}
                          >
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: actif ? "white" : COULEURS_TIER[r.tier] }}
                            />
                            {r.label} ({r.nb_clients.toLocaleString("fr-FR")})
                          </button>
                        );
                      })}
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-[var(--color-slate)]">Scoring IA</span>
                        <span className="text-xs font-[family-name:var(--font-mono)] font-medium text-[var(--color-primary)] bg-[var(--color-primary-light)] px-2 py-0.5 rounded-md">
                          {plage.min} → {plage.max}
                        </span>
                      </div>
                      <DualRangeSlider
                        valeurMin={plage.min}
                        valeurMax={plage.max}
                        onChange={(min, max) =>
                          setPlages((prev) => ({ ...prev, [code]: { min, max, tiers: new Set() } }))
                        }
                      />
                      <div className="flex justify-between text-[10px] text-[var(--color-slate)] mt-1">
                        <span>0</span>
                        <span>50</span>
                        <span>100</span>
                      </div>
                      <p className="text-xs text-[var(--color-slate)] mt-2">
                        sur {total.toLocaleString("fr-FR")} clients éligibles
                      </p>
                    </div>
                  </>
                )}
              </div>
            );
          })}

          <div>
            <label className={champLabel}>
              Objectif de la campagne <span className="text-[var(--color-danger)]">*</span>
            </label>
            <select value={objectif} onChange={(e) => setObjectif(e.target.value)} className={champInput}>
              {OBJECTIFS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={champLabel}>
              Période de validité <span className="text-[var(--color-danger)]">*</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={dateDebut}
                min={aujourdHui}
                onChange={(e) => setDateDebut(e.target.value)}
                className={champInput}
              />
              <span className="text-[var(--color-slate)] shrink-0">→</span>
              <input
                type="date"
                value={dateFin}
                min={dateDebut || aujourdHui}
                onChange={(e) => setDateFin(e.target.value)}
                className={champInput}
              />
            </div>
          </div>

          <div>
            <label className={champLabel}>
              Canaux de communication <span className="text-[var(--color-danger)]">*</span>
            </label>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-[var(--color-ink)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={email}
                  onChange={(e) => setEmail(e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--color-primary)]"
                />
                Email
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--color-ink)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={sms}
                  onChange={(e) => setSms(e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--color-primary)]"
                />
                SMS
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={champLabel}>Fréquence d&apos;envoi</label>
              <select value={frequence} onChange={(e) => setFrequence(e.target.value)} className={champInput}>
                {FREQUENCES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={champLabel}>Fuseau horaire d&apos;envoi</label>
              <select value={fuseau} onChange={(e) => setFuseau(e.target.value)} className={champInput}>
                {FUSEAUX.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={champLabel}>Heure d&apos;envoi</label>
            <input
              type="time"
              value={heure}
              onChange={(e) => setHeure(e.target.value)}
              className={`${champInput} max-w-[200px]`}
            />
          </div>

          <div>
            <label className={champLabel}>Gestion des désabonnements</label>
            <label className="flex items-center gap-2 text-sm text-[var(--color-ink)] cursor-pointer">
              <input
                type="checkbox"
                checked={desabonnement}
                onChange={(e) => setDesabonnement(e.target.checked)}
                className="w-4 h-4 rounded accent-[var(--color-primary)]"
              />
              Activer le lien de désabonnement
            </label>
          </div>

          <div>
            <label className={champLabel}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Campagne promotionnelle ciblée basée sur le score de recommandation IA."
              className={`${champInput} resize-none`}
            />
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 mt-7 pt-5 border-t border-[var(--color-border)]">
          {erreur && <p className="text-xs text-[var(--color-danger)]">{erreur}</p>}
          <button
            onClick={() => {
              if (!nom.trim()) return setErreur("Le nom de la campagne est obligatoire.");
              if (produitsChoisis.length === 0) return setErreur("Sélectionnez au moins un produit.");
              if (!dateDebut || !dateFin) return setErreur("Veuillez indiquer la période de validité.");
              if (dateFin < dateDebut) return setErreur("La date de fin doit être après la date de début.");
              if (!email && !sms) return setErreur("Sélectionnez au moins un canal de communication.");
              setErreur("");

              const produitsPayload = produitsChoisis.map((code) => ({
                code,
                score_min: plages[code]?.min ?? 0,
                score_max: plages[code]?.max ?? 100,
              }));
              const canaux = [email && "email", sms && "sms"].filter(Boolean).join(",");
              const config: CampagneConfig = {
                nom, produits: produitsPayload, objectif, canaux, dateDebut, dateFin,
                frequence, fuseau, heure, desabonnement, description,
              };
              router.push(`/campagnes/nouvelle/selection?config=${encodeURIComponent(JSON.stringify(config))}`);
            }}
            className="bg-[var(--color-primary)] text-white text-sm font-medium rounded-xl px-5 py-2.5 hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            Suivant →
          </button>
        </div>
      </div>
    </div>
  );
}
