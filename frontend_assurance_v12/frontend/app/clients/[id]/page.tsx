import {
  getClient,
  getRecommandations,
  getEvenementsClient,
  getHistoriqueRecommandations,
  getProduitsDetenus,
  type Client,
  type Evenement,
  type HistoriqueRecommandation,
  type ProduitDetenu,
  type Recommandation,
} from "@/lib/api";
import ScoreGauge from "@/components/ScoreGauge";
import ChatDrawer from "@/components/ChatDrawer";
import SimulationRapide from "@/components/SimulationRapide";
import RecommandationDetailModal from "@/components/RecommandationDetailModal";
import { IconeProduit, NOMS_PRODUITS, SOUS_TITRES_PRODUITS } from "@/lib/produits";
import {
  FileText,
  ShieldAlert,
  CalendarClock,
  AlertTriangle,
  Home,
  Heart,
  Baby,
  Briefcase,
  Car,
  CheckCircle2,
  User,
  Calendar,
  PackageCheck,
  MapPin,
} from "lucide-react";

function potentielLabel(score: number): { texte: string; description: string } {
  if (score >= 75) return { texte: "Très fort potentiel", description: "Client très réceptif aux nouvelles offres." };
  if (score >= 50) return { texte: "Fort potentiel", description: "Client réceptif à une nouvelle proposition." };
  if (score >= 25) return { texte: "Potentiel modéré", description: "À solliciter avec une offre bien ciblée." };
  return { texte: "Potentiel limité", description: "Peu de signaux d'appétence détectés actuellement." };
}

const ICONES_EVENEMENTS: Record<string, React.ElementType> = {
  "Achat immobilier": Home,
  Mariage: Heart,
  Naissance: Baby,
  "Changement d'emploi": Briefcase,
  Divorce: Heart,
  "Achat véhicule": Car,
};

const STATUT_STYLES: Record<string, string> = {
  "Acceptée": "bg-[var(--color-success-light)] text-[var(--color-success)]",
  "Proposée": "bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]",
  "Refusée": "bg-red-100 text-red-600",
  "En attente": "bg-slate-100 text-slate-500",
};

export default async function FicheClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let client!: Client;
  let recommandationsData: { client_id: string; recommandations: Recommandation[] } = { client_id: id, recommandations: [] };
  let evenements: Evenement[] = [];
  let historique: HistoriqueRecommandation[] = [];
  let produitsDetenus: ProduitDetenu[] = [];
  let recommandationsErreur = false;
  let evenementsErreur = false;
  let historiqueErreur = false;
  let produitsDetenusErreur = false;

  try {
    const [clientResult, recommandationsResult, evenementsResult, historiqueResult, produitsDetenusResult] = await Promise.allSettled([
      getClient(id),
      getRecommandations(id, true),
      getEvenementsClient(id),
      getHistoriqueRecommandations(id),
      getProduitsDetenus(id),
    ]);

    if (clientResult.status === "rejected") throw clientResult.reason;
    client = clientResult.value;

    if (recommandationsResult.status === "fulfilled") {
      recommandationsData = recommandationsResult.value;
    } else {
      recommandationsErreur = true;
      recommandationsData = { client_id: id, recommandations: [] };
    }

    if (evenementsResult.status === "fulfilled") {
      evenements = evenementsResult.value;
    } else {
      evenementsErreur = true;
      evenements = [];
    }

    if (historiqueResult.status === "fulfilled") {
      historique = historiqueResult.value;
    } else {
      historiqueErreur = true;
      historique = [];
    }

    if (produitsDetenusResult.status === "fulfilled") {
      produitsDetenus = produitsDetenusResult.value;
    } else {
      produitsDetenusErreur = true;
      produitsDetenus = [];
    }
  } catch {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="bg-[var(--color-alert-light)] border border-[var(--color-alert)] text-[var(--color-alert)] rounded-xl p-5 flex items-center gap-3">
          <AlertTriangle size={20} />
          <p className="text-sm font-medium">Client introuvable, ou l&apos;API n&apos;est pas accessible.</p>
        </div>
      </div>
    );
  }

  const recommandations = recommandationsData.recommandations;
  const scoreGlobal = recommandations.length > 0 ? Math.round(recommandations[0].score) : 0;
  const potentiel = potentielLabel(scoreGlobal);
  const nomClient = `Client ${client.client_id}`;
  const valeur = (champ: string | number | null | undefined) =>
    champ === null || champ === undefined || champ === "" ? "Non renseigné" : String(champ);
  const dateCreation = client.date_creation ? client.date_creation.slice(0, 4) : "Non renseignée";
  const nbEnfants = client.nb_enfants === null ? "Non renseigné" : `${client.nb_enfants} enfant${client.nb_enfants > 1 ? "s" : ""}`;

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-5">
              <h2 className="font-semibold text-[var(--color-ink)] text-sm mb-4">1. Profil Client</h2>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] flex items-center justify-center font-semibold text-lg">
                  {client.client_id.slice(-2)}
                </div>
                <div>
                  <p className="font-semibold text-[var(--color-ink)]">
                    {nomClient}
                  </p>
                  <span className="inline-block mt-0.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--color-success-light)] text-[var(--color-success)]">
                    Client actif
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm mb-4 pb-4 border-b border-[var(--color-border)]">
                <div className="flex items-center gap-2.5 text-[var(--color-ink)]">
                  <User size={14} className="text-[var(--color-slate)]" />
                  {client.age === null ? "Âge non renseigné" : `${client.age} ans`}
                </div>
                <div className="flex items-center gap-2.5 text-[var(--color-ink)]">
                  <Briefcase size={14} className="text-[var(--color-slate)]" />
                  {valeur(client.profession)}
                </div>
                <div className="flex items-center gap-2.5 text-[var(--color-ink)]">
                  <Heart size={14} className="text-[var(--color-slate)]" />
                  {valeur(client.situation_familiale)}
                </div>
                <div className="flex items-center gap-2.5 text-[var(--color-ink)]">
                  <User size={14} className="text-[var(--color-slate)]" />
                  Sexe : {valeur(client.sexe)}
                </div>
                <div className="flex items-center gap-2.5 text-[var(--color-ink)]">
                  <Baby size={14} className="text-[var(--color-slate)]" />
                  {nbEnfants}
                </div>
                <div className="flex items-center gap-2.5 text-[var(--color-ink)]">
                  <Calendar size={14} className="text-[var(--color-slate)]" />
                  Né(e) le : {client.date_naissance || "Non renseignée"}
                </div>
                <div className="flex items-center gap-2.5 text-[var(--color-ink)]">
                  <span className="text-[var(--color-slate)]">TND</span>
                  Revenu : {client.revenu_annuel === null ? "Non renseigné" : `${client.revenu_annuel.toLocaleString("fr-FR")} TND/an`}
                </div>
                <div className="flex items-center gap-2.5 text-[var(--color-ink)] col-span-2">
                  <Calendar size={14} className="text-[var(--color-slate)]" />
                  Client depuis : {dateCreation}
                </div>
                <div className="flex items-start gap-2.5 text-[var(--color-ink)] col-span-2">
                  <MapPin size={14} className="text-[var(--color-slate)] shrink-0 mt-0.5" />
                  <span>{valeur(client.adresse)}</span>
                </div>
              </div>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center gap-2.5 text-[var(--color-ink)]">
                  <FileText size={14} className="text-[var(--color-slate)]" />
                  {client.nb_contrats_existants ?? 0} contrat{(client.nb_contrats_existants ?? 0) > 1 ? "s" : ""} actif
                  {(client.nb_contrats_existants ?? 0) > 1 ? "s" : ""}
                </div>
                <div className="flex items-center gap-2.5 text-[var(--color-ink)]">
                  <ShieldAlert size={14} className="text-[var(--color-slate)]" />
                  {client.nb_sinistres_total === 0 || client.nb_sinistres_total === null
                    ? "Aucun sinistre déclaré"
                    : `${client.nb_sinistres_total} sinistre(s) déclaré(s)`}
                </div>
                {evenements.length > 0 && (
                  <div className="flex items-center gap-2.5 text-[var(--color-ink)]">
                    <CalendarClock size={14} className="text-[var(--color-slate)]" />
                    Événement récent : {evenements[0].type_evenement} ({evenements[0].date_evenement.slice(0, 4)})
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-5 flex flex-col items-center justify-center text-center">
              <h2 className="font-semibold text-[var(--color-ink)] text-sm mb-4 self-start">
                2. Score d&apos;appétence global
              </h2>
              <ScoreGauge score={scoreGlobal} size={110} />
              <p className="font-semibold text-[var(--color-ink)] mt-3">{potentiel.texte}</p>
              <p className="text-xs text-[var(--color-slate)] mt-1">{potentiel.description}</p>
            </div>
          </div>

          <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-5">
            <h2 className="font-semibold text-[var(--color-ink)] text-sm mb-3 flex items-center gap-2">
              <PackageCheck size={16} className="text-[var(--color-slate)]" />
              Produits déjà détenus
            </h2>
            {produitsDetenus.length === 0 ? (
              <p className="text-sm text-[var(--color-slate)]">
                {produitsDetenusErreur ? "Impossible de charger les produits détenus pour le moment." : "Rien"}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {produitsDetenus.map((p) => (
                  <span
                    key={p.produit_code}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]"
                  >
                    {p.produit_nom}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-5">
            <h2 className="font-semibold text-[var(--color-ink)] text-sm mb-4">3. Recommandations IA</h2>
            {recommandationsErreur ? (
              <p className="text-sm text-[var(--color-slate)]">Impossible de charger les recommandations pour le moment.</p>
            ) : recommandations.length === 0 ? (
              <p className="text-sm text-[var(--color-slate)]">Aucune recommandation disponible pour ce client actuellement.</p>
            ) : (
              <div className="space-y-3">
                {recommandations.map((reco) => (
                  <div
                    key={reco.produit}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-[var(--color-surface)] transition-colors"
                  >
                    <IconeProduit code={reco.produit} />
                    <div className="w-48 shrink-0">
                      <p className="font-medium text-sm text-[var(--color-ink)]">
                        {reco.produit_nom || NOMS_PRODUITS[reco.produit] || reco.produit}
                      </p>
                      <p className="text-xs text-[var(--color-slate)]">{SOUS_TITRES_PRODUITS[reco.produit] || ""}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-[var(--color-surface)] rounded-full overflow-hidden max-w-[160px]">
                          <div
                            className="h-full bg-[var(--color-success)] rounded-full"
                            style={{ width: `${reco.score}%` }}
                          />
                        </div>
                        <span className="text-xs font-[family-name:var(--font-mono)] font-medium text-[var(--color-ink)] shrink-0">
                          {Math.round(reco.score)}/100
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${
                        reco.score >= 70
                          ? "bg-[var(--color-success-light)] text-[var(--color-success)]"
                          : reco.score >= 45
                          ? "bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {reco.score >= 70 ? "Très élevée" : reco.score >= 45 ? "Élevée" : "Moyenne"}
                    </span>
                    <RecommandationDetailModal recommandation={reco} />
                  </div>
                ))}
              </div>
            )}
            {!recommandationsErreur && recommandations.length > 0 && (
              <div className="mt-4">
                <button
                  type="button"
                  disabled
                  className="w-full bg-[var(--color-surface)] text-[var(--color-slate)] text-sm font-medium rounded-xl py-2.5 cursor-not-allowed opacity-70"
                >
                  Générer une offre globale
                </button>
                <div className="mt-2 flex justify-center">
                  <span className="inline-flex items-center text-[9px] uppercase tracking-wide text-slate-500 border border-slate-300 rounded px-1.5 py-0.5 bg-slate-100">
                    Bientôt disponible
                  </span>
                </div>
              </div>
            )}
          </div>

          {recommandations.length > 0 && (
            <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-5">
              <h2 className="font-semibold text-[var(--color-ink)] text-sm mb-4">Explication des recommandations</h2>
              <div className="space-y-4">
                {recommandations.map((reco, i) => (
                  <div key={reco.produit} className={i > 0 ? "pt-4 border-t border-[var(--color-border)]" : ""}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <IconeProduit code={reco.produit} size={14} boxSize={26} />
                      <p className="font-medium text-sm text-[var(--color-ink)]">
                        {reco.produit_nom || NOMS_PRODUITS[reco.produit] || reco.produit}
                      </p>
                    </div>
                    <p className="text-sm text-[var(--color-slate)] leading-relaxed">
                      {reco.explication_produit || reco.explication ||
                        `Nous recommandons ${reco.produit_nom || NOMS_PRODUITS[reco.produit] || reco.produit} sur la base du profil et de l'historique de ce client.`}
                    </p>
                    <p className="mt-2 text-sm text-[var(--color-ink)]">
                      <span className="font-medium">Pack recommandé :</span>{" "}
                      {reco.pack_recommande ? reco.pack_recommande.pack_nom : "Non déterminé par les données disponibles."}
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-slate)]">
                      <span className="font-medium text-[var(--color-ink)]">Pourquoi ce pack :</span>{" "}
                      {reco.explication_pack}
                    </p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-5 pt-4 border-t border-[var(--color-border)]">
                {[
                  "Adaptée à votre profil et à votre situation",
                  "Basée sur les données disponibles du profil",
                  "Score calculé par le modèle IA du projet",
                  "Explication générée automatiquement (LLM)",
                ].map((t) => (
                  <div key={t} className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
                    <CheckCircle2 size={15} className="text-[var(--color-success)] shrink-0" />
                    {t}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="font-semibold text-[var(--color-ink)] text-sm">Filtres</h2>
              <span className="inline-flex items-center text-[9px] uppercase tracking-wide text-slate-500 border border-slate-300 rounded px-1.5 py-0.5 bg-slate-100">
                Bientôt disponible
              </span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[var(--color-slate)] mb-1.5">Période</label>
                <select disabled className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm bg-white opacity-60 cursor-not-allowed">
                  <option>Mois en cours</option>
                  <option>Trimestre en cours</option>
                  <option>Année en cours</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--color-slate)] mb-1.5">Agence</label>
                <select disabled className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm bg-white opacity-60 cursor-not-allowed">
                  <option>Toutes</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--color-slate)] mb-1.5">Conseiller</label>
                <select disabled className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm bg-white opacity-60 cursor-not-allowed">
                  <option>Tous</option>
                </select>
              </div>
              <button disabled className="w-full bg-[var(--color-ink)] text-white text-sm font-medium rounded-lg py-2 opacity-60 cursor-not-allowed">
                Appliquer
              </button>
            </div>
          </div>

          <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-5">
            <h2 className="font-semibold text-[var(--color-ink)] text-sm mb-4">Événements de vie détectés</h2>
            {evenementsErreur ? (
              <p className="text-sm text-[var(--color-slate)]">Impossible de charger les événements pour le moment.</p>
            ) : evenements.length === 0 ? (
              <p className="text-sm text-[var(--color-slate)]">Aucun événement détecté récemment.</p>
            ) : (
              <div className="space-y-3">
                {evenements.slice(0, 4).map((evt, i) => {
                  const Icon = ICONES_EVENEMENTS[evt.type_evenement] || CalendarClock;
                  return (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2.5">
                        <Icon size={15} className="text-[var(--color-primary)]" />
                        <span className="text-[var(--color-ink)]">{evt.type_evenement}</span>
                      </div>
                      <span className="text-xs text-[var(--color-slate)]">{evt.date_evenement}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <SimulationRapide recommandations={recommandations} />

          <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-5">
            <h2 className="font-semibold text-[var(--color-ink)] text-sm mb-4">6. Historique des recommandations</h2>
            {historiqueErreur ? (
              <p className="text-sm text-[var(--color-slate)]">Impossible de charger l&apos;historique pour le moment.</p>
            ) : historique.length === 0 ? (
              <p className="text-sm text-[var(--color-slate)]">Aucune recommandation enregistrée.</p>
            ) : (
              <div className="space-y-2.5">
                {historique.slice(0, 5).map((h, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-[var(--color-ink)] font-medium">{NOMS_PRODUITS[h.produit_code] || h.produit_code}</p>
                      <p className="text-xs text-[var(--color-slate)]">{h.date_recommandation}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUT_STYLES[h.statut] || "bg-slate-100 text-slate-500"}`}>
                      {h.statut}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ChatDrawer clientId={client.client_id} />
    </div>
  );
}

