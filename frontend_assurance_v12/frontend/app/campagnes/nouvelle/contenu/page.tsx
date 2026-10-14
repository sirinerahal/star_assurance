"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Star, Sparkles, Mail, MessageSquare, AlertTriangle, Loader2, Eye, User } from "lucide-react";
import CampagneStepper from "@/components/CampagneStepper";
import { NOMS_PRODUITS } from "@/lib/produits";
import {
  genererMessage,
  getClientsProduit,
  getClient,
  getProduitsDetenus,
  CampagneConfig,
  Client,
  ProduitDetenu,
} from "@/lib/api";

type Canal = "email" | "sms";

const SIGNATURE_EMAIL =
  "Cordialement,\nL'équipe STAR Assurances\ncontact@star.com.tn · 71 340 733 · www.star.com.tn";

const CONFIG_VIDE: CampagneConfig = {
  nom: "", produits: [], objectif: "Acquisition", canaux: "email",
  dateDebut: "", dateFin: "", frequence: "", fuseau: "", heure: "",
  desabonnement: true, description: "",
};

function objetParDefaut(nomsProduits: string): string {
  return `{{prenom}}, découvrez ${nomsProduits} avec STAR Assurances`;
}

function corpsParDefaut(nomsProduits: string): string {
  return `Cher(ère) {{prenom}},\n\nEn tant que client STAR Assurances depuis {{anciennete}}, nous souhaitons attirer votre attention sur notre offre ${nomsProduits}, pensée pour compléter {{contrats_existants}}.\n\nNotre équipe de conseillers se tient à votre disposition pour vous accompagner et répondre à toutes vos questions.\n\nN'hésitez pas à nous contacter pour en savoir plus.`;
}

function smsParDefaut(nomsProduits: string): string {
  return `STAR Assurances : {{prenom}}, decouvrez notre offre ${nomsProduits}, adaptee a votre profil. Contactez votre conseiller.`;
}

function remplacerJetons(
  texte: string,
  client: Client,
  produitsDetenus: ProduitDetenu[],
  nomProduitPrincipal: string
): string {
  // NOTE DE MAINTENANCE : l'année 2026 est volontairement figée pour rester
  // cohérente avec TODAY dans le backend (main.py) et avec le dataset synthétique
  // actuel. Elle devra être revue en même temps que TODAY lors du passage aux
  // données réelles fournies par l'encadrant, qui incluront de vraies dates de
  // naissance et une logique temporelle dynamique.
  const anneeCreation = client.date_creation ? parseInt(client.date_creation.slice(0, 4), 10) : 2026;
  const anciennete = Number.isNaN(anneeCreation) ? 0 : 2026 - anneeCreation;
  const contratsTexte =
    produitsDetenus.length > 0
      ? `votre couverture actuelle (${produitsDetenus.map((p) => p.produit_nom).join(", ")})`
      : "votre protection";

  return texte
    .replaceAll("{{prenom}}", client.prenom || "client")
    .replaceAll("{{nom}}", String(client.nom ?? client.client_id))
    .replaceAll("{{anciennete}}", anciennete > 0 ? `${anciennete} an${anciennete > 1 ? "s" : ""}` : "peu de temps")
    .replaceAll("{{contrats_existants}}", contratsTexte)
    .replaceAll("{{produit_principal}}", nomProduitPrincipal)
    .replaceAll("{{profession}}", client.profession || "profil non renseigné")
    .replaceAll("{{situation_familiale}}", client.situation_familiale || "situation non renseignée");
}

export default function ContenuMessagePage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[var(--color-slate)]">Chargement...</div>}>
      <ContenuMessageContent />
    </Suspense>
  );
}

function ContenuMessageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  let config: CampagneConfig = CONFIG_VIDE;
  try {
    config = { ...CONFIG_VIDE, ...JSON.parse(searchParams.get("config") || "{}") };
  } catch {
    config = CONFIG_VIDE;
  }
  const produits = config.produits;
  const codesProduits = produits.map((p) => p.code);
  const nomsProduits = codesProduits.map((c) => NOMS_PRODUITS[c] || c).join(" et ");
  const canauxDisponibles = config.canaux.split(",").filter(Boolean) as Canal[];

  const [canalActif, setCanalActif] = useState<Canal>(canauxDisponibles[0] || "email");
  const [objetEmail, setObjetEmail] = useState("");
  const [corpsEmail, setCorpsEmail] = useState("");
  const [texteSms, setTexteSms] = useState("");
  const [genererEnCours, setGenererEnCours] = useState(false);
  const [erreurGeneration, setErreurGeneration] = useState("");

  const [apercuOuvert, setApercuOuvert] = useState(false);
  const [clientApercu, setClientApercu] = useState<Client | null>(null);
  const [produitsDetenusApercu, setProduitsDetenusApercu] = useState<ProduitDetenu[]>([]);
  const [chargementApercu, setChargementApercu] = useState(false);

  useEffect(() => {
    if (nomsProduits) {
      setObjetEmail(objetParDefaut(nomsProduits));
      setCorpsEmail(corpsParDefaut(nomsProduits));
      setTexteSms(smsParDefaut(nomsProduits));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const genererAvecIA = useCallback(async () => {
    if (codesProduits.length === 0) return;
    setGenererEnCours(true);
    setErreurGeneration("");
    try {
      const resultat = await genererMessage(codesProduits, config.objectif, canalActif);
      if (resultat.canal === "email") {
        setObjetEmail(resultat.objet);
        setCorpsEmail(resultat.corps);
      } else {
        setTexteSms(resultat.texte);
      }
    } catch {
      setErreurGeneration("La génération IA a échoué. Vérifiez que le backend et la clé API sont actifs.");
    } finally {
      setGenererEnCours(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codesProduits.join(","), config.objectif, canalActif]);

  async function ouvrirApercu() {
    setApercuOuvert(true);
    if (clientApercu || codesProduits.length === 0) return;
    setChargementApercu(true);
    try {
      const premierProduit = produits[0];
      const resultat = await getClientsProduit(premierProduit.code, premierProduit.score_min, premierProduit.score_max, 1, 1);
      if (resultat.clients.length > 0) {
        const client = await getClient(resultat.clients[0].client_id);
        const detenus = await getProduitsDetenus(resultat.clients[0].client_id);
        setClientApercu(client);
        setProduitsDetenusApercu(detenus);
      }
    } finally {
      setChargementApercu(false);
    }
  }

  if (produits.length === 0) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-[var(--color-alert-light)] border border-[var(--color-alert)] text-[var(--color-alert)] rounded-xl p-5 flex items-center gap-3">
          <AlertTriangle size={20} />
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

  const nomProduitPrincipal = NOMS_PRODUITS[codesProduits[0]] || codesProduits[0];
  const objetApercu = clientApercu ? remplacerJetons(objetEmail, clientApercu, produitsDetenusApercu, nomProduitPrincipal) : "";
  const corpsApercu = clientApercu ? remplacerJetons(corpsEmail, clientApercu, produitsDetenusApercu, nomProduitPrincipal) : "";
  const smsApercu = clientApercu ? remplacerJetons(texteSms, clientApercu, produitsDetenusApercu, nomProduitPrincipal) : "";

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-ink)]">Nouvelle campagne</h1>
        <p className="text-[var(--color-slate)] text-sm mt-1">
          Rédigez le contenu du message pour {nomsProduits} — objectif : {config.objectif}
        </p>
      </header>

      <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-6 mb-6">
        <CampagneStepper etapeActive={3} />
      </div>

      {canauxDisponibles.length > 1 && (
        <div className="flex items-center gap-2 mb-5 border-b border-[var(--color-border)]">
          {canauxDisponibles.map((c) => (
            <button
              key={c}
              onClick={() => setCanalActif(c)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                canalActif === c
                  ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                  : "border-transparent text-[var(--color-slate)] hover:text-[var(--color-ink)]"
              }`}
            >
              {c === "email" ? <Mail size={15} /> : <MessageSquare size={15} />}
              {c === "email" ? "Email" : "SMS"}
            </button>
          ))}
        </div>
      )}

      <div className="bg-[var(--color-primary-light)] rounded-xl p-3 mb-4 text-xs text-[var(--color-primary-dark)]">
        💡 Utilisez des variables comme <code className="font-[family-name:var(--font-mono)]">{"{{prenom}}"}</code>,{" "}
        <code className="font-[family-name:var(--font-mono)]">{"{{anciennete}}"}</code>,{" "}
        <code className="font-[family-name:var(--font-mono)]">{"{{contrats_existants}}"}</code> — elles seront
        automatiquement remplacées par les vraies infos de chaque client au moment de l&apos;envoi.
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[var(--color-slate)]">
          Template {canalActif === "email" ? "email" : "SMS"} pré-rempli — modifiable librement
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={ouvrirApercu}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl border border-[var(--color-border)] text-[var(--color-ink)] hover:bg-[var(--color-surface)] transition-colors"
          >
            <Eye size={16} />
            Aperçu personnalisé
          </button>
          <button
            onClick={genererAvecIA}
            disabled={genererEnCours}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[#7c3aed] text-white hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {genererEnCours ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Générer avec l&apos;IA
          </button>
        </div>
      </div>

      {erreurGeneration && (
        <div className="bg-[var(--color-alert-light)] border border-[var(--color-alert)] text-[var(--color-alert)] rounded-xl p-3 mb-4 text-sm">
          {erreurGeneration}
        </div>
      )}

      {canalActif === "email" ? (
        <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden mb-6">
          <div className="bg-[var(--color-ink)] px-6 py-4 flex items-center gap-2.5">
            <Star size={22} className="text-white fill-white" />
            <div className="leading-none">
              <p className="font-[family-name:var(--font-display)] font-extrabold text-white text-sm tracking-tight">
                STAR
              </p>
              <p className="text-[9px] tracking-[0.2em] text-slate-300 font-medium">ASSURANCES</p>
            </div>
          </div>

          <div className="p-6">
            <label className="block text-xs text-[var(--color-slate)] mb-1.5">Objet</label>
            <input
              type="text"
              value={objetEmail}
              onChange={(e) => setObjetEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] mb-5"
            />

            <label className="block text-xs text-[var(--color-slate)] mb-1.5">Contenu du message</label>
            <textarea
              value={corpsEmail}
              onChange={(e) => setCorpsEmail(e.target.value)}
              rows={10}
              className="w-full px-3.5 py-3 rounded-xl border border-[var(--color-border)] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none leading-relaxed"
            />

            <div className="mt-5 pt-5 border-t border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-slate)] whitespace-pre-line">{SIGNATURE_EMAIL}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6">
          <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-6 max-w-sm mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-full bg-[var(--color-primary)] flex items-center justify-center">
                <Star size={13} className="text-white fill-white" />
              </div>
              <p className="text-xs font-medium text-[var(--color-slate)]">STAR Assurances</p>
            </div>
            <textarea
              value={texteSms}
              onChange={(e) => setTexteSms(e.target.value)}
              rows={5}
              className="w-full px-4 py-3 rounded-2xl rounded-tl-sm bg-[var(--color-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none leading-relaxed"
            />
            <p
              className={`text-xs mt-2 text-right ${
                texteSms.length > 160 ? "text-[var(--color-danger)] font-medium" : "text-[var(--color-slate)]"
              }`}
            >
              {texteSms.length} / 160 caractères
              {texteSms.length > 160 ? " — trop long, sera envoyé en plusieurs SMS" : ""}
            </p>
          </div>
        </div>
      )}

      {/* Aperçu personnalisé pour un vrai client de l'audience */}
      {apercuOuvert && (
        <div className="bg-white border-2 border-[var(--color-primary)] rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center text-[var(--color-primary-dark)]">
                <User size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-ink)]">
                  {chargementApercu
                    ? "Recherche d'un client de l'audience..."
                    : clientApercu
                    ? `Aperçu pour ${clientApercu.prenom} ${clientApercu.nom}`
                    : "Aucun client trouvé dans cette audience"}
                </p>
                <p className="text-[11px] text-[var(--color-slate)]">
                  Exemple réel parmi les clients ciblés — ainsi rendu à l&apos;envoi
                </p>
              </div>
            </div>
            <button
              onClick={() => setApercuOuvert(false)}
              className="text-xs text-[var(--color-slate)] hover:text-[var(--color-ink)]"
            >
              Fermer
            </button>
          </div>

          {clientApercu && !chargementApercu && (
            <div className="bg-[var(--color-surface)] rounded-xl p-4 text-sm text-[var(--color-ink)]">
              {canalActif === "email" ? (
                <>
                  <p className="font-medium mb-2">{objetApercu}</p>
                  <p className="whitespace-pre-line text-[var(--color-slate)] leading-relaxed">{corpsApercu}</p>
                </>
              ) : (
                <p className="whitespace-pre-line">{smsApercu}</p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push(`/campagnes/nouvelle/selection?config=${encodeURIComponent(JSON.stringify(config))}`)}
          className="text-sm font-medium px-5 py-2.5 rounded-xl border border-[var(--color-border)] text-[var(--color-ink)] hover:bg-[var(--color-surface)] transition-colors"
        >
          ← Précédent
        </button>
        <button
          onClick={() => {
            const configEnrichie: CampagneConfig = {
              ...config,
              contenuEmail: { objet: objetEmail, corps: corpsEmail },
              contenuSms: { texte: texteSms },
            };
            router.push(`/campagnes/nouvelle/validation?config=${encodeURIComponent(JSON.stringify(configEnrichie))}`);
          }}
          className="bg-[var(--color-primary)] text-white text-sm font-medium rounded-xl px-5 py-2.5 hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          Suivant →
        </button>
      </div>
    </div>
  );
}
