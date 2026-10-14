const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

async function fetchJson<T>(url: string, errorMessage: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  headers.set("X-API-Key", process.env.NEXT_PUBLIC_API_KEY ?? "");
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const error = new Error(errorMessage) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export type Client = {
  client_id: string;
  nom: string | number | null;
  prenom: string | null;
  age: number | null;
  profession: string | null;
  situation_familiale: string | null;
  nb_enfants: number | null;
  revenu_annuel: number | null;
  nb_contrats_existants: number | null;
  nb_sinistres_total: number | null;
  date_naissance?: string | null;
  sexe?: string | null;
  adresse?: string | null;
  date_creation: string | null;
};

export type ProduitDetenu = {
  produit_code: string;
  produit_nom: string;
};

export type Produit = {
  produit_code: string;
  produit_nom: string;
  produit_id?: string;
  code_produit?: string;
  type_branche?: "Vie" | "Non-Vie" | string;
  branche: string;
  categorie: string;
  description: string;
  niveau_couverture: string;
  est_complementaire: boolean;
  produit_parent: string;
  canal_distribution: string;
  actif: boolean;
  date_creation: string;
};

export async function getProduits(inclureInactifs = true): Promise<Produit[]> {
  const params = new URLSearchParams({ inclure_inactifs: String(inclureInactifs) });
  const data = await fetchJson<{ produits: Produit[] }>(
    `${API_URL}/produits?${params}`,
    "Catalogue produits indisponible",
    { cache: "no-store" }
  );
  return data.produits;
}

export type RelationProduitPack = Produit & {
  produit_id: string;
  code_produit: string;
  packs: { pack_code: string; pack_nom: string; valeur: number; produit_id: string; code_produit: string }[];
};

export async function getRelationProduitsPacks(): Promise<{
  produits: RelationProduitPack[];
  packs_orphelins: { pack_code: string; pack_nom: string; valeur: number; produit_id: string; code_produit: string }[];
  source: string;
  cle_composite: string[];
  produits_sans_pack: string[];
  controle: {
    nb_produits: number;
    nb_produits_avec_pack: number;
    nb_produits_sans_pack: number;
    nb_packs: number;
    nb_packs_orphelins: number;
  };
}> {
  return fetchJson(`${API_URL}/produits/relation-packs`, "Relation produits-packs indisponible", { cache: "no-store" });
}

export async function modifierStatutProduit(produitCode: string, actif: boolean): Promise<Produit> {
  return fetchJson<Produit>(`${API_URL}/produits/${encodeURIComponent(produitCode)}`, "Modification du statut impossible", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actif }),
  });
}

export async function getProduitsDetenus(clientId: string): Promise<ProduitDetenu[]> {
  const data = await fetchJson<{ produits: ProduitDetenu[] }>(
    `${API_URL}/clients/${clientId}/produits-detenus`,
    "Produits détenus indisponibles",
    { cache: "no-store" }
  );
  return data.produits;
}

export type Recommandation = {
  produit: string;
  produit_nom?: string;
  score: number;
  explication?: string;
  explication_produit?: string;
  packs_disponibles: {
    pack_code: string;
    pack_nom: string;
    valeur: number;
    produit_id: string;
    code_produit: string;
  }[];
  pack_recommande: {
    pack_code: string;
    pack_nom: string;
    valeur: number;
    produit_id: string;
    code_produit: string;
    score_pack?: number;
    source_donnee?: string;
  } | null;
  explication_pack: string;
};

export type ClientResume = {
  client_id: string;
  nom: string | number | null;
  prenom: string | null;
  age: number | null;
  profession: string | null;
  situation_familiale: string | null;
  nb_contrats_existants: number | null;
};

export type DashboardStats = {
  nb_clients: number;
  nb_contrats: number;
  nb_produits: number;
  revenu_annuel_moyen: number;
  contrats_par_client_moyen: number;
  taux_conversion: number;
  score_moyen_recommandations: number;
  ventes_additionnelles: number;
  satisfaction_client: number;
  top_produits: { produit_code: string; nb_contrats: number }[];
  repartition_profession: { profession: string; nb_clients: number }[];
};

export type Evenement = {
  type_evenement: string;
  date_evenement: string;
  description: string;
};

export type HistoriqueRecommandation = {
  produit_code: string;
  date_recommandation: string;
  statut: string;
};

export async function getEvenementsClient(clientId: string): Promise<Evenement[]> {
  const data = await fetchJson<{ evenements: Evenement[] }>(
    `${API_URL}/clients/${clientId}/evenements`,
    "Événements indisponibles",
    { cache: "no-store" }
  );
  return data.evenements;
}

export async function getHistoriqueRecommandations(clientId: string): Promise<HistoriqueRecommandation[]> {
  const data = await fetchJson<{ historique: HistoriqueRecommandation[] }>(
    `${API_URL}/clients/${clientId}/historique-recommandations`,
    "Historique indisponible",
    { cache: "no-store" }
  );
  return data.historique;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return fetchJson<DashboardStats>(
    `${API_URL}/dashboard/stats`,
    "Statistiques indisponibles",
    { cache: "no-store" }
  );
}

export async function listerClients(
  recherche = "",
  page = 1,
  taillePage = 20
): Promise<{ total: number; page: number; taille_page: number; clients: ClientResume[] }> {
  const params = new URLSearchParams({
    recherche,
    page: String(page),
    taille_page: String(taillePage),
  });
  return fetchJson<{ total: number; page: number; taille_page: number; clients: ClientResume[] }>(
    `${API_URL}/clients?${params}`,
    "Liste des clients indisponible",
    { cache: "no-store" }
  );
}

export type AudienceStats = {
  type: string;
  segment: string;
  tier: string;
  nb_clients: number;
  score_moyen: number;
  taux_reponse_estime: number;
  messages_email: number;
  messages_sms: number;
};

export type RepartitionScoreItem = {
  tier: string;
  label: string;
  nb_clients: number;
  pourcentage: number;
};

export type SegmentStats = {
  segment_id: string;
  label: string;
  nb_clients: number;
  score_moyen: number;
  taux_reponse_estime: number;
};

export type ClientAvecScore = {
  client_id: string;
  nom: string;
  prenom: string;
  age: number;
  profession: string;
  situation_familiale: string;
  score: number;
};

export type CampagneConfig = {
  nom: string;
  produits: ProduitCritere[];
  objectif: string;
  canaux: string; // "email", "sms" ou "email,sms"
  dateDebut: string;
  dateFin: string;
  frequence: string;
  fuseau: string;
  heure: string;
  desabonnement: boolean;
  description: string;
  contenuEmail?: { objet: string; corps: string };
  contenuSms?: { texte: string };
};

export type ProduitCritere = {
  code: string;
  score_min: number;
  score_max: number;
};

export type AudienceMultiResult = {
  nb_clients_uniques: number;
  score_moyen_combine: number;
  taux_reponse_estime_combine: number;
  messages_email: number;
  messages_sms: number;
  detail_par_produit: {
    produit: string;
    score_min: number;
    score_max: number;
    nb_clients: number;
    score_moyen: number;
    taux_reponse_estime: number;
  }[];
};

export async function getAudienceMulti(
  produits: ProduitCritere[],
  type: "tous" | "segment",
  segment = ""
): Promise<AudienceMultiResult> {
  return fetchJson<AudienceMultiResult>(
    `${API_URL}/campagnes/audience-multi`,
    "Audience indisponible",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ produits, type, segment }),
    }
  );
}

export async function getClientsProduit(
  produit: string,
  scoreMin: number,
  scoreMax: number,
  page = 1,
  taillePage = 20
): Promise<{ total: number; clients: ClientAvecScore[] }> {
  const params = new URLSearchParams({
    score_min: String(scoreMin), score_max: String(scoreMax), page: String(page), taille_page: String(taillePage),
  });
  return fetchJson<{ total: number; clients: ClientAvecScore[] }>(
    `${API_URL}/campagnes/produit/${produit}/clients?${params}`,
    "Clients indisponibles",
    { cache: "no-store" }
  );
}

export async function getAudience(
  produit: string,
  scoreMin: number,
  type: "tous" | "segment" | "score",
  segment = "",
  tier = ""
): Promise<AudienceStats> {
  const params = new URLSearchParams({ produit, score_min: String(scoreMin), type, segment, tier });
  return fetchJson<AudienceStats>(`${API_URL}/campagnes/audience?${params}`, "Audience indisponible", {
    cache: "no-store",
  });
}

export async function getRepartitionScore(
  produit: string
): Promise<{ total: number; repartition: RepartitionScoreItem[] }> {
  const params = new URLSearchParams({ produit });
  return fetchJson<{ total: number; repartition: RepartitionScoreItem[] }>(
    `${API_URL}/campagnes/repartition-score?${params}`,
    "Répartition indisponible",
    { cache: "no-store" }
  );
}

export async function getSegments(
  produit: string,
  scoreMin: number,
  scoreMax = 100
): Promise<{ segments: SegmentStats[] }> {
  const params = new URLSearchParams({ produit, score_min: String(scoreMin), score_max: String(scoreMax) });
  return fetchJson<{ segments: SegmentStats[] }>(`${API_URL}/campagnes/segments?${params}`, "Segments indisponibles", {
    cache: "no-store",
  });
}

export async function getClientsSegment(
  segmentId: string,
  produit: string,
  scoreMin: number,
  page = 1,
  taillePage = 20
): Promise<{ total: number; clients: ClientAvecScore[] }> {
  const params = new URLSearchParams({
    produit, score_min: String(scoreMin), page: String(page), taille_page: String(taillePage),
  });
  return fetchJson<{ total: number; clients: ClientAvecScore[] }>(
    `${API_URL}/campagnes/segments/${segmentId}/clients?${params}`,
    "Clients indisponibles",
    { cache: "no-store" }
  );
}

export async function getClientsParScore(
  tier: string,
  produit: string,
  scoreMin: number,
  page = 1,
  taillePage = 20
): Promise<{ total: number; clients: ClientAvecScore[] }> {
  const params = new URLSearchParams({
    produit, score_min: String(scoreMin), page: String(page), taille_page: String(taillePage),
  });
  return fetchJson<{ total: number; clients: ClientAvecScore[] }>(
    `${API_URL}/campagnes/score/${tier}/clients?${params}`,
    "Clients indisponibles",
    { cache: "no-store" }
  );
}

export type MessageGenere =
  | { canal: "email"; objet: string; corps: string }
  | { canal: "sms"; texte: string };

export async function genererMessage(
  produits: string[],
  objectif: string,
  canal: "email" | "sms"
): Promise<MessageGenere> {
  return fetchJson<MessageGenere>(`${API_URL}/campagnes/generer-message`, "Génération indisponible", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ produits, objectif, canal }),
  });
}

export type ConfirmationLancement = {
  campagne_id: string;
  nom: string;
  objectif: string;
  produits: string[];
  statut: string;
  nb_destinataires: number;
  canaux: string;
  date_lancement: string;
};

export async function lancerCampagne(
  nom: string,
  nbDestinataires: number,
  canaux: string,
  objectif: string,
  produits: string[]
): Promise<ConfirmationLancement> {
  return fetchJson<ConfirmationLancement>(`${API_URL}/campagnes/lancer`, "Le lancement a échoué", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nom, nb_destinataires: nbDestinataires, canaux, objectif, produits }),
  });
}

export async function listerCampagnes(): Promise<{
  campagnes: ConfirmationLancement[];
  total_campagnes: number;
  total_contactes: number;
}> {
  return fetchJson<{
    campagnes: ConfirmationLancement[];
    total_campagnes: number;
    total_contactes: number;
  }>(`${API_URL}/campagnes/liste`, "Liste des campagnes indisponible", { cache: "no-store" });
}

export async function getClient(clientId: string): Promise<Client> {
  return fetchJson<Client>(`${API_URL}/clients/${clientId}`, "Client introuvable", { cache: "no-store" });
}

export async function getRecommandations(
  clientId: string,
  avecExplication = false
): Promise<{ client_id: string; recommandations: Recommandation[] }> {
  return fetchJson<{ client_id: string; recommandations: Recommandation[] }>(
    `${API_URL}/recommandations/${clientId}?avec_explication=${avecExplication}`,
    "Recommandations indisponibles",
    { cache: "no-store" }
  );
}

export async function poserQuestionChat(clientId: string, question: string): Promise<string> {
  try {
    const data = await fetchJson<{ reponse: string }>(`${API_URL}/chat`, "Erreur du chatbot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, question }),
    });
    return data.reponse;
  } catch (error) {
    if ((error as { status?: number }).status === 503) {
      return "Le chatbot n'est pas configuré (clé API manquante côté serveur).";
    }
    throw error;
  }
}
