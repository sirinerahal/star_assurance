# -*- coding: utf-8 -*-
"""
API FastAPI - Plateforme IA de recommandation de produits d'assurance.

Endpoints principaux :
  GET  /                              -> vérifier que l'API tourne
  GET  /clients/{client_id}           -> profil d'un client
  GET  /recommandations/{client_id}   -> top produits recommandés + scores + explication IA
  POST /chat                          -> chatbot conversationnel avec RAG
"""
import json
import logging
import os
import pickle
import tempfile
import time
import uuid
from datetime import date, datetime

import joblib
import numpy as np
import pandas as pd
import faiss
from pymongo import MongoClient
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv
from openai import OpenAI
load_dotenv()
try:
    from groq import Groq
except ImportError:
    Groq = None

# NOTE DE MAINTENANCE : cette date est volontairement figée, pas un oubli.
# Elle doit rester cohérente avec le dataset synthétique actuel, dont les profils
# clients (âge, profession, revenu, ancienneté) ont été générés à un instant
# donné et sont cohérents entre eux. Lorsque les données réelles fournies par
# l'encadrant arriveront, il faudra revoir ce point et probablement passer à
# une version dynamique (date.today()) avec de vraies dates de naissance.
TODAY = date(2026, 7, 8)

# ---------------------------------------------------------------------------
# Chargement des données et modèles au démarrage de l'API
# ---------------------------------------------------------------------------
# Autorise le frontend (React/Next.js) à appeler cette API depuis le navigateur
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY")
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
FRONTEND_ORIGINS = list(
    dict.fromkeys(
        [
            FRONTEND_URL,
            *[f"http://localhost:{port}" for port in range(3000, 3004)],
            *[f"http://127.0.0.1:{port}" for port in range(3000, 3004)],
        ]
    )
)


def verifier_cle_api(cle: str = Depends(api_key_header)):
    if not INTERNAL_API_KEY:
        raise HTTPException(status_code=500, detail="INTERNAL_API_KEY non configurée côté serveur")
    if cle != INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Clé API invalide ou manquante")


app = FastAPI(title="API Recommandation Assurance IA", version="1.0", dependencies=[Depends(verifier_cle_api)])

app.add_middleware(
    CORSMiddleware,
    # URL configurable via FRONTEND_URL pour le déploiement en production sans modifier le code
    allow_origins=FRONTEND_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def gerer_exception_globale(request: Request, exc: Exception):
    logging.exception("Erreur non gérée pour %s", request.url, exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={"erreur": "Une erreur interne est survenue. Veuillez réessayer."},
    )

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
MODEL_DIR = os.path.join(BASE_DIR, "model")

print("Chargement des données...")
df_client = pd.read_csv(os.path.join(DATA_DIR, "01_client_reel.csv"))
# Le fichier source contient parfois plusieurs lignes identiques pour un même
# client. L'identifiant étant la clé métier, conserver une seule fiche évite
# les doublons dans la recherche et les calculs de recommandation.
df_client = df_client.drop_duplicates(subset=["client_id"], keep="first").reset_index(drop=True)
# Les contrats sont fictifs, car aucun historique de contrats n'est fourni
# dans les nouvelles données clients.
df_contrat = pd.read_csv(
    os.path.join(DATA_DIR, "02_contrat_fictif.csv"),
    dtype={"client_id": str, "produit_code": str},
)
def charger_catalogue_produits() -> pd.DataFrame:
    catalogue = pd.read_csv(os.path.join(DATA_DIR, "03_produit_reel.csv"), dtype={"produit_code": str})
    officiels_non_vie = pd.read_csv(
        os.path.join(DATA_DIR, "produits_non_vie_officiels.csv"),
        dtype={"produit_code": str},
    )
    packs_reels = charger_packs_reels()
    codes_non_vie = set(officiels_non_vie["produit_code"])
    catalogue["type_branche"] = "Vie"
    catalogue = catalogue[~catalogue["produit_code"].isin(codes_non_vie)].copy()
    catalogue["produit_id"] = catalogue["produit_code"]
    catalogue["code_produit"] = catalogue["produit_code"]

    codes_reels = (
        packs_reels[["produit_id", "code_produit"]]
        .drop_duplicates("produit_id")
        .rename(columns={"produit_id": "produit_code"})
    )
    lignes_non_vie = officiels_non_vie.assign(
        branche="Non-Vie",
        categorie="Catalogue officiel",
        description=officiels_non_vie["produit_nom"],
        niveau_couverture="Standard",
        est_complementaire=False,
        produit_parent="",
        canal_distribution="Agence",
        actif=True,
        date_creation="2026-09-14",
        type_branche="Non-Vie",
    )
    lignes_non_vie = lignes_non_vie.merge(codes_reels, on="produit_code", how="left")
    lignes_non_vie["produit_id"] = lignes_non_vie["produit_code"]
    return pd.concat([catalogue, lignes_non_vie], ignore_index=True, sort=False)


def charger_packs_reels() -> pd.DataFrame:
    source = pd.read_excel(os.path.join(DATA_DIR, "PACK_PRODUIT.xls"))
    packs = source.rename(
        columns={
            "ID_PACK": "pack_id",
            "VALEUR": "valeur",
            "DESCRIPTION_PACK": "pack_nom",
            "ID_PRODUIT": "produit_id",
            "CODE_PRODUIT": "code_produit",
        }
    )[
        ["pack_id", "valeur", "pack_nom", "produit_id", "code_produit", "PRODUIT"]
    ].rename(columns={"PRODUIT": "produit_nom"})
    for colonne in ("pack_id", "valeur", "produit_id", "code_produit"):
        packs[colonne] = pd.to_numeric(packs[colonne], errors="coerce")
    packs = packs.dropna(subset=["pack_id", "produit_id", "code_produit"])
    packs["pack_id"] = packs["pack_id"].astype(int).astype(str)
    packs["produit_id"] = packs["produit_id"].astype(int).astype(str)
    packs["code_produit"] = packs["code_produit"].astype(int).astype(str)
    packs["valeur"] = packs["valeur"].astype(int)
    packs["pack_code"] = packs["pack_id"]
    return packs.drop_duplicates(
        subset=["pack_id", "valeur", "produit_id", "code_produit"]
    ).reset_index(drop=True)


df_produit = charger_catalogue_produits()
df_packs = charger_packs_reels()
df_produit["actif"] = df_produit["actif"].astype(str).str.lower().isin(("true", "1", "yes", "oui"))
df_garantie = pd.read_csv(os.path.join(DATA_DIR, "04_garantie.csv"))
df_evenement = pd.DataFrame(columns=["client_id", "type_evenement", "date_evenement", "description"])
chemin_interactions = os.path.join(DATA_DIR, "09_interaction_client.csv")
df_interaction = (
    pd.read_csv(chemin_interactions)
    if os.path.exists(chemin_interactions)
    else pd.DataFrame(columns=["score_satisfaction"])
)
df_recommandation_historique = pd.DataFrame(
    columns=["client_id", "produit_code", "date_recommandation", "statut", "score"]
)

df_client["age"] = TODAY.year - pd.to_datetime(df_client["date_naissance"]).dt.year
nb_contrats = df_contrat.groupby("client_id").size().rename("nb_contrats_existants")
df_client = df_client.merge(nb_contrats, on="client_id", how="left")
df_client["nb_contrats_existants"] = df_client["nb_contrats_existants"].fillna(0).astype(int)

nb_sinistres_col = (
    df_contrat.groupby("client_id").size().rename("nb_sinistres_total") * 0
)  # valeur par défaut à 0 si pas de table sinistre fournie ici
df_client["nb_sinistres_total"] = df_client["client_id"].map(nb_sinistres_col).fillna(0).astype(int)

souscriptions = df_contrat.groupby("client_id")["produit_code"].apply(set).to_dict()
NOMS_PRODUITS_REELS = df_produit.set_index("produit_code")["produit_nom"].to_dict()


def produits_actifs() -> pd.DataFrame:
    return df_produit[df_produit["actif"]].copy()


def verifier_produits_actifs(codes: list[str]) -> None:
    codes_actifs = set(produits_actifs()["produit_code"])
    if produit_inactif := next((code for code in codes if code not in codes_actifs), None):
        raise HTTPException(status_code=409, detail=f"Le produit {produit_inactif} est inactif ou inconnu")


def recharger_catalogue_produits() -> None:
    global df_produit, NOMS_PRODUITS_REELS, _score_moyen_recommandations_cache
    df_produit = charger_catalogue_produits()
    df_produit["actif"] = df_produit["actif"].astype(str).str.lower().isin(("true", "1", "yes", "oui"))
    NOMS_PRODUITS_REELS = df_produit.set_index("produit_code")["produit_nom"].to_dict()
    _cache_scores_par_produit.clear()
    _score_moyen_recommandations_cache = None


def sauvegarder_catalogue_produits() -> None:
    chemin_catalogue = os.path.join(DATA_DIR, "03_produit_reel.csv")
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", newline="", delete=False, dir=DATA_DIR) as fichier_temporaire:
        chemin_temporaire = fichier_temporaire.name
        df_produit.to_csv(fichier_temporaire, index=False)
    os.replace(chemin_temporaire, chemin_catalogue)

print("Chargement du modèle de scoring...")
model_rf = joblib.load(os.path.join(MODEL_DIR, "modele_recommandation_final_v2.pkl"))
colonnes_modele = joblib.load(os.path.join(MODEL_DIR, "colonnes_modele_v2.pkl"))
colonnes_categorielles = joblib.load(os.path.join(MODEL_DIR, "colonnes_categorielles_v2.pkl"))
model_pack_prototype = joblib.load(os.path.join(MODEL_DIR, "modele_pack_prototype_fictif.pkl"))
colonnes_modele_pack = joblib.load(os.path.join(MODEL_DIR, "colonnes_modele_pack_prototype.pkl"))

# Le modèle d'embeddings (RAG) est chargé à la demande (1er appel à /chat),
# pas au démarrage : ça permet à l'API de démarrer même sans connexion
# internet immédiate, et accélère le démarrage pour les tests hors-RAG.
modele_embeddings = None
index_faiss = None
documents = None


def _charger_rag_si_necessaire():
    global modele_embeddings, index_faiss, documents
    if modele_embeddings is not None:
        return
    print("Chargement / construction de l'index RAG (peut prendre 30s la 1ère fois)...")
    modele_embeddings = SentenceTransformer("all-MiniLM-L6-v2")

    index_path = os.path.join(MODEL_DIR, "index_garanties.faiss")
    documents_path = os.path.join(MODEL_DIR, "documents_garanties.pkl")

    if os.path.exists(index_path) and os.path.exists(documents_path):
        index_faiss = faiss.read_index(index_path)
        with open(documents_path, "rb") as f:
            documents = pickle.load(f)
    else:
        df_garantie_enrichi = df_garantie.merge(
            df_produit[["produit_code", "produit_nom"]], on="produit_code", how="left"
        )
        docs = []
        for _, g in df_garantie_enrichi.iterrows():
            texte = (
                f"{g['produit_nom']} — Garantie '{g['garantie_nom']}' : {g['description']}. "
                f"Capital couvert : {g['capital_couvert']} €. Franchise : {g['franchise']} €. "
                f"Garantie {'obligatoire' if g['obligatoire'] else 'optionnelle'}."
            )
            docs.append(texte)
        embeddings = modele_embeddings.encode(docs)
        idx = faiss.IndexFlatL2(embeddings.shape[1])
        idx.add(np.array(embeddings).astype("float32"))
        faiss.write_index(idx, index_path)
        with open(documents_path, "wb") as f:
            pickle.dump(docs, f)
        index_faiss = idx
        documents = docs


@app.on_event("startup")
def precharger_chatbot():
    _charger_rag_si_necessaire()


print("API prête !")

# Client Groq (LLM) : nécessite la variable d'environnement GROQ_API_KEY
groq_api_key = os.environ.get("GROQ_API_KEY")
client_groq = Groq(api_key=groq_api_key) if (Groq and groq_api_key) else None
client_ollama = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")

# Modèle Groq utilisé pour toutes les générations (explications, SMS, email, chatbot).
# llama-3.3-70b-versatile a été déprécié par Groq en juin 2026 ; remplacé par le
# modèle recommandé par Groq pour cette migration. Un seul endroit à modifier si
# ce modèle est déprécié à son tour.
GROQ_MODEL = "openai/gpt-oss-120b"
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:7b")


# ---------------------------------------------------------------------------
# Fonctions métier (reprises et adaptées de votre travail sur Colab)
# ---------------------------------------------------------------------------
def trouver_packs(produit_code: str) -> list[dict[str, str | int]]:
    produit = df_produit[df_produit["produit_code"].astype(str) == str(produit_code)]
    if produit.empty:
        return []

    produit = produit.iloc[0]
    if pd.isna(produit.get("produit_id")) or pd.isna(produit.get("code_produit")):
        return []

    packs_produit = df_packs[
        (df_packs["produit_id"].astype(str) == str(produit["produit_id"]))
        & (df_packs["code_produit"].astype(str) == str(produit["code_produit"]))
    ]
    return [
        {
            "pack_code": str(pack["pack_code"]),
            "pack_nom": str(pack["pack_nom"]),
            "valeur": int(pack["valeur"]),
            "produit_id": str(pack["produit_id"]),
            "code_produit": str(pack["code_produit"]),
        }
        for _, pack in packs_produit.iterrows()
    ]


def construire_lignes_pack(client: pd.Series, packs_disponibles: list[dict[str, str | int]]) -> pd.DataFrame:
    lignes = []
    for pack in packs_disponibles:
        lignes.append({
            "age": client["age"], "sexe": client["sexe"],
            "situation_familiale": client["situation_familiale"], "nb_enfants": client["nb_enfants"],
            "profession": client["profession"], "revenu_annuel": client["revenu_annuel"],
            "nb_contrats_existants": client["nb_contrats_existants"], "nb_sinistres_total": client["nb_sinistres_total"],
            "produit_id": pack["produit_id"], "code_produit": pack["code_produit"],
            "pack_id": pack["pack_code"], "valeur": pack["valeur"], "pack_nom": pack["pack_nom"],
        })
    candidats = pd.DataFrame(lignes)
    for colonne in ("sexe", "situation_familiale", "profession", "produit_id", "code_produit", "pack_id", "pack_nom"):
        candidats[colonne] = candidats[colonne].fillna("Inconnu").astype(str)
    return candidats


def recommander_pack_prototype(
    client_id: str, packs_disponibles: list[dict[str, str | int]]
) -> dict[str, str | int | float] | None:
    if not packs_disponibles:
        return None
    client = df_client[df_client["client_id"] == client_id]
    if client.empty:
        return None
    client = client.iloc[0]
    candidats = construire_lignes_pack(client, packs_disponibles)
    probabilites = model_pack_prototype.predict_proba(candidats[colonnes_modele_pack])[:, 1]
    index = int(np.argmax(probabilites))
    resultat = dict(packs_disponibles[index])
    resultat["score_pack"] = round(float(probabilites[index]) * 100, 1)
    resultat["source_donnee"] = "fictive_prototype"
    return resultat


def construire_explication_pack(client: pd.Series, packs_disponibles: list[dict[str, str | int]], pack_recommande: dict[str, str | int] | None) -> str:
    if not packs_disponibles:
        return "Aucun pack réel n'est associé à ce produit dans la source PACK_PRODUIT."
    if pack_recommande is None:
        return "Aucun pack n'a pu être sélectionné parmi les packs associés à ce produit."
    candidats = construire_lignes_pack(client, packs_disponibles)
    probabilites = model_pack_prototype.predict_proba(candidats[colonnes_modele_pack])[:, 1]
    classement = sorted(zip(packs_disponibles, probabilites), key=lambda item: float(item[1]), reverse=True)
    rang = next(i for i, (pack, _) in enumerate(classement, start=1) if pack["pack_code"] == pack_recommande["pack_code"] and pack["valeur"] == pack_recommande["valeur"])
    identite_recommandee = (pack_recommande["pack_code"], pack_recommande["valeur"])
    alternative = next(
        (
            pack
            for pack, _ in classement
            if (pack["pack_code"], pack["valeur"]) != identite_recommandee
        ),
        None,
    )
    enfants = client["nb_enfants"]
    revenu = client["revenu_annuel"]
    age = client["age"]
    contrats = client["nb_contrats_existants"]
    besoin_protection = (0 if pd.isna(enfants) else enfants * 1.8) + (0 if pd.isna(contrats) else contrats * 0.5) + (1.5 if age >= 55 else 0)
    capacite = min((0 if pd.isna(revenu) else revenu) / 20000, 4)
    cible_niveau = 1 + besoin_protection * 0.45 + capacite * 0.35
    score_recommande = next(
        float(score)
        for pack, score in classement
        if (pack["pack_code"], pack["valeur"]) == identite_recommandee
    )
    score_alternative = next(
        (
            float(score)
            for pack, score in classement
            if alternative
            and (pack["pack_code"], pack["valeur"]) == (alternative["pack_code"], alternative["valeur"])
        ),
        None,
    )
    comparaison = (
        f"Le meilleur concurrent est {alternative['pack_nom']} ({score_alternative * 100:.1f}% contre "
        f"{score_recommande * 100:.1f}% pour le pack retenu)."
        if alternative and score_alternative is not None
        else "Aucun autre pack concurrent n'est disponible."
    )
    return (
        f"Le pack {pack_recommande['pack_nom']} est retenu parmi {len(packs_disponibles)} packs du produit "
        f"car le modèle de pack compare chaque pack au profil réel du client "
        f"(âge {age} ans, revenu annuel {revenu} TND, situation familiale {client['situation_familiale'] or 'non renseignée'}, "
        f"{enfants if pd.notna(enfants) else 0} enfant(s), {contrats if pd.notna(contrats) else 0} contrat(s)). "
        f"La règle de génération du prototype combine le besoin de protection lié à l'âge, aux enfants et aux contrats "
        f"avec la capacité liée au revenu; ces critères ont servi à produire la cible synthétique du prototype (niveau de référence {cible_niveau:.1f}). "
        f"{comparaison} "
        f"Cette sélection est produite par CatBoost, mais sa cible d'entraînement reste synthétique: ce n'est pas un historique réel de choix clients."
    )


def construire_explication_produit(client_row: pd.Series, produit_nom: str, score: float, raison_regle: str | None) -> str:
    profil = (
        f"âge {client_row['age']} ans, revenu annuel {client_row['revenu_annuel']} TND, "
        f"situation familiale {client_row['situation_familiale']}"
    )
    if raison_regle:
        return f"{produit_nom} est priorisé pour ce client ({profil}) ; la règle métier appliquée est : {raison_regle}."
    return f"{produit_nom} est priorisé par le modèle pour ce client ({profil}), avec une probabilité interne de {score}% parmi les produits candidats."


def construire_features_client(client_id: str) -> pd.DataFrame | None:
    if client_id not in df_client["client_id"].values:
        return None
    client_row = df_client[df_client["client_id"] == client_id].iloc[0]
    deja_souscrits = souscriptions.get(client_id, set())

    lignes = []
    for produit_code in produits_actifs()["produit_code"]:
        lignes.append({
            "age": client_row["age"],
            "sexe": client_row["sexe"],
            "situation_familiale": client_row["situation_familiale"],
            "nb_enfants": client_row["nb_enfants"],
            "profession": client_row["profession"],
            "revenu_annuel": client_row["revenu_annuel"],
            "nb_contrats_existants": client_row["nb_contrats_existants"],
            "nb_sinistres_total": client_row["nb_sinistres_total"],
            "produit_code": produit_code,
            "deja_souscrit": produit_code in deja_souscrits,
        })
    df_lignes = pd.DataFrame(lignes)
    for colonne in ("sexe", "situation_familiale", "profession", "produit_code"):
        df_lignes[colonne] = df_lignes[colonne].fillna("Inconnu").astype(str)
    # CatBoost lit directement les catégories brutes (texte) -- pas de
    # one-hot encoding nécessaire, juste garder les colonnes dans le même
    # ordre qu'à l'entraînement.
    df_features = df_lignes[colonnes_modele].copy()
    df_features["_produit_code"] = df_lignes["produit_code"]
    df_features["_deja_souscrit"] = df_lignes["deja_souscrit"]
    return df_features


def regles_metier_valeurs(age, profession: str, revenu, produit_code: str) -> float:
    """
    Version 'légère' des règles métier : prend des valeurs brutes (pas une
    ligne pandas) pour rester rapide même appliquée des dizaines de milliers
    de fois (utilisée par le calcul global des campagnes). Ne retourne que le
    multiplicateur, sans le texte de justification.
    """
    nom_produit = str(NOMS_PRODUITS_REELS.get(produit_code, produit_code)).lower()

    if "jeunesse" in nom_produit and age >= 45:
        return 0.4
    if any(mot in nom_produit for mot in ("retraite", "idr", "longue vie")) and age < 35:
        return 0.4
    if "emprunteur" in nom_produit and age >= 75:
        return 0.5
    if "epargne" in nom_produit and revenu < 12000:
        return 0.6

    if produit_code in ("AUTO_TOUS_RISQUES", "AUTO_TIER", "CONDUCTEUR", "BRIS_DE_GLACE"):
        if profession in ("Sans emploi", "Retraité", "Étudiant") and revenu < 15000:
            return 0.25
        if age >= 75:
            return 0.5

    if produit_code in ("VIE", "PREVOYANCE") and age < 25:
        return 0.4

    if produit_code == "PREVOYANCE" and age < 45:
        return 0.5

    if produit_code == "ASSISTANCE_PREMIUM" and revenu < 18000:
        return 0.4

    if produit_code == "SANTE" and age >= 55:
        return 1.15

    return 1.0


def regles_metier(client_row: pd.Series, produit_code: str) -> tuple[float, str | None]:
    """
    Couche de bon sens métier appliquée EN PLUS du score du modèle ML, avec
    la raison textuelle associée (utilisée pour l'explication donnée au
    conseiller sur la fiche client -- pas pour le calcul global des
    campagnes, qui utilise regles_metier_valeurs ci-dessus pour rester rapide).
    """
    age = client_row["age"]
    profession = client_row["profession"]
    revenu = client_row["revenu_annuel"]
    nom_produit = str(NOMS_PRODUITS_REELS.get(produit_code, produit_code)).lower()

    if "jeunesse" in nom_produit and age >= 45:
        return 0.4, "produit jeunesse moins adapté à un âge avancé"
    if any(mot in nom_produit for mot in ("retraite", "idr", "longue vie")) and age < 35:
        return 0.4, "produit retraite moins prioritaire pour un jeune client"
    if "emprunteur" in nom_produit and age >= 75:
        return 0.5, "âge avancé, besoin d'emprunt généralement moins probable"
    if "epargne" in nom_produit and revenu < 12000:
        return 0.6, "revenu estimé limitant la capacité d'épargne"

    if produit_code in ("AUTO_TOUS_RISQUES", "AUTO_TIER", "CONDUCTEUR", "BRIS_DE_GLACE"):
        if profession in ("Sans emploi", "Retraité", "Étudiant") and revenu < 15000:
            return 0.25, (
                f"profil {profession.lower()} à faible revenu ({revenu} TND/an), "
                "peu compatible avec une assurance automobile"
            )
        if age >= 75:
            return 0.5, "âge avancé, probabilité réduite de conduire régulièrement"

    if produit_code in ("VIE", "PREVOYANCE"):
        if age < 25:
            return 0.4, "jeune âge, besoin de prévoyance long terme généralement plus tardif"

    if produit_code == "PREVOYANCE" and age < 45:
        return 0.5, "produit généralement plus pertinent à partir de la cinquantaine"

    if produit_code == "ASSISTANCE_PREMIUM" and revenu < 18000:
        return 0.4, "produit premium peu adapté à ce niveau de revenu"

    if produit_code == "SANTE" and age >= 55:
        return 1.15, "âge associé à un besoin de couverture santé accru"

    return 1.0, None


def recommander_produits(client_id: str, top_n: int = 3):
    features = construire_features_client(client_id)
    if features is None:
        return None

    candidats = features[~features["_deja_souscrit"]]
    if candidats.empty:
        return []

    client_row = df_client[df_client["client_id"] == client_id].iloc[0]

    X_candidats = candidats[colonnes_modele]
    scores_ml = model_rf.predict_proba(X_candidats)[:, 1]

    resultats = []
    for produit, score_ml in zip(candidats["_produit_code"], scores_ml):
        multiplicateur, raison_regle = regles_metier(client_row, produit)
        score_final = min(float(score_ml) * multiplicateur, 0.99)
        resultats.append({
            "produit": produit,
            "produit_nom": str(NOMS_PRODUITS_REELS.get(produit, produit)),
            "score": round(score_final * 100, 1),
            "raison_regle": raison_regle,
        })
    resultats.sort(key=lambda x: x["score"], reverse=True)
    resultats = resultats[:top_n]
    for resultat in resultats:
        resultat["explication_produit"] = construire_explication_produit(
            client_row, resultat["produit_nom"], resultat["score"], resultat["raison_regle"]
        )
        resultat["packs_disponibles"] = trouver_packs(resultat["produit"])
        resultat["pack_recommande"] = recommander_pack_prototype(client_id, resultat["packs_disponibles"])
        resultat["explication_pack"] = construire_explication_pack(
            client_row, resultat["packs_disponibles"], resultat["pack_recommande"]
        )
    return resultats


def rechercher_documents(question: str, top_k: int = 5):
    _charger_rag_si_necessaire()
    question_vecteur = modele_embeddings.encode([question])
    _, indices = index_faiss.search(np.array(question_vecteur).astype("float32"), top_k)
    return [documents[i] for i in indices[0]]


def construire_contexte_client(client_id: str) -> str:
    client_row = df_client[df_client["client_id"] == client_id].iloc[0]
    annee_client_depuis = str(client_row["date_creation"])[:4]
    recos = recommander_produits(client_id, top_n=3)
    reco_texte = "\n".join([f"- {r['produit']} (score interne: {r['score']}%)" for r in recos]) if recos else "Aucune."
    return f"""Tu es un assistant IA pour des conseillers en assurance. Voici le profil du client :
- Âge : {client_row['age']} ans
- Profession : {client_row['profession']}
- Situation familiale : {client_row['situation_familiale']}
- Client depuis : {annee_client_depuis}
- Nombre d'enfants : {client_row['nb_enfants']}
- Revenu annuel : {client_row['revenu_annuel']} TND
- Contrats déjà souscrits : {client_row['nb_contrats_existants']}
- Nombre de sinistres déclarés : {client_row['nb_sinistres_total']}

Produits recommandés par le modèle IA :
{reco_texte}

Réponds en français, de façon professionnelle et concise.

RÈGLE ABSOLUE : le score (%) ci-dessus est une information INTERNE réservée au
conseiller. Tu peux t'en servir pour raisonner et prioriser, mais tu ne dois
JAMAIS écrire de score, de pourcentage, ni le mot "score" dans un texte
destiné à être envoyé au client (email, message, argumentaire). Ces contenus
doivent se limiter aux produits et à leurs bénéfices concrets."""


def generer_explication(client_id: str, produit_nom: str, score: float, raison_regle: str | None = None) -> str:
    if client_ollama is None:
        return "Explication indisponible (clé API LLM non configurée)."
    client_row = df_client[df_client["client_id"] == client_id].iloc[0]
    deja_souscrits = souscriptions.get(client_id, set())
    produits_deja_souscrits = ", ".join(deja_souscrits) if deja_souscrits else "aucun"
    annee_client_depuis = str(client_row["date_creation"])[:4]

    indice_regle = (
        f"\nÉlément déclencheur identifié par la règle métier : {raison_regle}." if raison_regle else ""
    )

    prompt = f"""Profil complet du client :
- Âge : {client_row['age']} ans
- Profession : {client_row['profession']}
- Situation familiale : {client_row['situation_familiale']}
- Nombre d'enfants : {client_row['nb_enfants']}
- Revenu annuel : {client_row['revenu_annuel']} TND
- Client depuis : {annee_client_depuis}
- Produits déjà détenus : {produits_deja_souscrits}
- Nombre de sinistres déclarés : {client_row['nb_sinistres_total']}

Produit recommandé : {produit_nom}{indice_regle}

Rédige une explication précise et concrète (2 à 3 phrases) à destination d'un
CONSEILLER (pas du client final), qui doit comprendre exactement pourquoi ce
produit est pertinent pour CE client précis. Appuie-toi explicitement sur au
moins 2 éléments réels du profil ci-dessus (âge, profession, situation
familiale, produits déjà détenus, ancienneté...), pas de formule générique.
Ne mentionne ni le mot "score" ni de pourcentage."""

    reponse = client_ollama.chat.completions.create(
        model=OLLAMA_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
    )
    return reponse.choices[0].message.content


# ---------------------------------------------------------------------------
# Campagnes massives : calcul des scores IA POUR UN PRODUIT DONNÉ (pas un
# score générique "meilleure opportunité toutes recommandations confondues").
# C'est le produit choisi à l'étape 1 qui détermine le score utilisé partout
# à l'étape 2. Mis en cache par produit, calculé au premier appel seulement.
# ---------------------------------------------------------------------------
_cache_scores_par_produit: dict[str, pd.DataFrame] = {}
_score_moyen_recommandations_cache: float | None = None

PRODUITS_AUTO = {"AUTO_TOUS_RISQUES", "AUTO_TIER"}
PRODUITS_HABITATION = {"HABITATION"}


def calculer_score_moyen_recommandations() -> float:
    """Calcule la moyenne des trois meilleurs scores actuels par client."""
    global _score_moyen_recommandations_cache
    if _score_moyen_recommandations_cache is not None:
        return _score_moyen_recommandations_cache

    produits = produits_actifs()["produit_code"].tolist()
    lignes = []
    for _, client in df_client.iterrows():
        produits_deja_detenu = souscriptions.get(client["client_id"], set())
        for produit_code in produits:
            if produit_code in produits_deja_detenu:
                continue
            lignes.append({
                "client_id": client["client_id"],
                "age": client["age"],
                "sexe": client["sexe"],
                "situation_familiale": client["situation_familiale"],
                "nb_enfants": client["nb_enfants"],
                "profession": client["profession"],
                "revenu_annuel": client["revenu_annuel"],
                "nb_contrats_existants": client["nb_contrats_existants"],
                "nb_sinistres_total": client["nb_sinistres_total"],
                "produit_code": produit_code,
            })

    if not lignes:
        return 0.0

    candidats = pd.DataFrame(lignes)
    for colonne in ("sexe", "situation_familiale", "profession", "produit_code"):
        candidats[colonne] = candidats[colonne].fillna("Inconnu").astype(str)
    scores_ml = model_rf.predict_proba(candidats[colonnes_modele])[:, 1]
    multiplicateurs = np.array([
        regles_metier_valeurs(age, profession, revenu, produit_code)
        for age, profession, revenu, produit_code in zip(
            candidats["age"], candidats["profession"], candidats["revenu_annuel"], candidats["produit_code"]
        )
    ])
    candidats["score"] = np.minimum(scores_ml * multiplicateurs, 0.99) * 100
    meilleurs_scores = candidats.groupby("client_id")["score"].nlargest(3)
    _score_moyen_recommandations_cache = round(float(meilleurs_scores.mean()), 1) if not meilleurs_scores.empty else 0.0
    return _score_moyen_recommandations_cache

def calculer_scores_produit(produit_code: str) -> pd.DataFrame:
    """
    Calcule le score de CE produit précis pour tous les clients qui ne le
    possèdent pas encore. Un client qui a déjà ce produit est exclu (on ne
    peut pas lui proposer ce qu'il a déjà).
    """
    verifier_produits_actifs([produit_code])
    if produit_code in _cache_scores_par_produit:
        return _cache_scores_par_produit[produit_code]

    if produit_code not in set(df_produit["produit_code"]):
        raise HTTPException(status_code=404, detail="Produit inconnu")

    clients_eligibles = df_client[
        ~df_client["client_id"].isin(
            [cid for cid, produits in souscriptions.items() if produit_code in produits]
        )
    ].copy()

    # CatBoost lit directement les catégories brutes -- on ajoute juste la
    # colonne produit_code (identique pour toutes les lignes ici) et on
    # remet les colonnes dans le même ordre qu'à l'entraînement.
    X_predire = clients_eligibles.assign(produit_code=produit_code)[colonnes_modele].copy()
    for colonne in ("sexe", "situation_familiale", "profession", "produit_code"):
        X_predire[colonne] = X_predire[colonne].fillna("Inconnu").astype(str)
    scores_ml = model_rf.predict_proba(X_predire)[:, 1]

    multiplicateurs = np.array([
        regles_metier_valeurs(age, profession, revenu, produit_code)
        for age, profession, revenu in zip(
            clients_eligibles["age"], clients_eligibles["profession"], clients_eligibles["revenu_annuel"]
        )
    ])
    clients_eligibles["score"] = np.minimum(scores_ml * multiplicateurs, 0.99) * 100

    _cache_scores_par_produit[produit_code] = clients_eligibles
    return clients_eligibles


def obtenir_segments_clients() -> dict:
    """Retourne, pour chaque segment, l'ensemble des client_id qui en font partie."""
    contrats_par_client_produits = df_contrat.groupby("client_id")["produit_code"].apply(set)

    clients_auto = set(
        cid for cid, produits in contrats_par_client_produits.items() if produits & PRODUITS_AUTO
    )
    clients_habitation = set(
        cid for cid, produits in contrats_par_client_produits.items() if produits & PRODUITS_HABITATION
    )
    clients_sans_contrat = set(df_client[df_client["nb_contrats_existants"] == 0]["client_id"])
    clients_jeunes = set(df_client[df_client["age"] < 30]["client_id"])
    tous = set(df_client["client_id"])
    clients_autres = tous - clients_auto - clients_habitation - clients_sans_contrat - clients_jeunes

    return {
        "auto_existants": ("Clients Auto existants", clients_auto),
        "habitation_existants": ("Clients Multirisque Habitation", clients_habitation),
        "prospects_sans_contrat": ("Prospects sans contrat", clients_sans_contrat),
        "jeunes_clients": ("Jeunes clients (moins de 30 ans)", clients_jeunes),
        "autres_clients": ("Autres clients", clients_autres),
    }


TIERS_SCORE = {
    "tres_eleve": ("Très élevé", 80, 100),
    "eleve": ("Élevé", 60, 79.999),
    "moyen": ("Moyen", 40, 59.999),
    "faible": ("Faible", 0, 39.999),
}


def stats_audience(df_cible: pd.DataFrame) -> dict:
    """Calcule les statistiques d'audience (taille, score moyen, taux de
    réponse estimé, messages à envoyer) pour un sous-ensemble de clients."""
    nb_clients = len(df_cible)
    score_moyen = round(float(df_cible["score"].mean()), 1) if nb_clients else 0.0
    # Estimation simplifiée du taux de réponse : proportionnelle au score IA
    # moyen (pas un modèle entraîné séparément, juste une heuristique de
    # calibration à affiner avec de vraies données de campagnes plus tard).
    taux_reponse_estime = round(min(score_moyen * 0.19, 45.0), 1) if nb_clients else 0.0
    return {
        "nb_clients": nb_clients,
        "score_moyen": score_moyen,
        "taux_reponse_estime": taux_reponse_estime,
        "messages_email": nb_clients,
        "messages_sms": nb_clients,
    }


# ---------------------------------------------------------------------------
# Schémas des requêtes (validation automatique par FastAPI)
# ---------------------------------------------------------------------------
class ChatRequest(BaseModel):
    client_id: str
    question: str


class ProduitStatutRequest(BaseModel):
    actif: bool


class ProduitCritere(BaseModel):
    code: str
    score_min: float = 0
    score_max: float = 100


class AudienceMultiRequest(BaseModel):
    produits: list[ProduitCritere]
    type: str = "tous"  # "tous" ou "segment"
    segment: str = ""


class GenerationMessageRequest(BaseModel):
    produits: list[str]  # codes produits
    objectif: str
    canal: str  # "email" ou "sms"


class LancementCampagneRequest(BaseModel):
    nom: str
    nb_destinataires: int
    canaux: str
    objectif: str = ""
    produits: list[str] = []
    date_debut: str = ""
    date_fin: str = ""
    frequence: str = ""
    fuseau: str = ""
    heure: str = ""
    desabonnement: bool = True
    description: str = ""


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/produits")
def lister_produits(inclure_inactifs: bool = True):
    catalogue = df_produit if inclure_inactifs else produits_actifs()
    return {"produits": catalogue.fillna("").to_dict(orient="records")}


@app.get("/produits/relation-packs")
def lister_relation_produits_packs():
    produits = []
    cles_catalogue = set(
        zip(df_produit["produit_id"].astype(str), df_produit["code_produit"].astype(str))
    )
    for _, produit in df_produit.iterrows():
        packs = trouver_packs(str(produit["produit_code"]))
        produits.append({
            "produit_code": str(produit["produit_code"]),
            "produit_nom": str(produit["produit_nom"]),
            "produit_id": str(produit.get("produit_id", "")),
            "code_produit": str(produit.get("code_produit", "")),
            "type_branche": str(produit.get("type_branche", "")),
            "actif": bool(produit["actif"]),
            "packs": packs,
        })
    cles_packs = list(zip(df_packs["produit_id"].astype(str), df_packs["code_produit"].astype(str)))
    packs_orphelins = df_packs[[cle not in cles_catalogue for cle in cles_packs]]
    produits_sans_pack = [p["produit_code"] for p in produits if not p["packs"]]
    return {
        "produits": produits,
        "packs_orphelins": packs_orphelins.to_dict(orient="records"),
        "source": "PACK_PRODUIT.xls",
        "cle_composite": ["produit_id", "code_produit"],
        "produits_sans_pack": produits_sans_pack,
        "controle": {
            "nb_produits": len(produits),
            "nb_produits_avec_pack": len(produits) - len(produits_sans_pack),
            "nb_produits_sans_pack": len(produits_sans_pack),
            "nb_packs": len(df_packs),
            "nb_packs_orphelins": len(packs_orphelins),
        },
    }


@app.get("/produits/{produit_code}")
def get_produit(produit_code: str):
    produit = df_produit[df_produit["produit_code"] == produit_code]
    if produit.empty:
        raise HTTPException(status_code=404, detail="Produit inconnu")
    return produit.iloc[0].fillna("").to_dict()


@app.patch("/produits/{produit_code}")
def modifier_statut_produit(produit_code: str, requete: ProduitStatutRequest):
    global df_produit
    index = df_produit.index[df_produit["produit_code"] == produit_code]
    if len(index) == 0:
        raise HTTPException(status_code=404, detail="Produit inconnu")
    if df_produit.loc[index[0], "type_branche"] == "Non-Vie" and not requete.actif:
        raise HTTPException(status_code=409, detail="Les produits Non-Vie officiels doivent rester actifs")
    df_produit.loc[index[0], "actif"] = requete.actif
    sauvegarder_catalogue_produits()
    recharger_catalogue_produits()
    return get_produit(produit_code)


@app.get("/dashboard/stats")
def get_dashboard_stats():
    nb_clients = len(df_client)
    nb_contrats = len(df_contrat)
    nb_produits = len(produits_actifs())

    nb_recos = len(df_recommandation_historique)
    nb_acceptees = (df_recommandation_historique["statut"] == "Acceptée").sum()
    taux_conversion = round((nb_acceptees / nb_recos) * 100, 1) if nb_recos else 0.0
    score_moyen_recommandations = (
        round(float(df_recommandation_historique["score"].mean()), 1)
        if nb_recos
        else calculer_score_moyen_recommandations()
    )

    ventes_additionnelles = df_contrat["prime_annuelle"].sum()

    satisfaction_moyenne = pd.to_numeric(df_interaction["score_satisfaction"], errors="coerce").mean()
    satisfaction_pct = round((satisfaction_moyenne / 5) * 100, 1) if not pd.isna(satisfaction_moyenne) else 0.0

    top_produits = (
        df_contrat["produit_code"]
        .value_counts()
        .head(5)
        .rename_axis("produit_code")
        .reset_index(name="nb_contrats")
        .to_dict(orient="records")
    )

    repartition_profession = (
        df_client["profession"]
        .value_counts()
        .rename_axis("profession")
        .reset_index(name="nb_clients")
        .to_dict(orient="records")
    )

    return {
        "nb_clients": nb_clients,
        "nb_contrats": nb_contrats,
        "nb_produits": nb_produits,
        "revenu_annuel_moyen": round(float(df_client["revenu_annuel"].mean()), 0),
        "contrats_par_client_moyen": round(nb_contrats / nb_clients, 2),
        "taux_conversion": taux_conversion,
        "score_moyen_recommandations": score_moyen_recommandations,
        "ventes_additionnelles": round(float(ventes_additionnelles), 0),
        "satisfaction_client": satisfaction_pct,
        "top_produits": top_produits,
        "repartition_profession": repartition_profession,
    }


@app.get("/")
def racine():
    return {"message": "API Recommandation Assurance IA - opérationnelle"}


@app.get("/clients")
def lister_clients(recherche: str = "", page: int = 1, taille_page: int = 20):
    resultats = df_client
    if recherche:
        recherche_lower = recherche.strip().casefold()
        champs_recherche = [
            "client_id", "nom", "prenom", "profession", "situation_familiale",
            "sexe", "adresse", "age", "nb_enfants", "revenu_annuel",
            "nb_contrats_existants", "nb_sinistres_total",
        ]
        masque = pd.Series(False, index=resultats.index)
        for champ in champs_recherche:
            if champ in resultats.columns:
                masque = masque | resultats[champ].fillna("").astype(str).str.casefold().str.contains(
                    recherche_lower, regex=False
                )
        resultats = resultats[masque]

    total = len(resultats)
    debut = (page - 1) * taille_page
    fin = debut + taille_page
    page_resultats = resultats.iloc[debut:fin]

    colonnes = ["client_id", "nom", "prenom", "age", "profession", "situation_familiale", "nb_contrats_existants"]
    clients = page_resultats[colonnes].astype(object).where(
        pd.notna(page_resultats[colonnes]), None
    )
    return {
        "total": total,
        "page": page,
        "taille_page": taille_page,
        "clients": clients.to_dict(orient="records"),
    }


@app.get("/clients/{client_id}")
def get_client(client_id: str):
    if client_id not in df_client["client_id"].values:
        raise HTTPException(status_code=404, detail="Client introuvable")
    client_row = df_client[df_client["client_id"] == client_id].iloc[0]
    client = client_row.to_dict()
    for colonne, valeur in client.items():
        if pd.isna(valeur):
            client[colonne] = "" if colonne in ("nom", "prenom") else None
    client["nom"] = str(client["nom"])
    client["prenom"] = str(client["prenom"])
    return client


@app.get("/clients/{client_id}/produits-detenus")
def get_produits_detenus(client_id: str):
    contrats_client = df_contrat[df_contrat["client_id"] == client_id]
    if contrats_client.empty:
        return {"client_id": client_id, "produits": []}

    produits_uniques = contrats_client["produit_code"].unique()
    produits_info = df_produit[df_produit["produit_code"].isin(produits_uniques)]
    return {
        "client_id": client_id,
        "produits": produits_info[["produit_code", "produit_nom"]].to_dict(orient="records"),
    }


@app.get("/clients/{client_id}/evenements")
def get_evenements_client(client_id: str):
    evenements = df_evenement[df_evenement["client_id"] == client_id].sort_values(
        "date_evenement", ascending=False
    )
    return {
        "client_id": client_id,
        "evenements": evenements[["type_evenement", "date_evenement", "description"]].to_dict(orient="records"),
    }


@app.get("/clients/{client_id}/historique-recommandations")
def get_historique_recommandations(client_id: str):
    historique = df_recommandation_historique[
        df_recommandation_historique["client_id"] == client_id
    ].sort_values("date_recommandation", ascending=False)
    return {
        "client_id": client_id,
        "historique": historique[["produit_code", "date_recommandation", "statut"]].to_dict(orient="records"),
    }


@app.get("/recommandations/{client_id}")
def get_recommandations(client_id: str, avec_explication: bool = False):
    recos = recommander_produits(client_id, top_n=3)
    if recos is None:
        raise HTTPException(status_code=404, detail="Client introuvable")
    if avec_explication:
        for r in recos:
            r["explication"] = generer_explication(client_id, r.get("produit_nom", r["produit"]), r["score"], r.get("raison_regle"))
    return {"client_id": client_id, "recommandations": recos}


@app.post("/campagnes/audience-multi")
def get_audience_multi(requete: AudienceMultiRequest):
    if not requete.produits:
        raise HTTPException(status_code=400, detail="Aucun produit sélectionné")

    segments = obtenir_segments_clients() if requete.type == "segment" else None
    ids_segment = None
    if requete.type == "segment":
        if requete.segment not in segments:
            raise HTTPException(status_code=404, detail="Segment inconnu")
        _, ids_segment = segments[requete.segment]

    detail_par_produit = []
    # meilleur_score_par_client : pour l'audience combinée, on retient le
    # MEILLEUR score qu'un client obtient parmi les produits sélectionnés
    # (c'est ce produit-là qu'on lui proposera en priorité).
    meilleur_score_par_client: dict[str, float] = {}

    for critere in requete.produits:
        df_scores = calculer_scores_produit(critere.code)
        df_scores = df_scores[(df_scores["score"] >= critere.score_min) & (df_scores["score"] <= critere.score_max)]
        if ids_segment is not None:
            df_scores = df_scores[df_scores["client_id"].isin(ids_segment)]

        detail_par_produit.append({
            "produit": critere.code,
            "score_min": critere.score_min,
            "score_max": critere.score_max,
            **stats_audience(df_scores),
        })

        for client_id, score in zip(df_scores["client_id"], df_scores["score"]):
            if client_id not in meilleur_score_par_client or score > meilleur_score_par_client[client_id]:
                meilleur_score_par_client[client_id] = score

    nb_clients_uniques = len(meilleur_score_par_client)
    score_moyen_combine = (
        round(sum(meilleur_score_par_client.values()) / nb_clients_uniques, 1) if nb_clients_uniques else 0.0
    )
    taux_reponse_combine = round(min(score_moyen_combine * 0.19, 45.0), 1) if nb_clients_uniques else 0.0

    return {
        "nb_clients_uniques": nb_clients_uniques,
        "score_moyen_combine": score_moyen_combine,
        "taux_reponse_estime_combine": taux_reponse_combine,
        "messages_email": nb_clients_uniques,
        "messages_sms": nb_clients_uniques,
        "detail_par_produit": detail_par_produit,
    }


@app.get("/campagnes/audience")
def get_audience(
    produit: str, score_min: float = 0, score_max: float = 100,
    type: str = "tous", segment: str = "", tier: str = "",
):
    df_scores = calculer_scores_produit(produit)
    df_scores = df_scores[(df_scores["score"] >= score_min) & (df_scores["score"] <= score_max)]

    if type == "segment":
        segments = obtenir_segments_clients()
        if segment not in segments:
            raise HTTPException(status_code=404, detail="Segment inconnu")
        _, ids_segment = segments[segment]
        df_cible = df_scores[df_scores["client_id"].isin(ids_segment)]
    elif type == "score":
        if tier not in TIERS_SCORE:
            raise HTTPException(status_code=404, detail="Palier de score inconnu")
        _, mini, maxi = TIERS_SCORE[tier]
        df_cible = df_scores[(df_scores["score"] >= mini) & (df_scores["score"] <= maxi)]
    else:
        df_cible = df_scores

    return {
        "type": type, "segment": segment, "tier": tier, "produit": produit, "score_min": score_min,
        **stats_audience(df_cible),
    }


@app.get("/campagnes/repartition-score")
def get_repartition_score(produit: str):
    # Pas de filtre score_min ici : on veut justement voir TOUTE la
    # distribution (y compris les clients en dessous du seuil choisi).
    df_scores = calculer_scores_produit(produit)
    total = len(df_scores)
    repartition = []
    for tier_id, (label, mini, maxi) in TIERS_SCORE.items():
        nb = int(((df_scores["score"] >= mini) & (df_scores["score"] <= maxi)).sum())
        repartition.append({
            "tier": tier_id,
            "label": label,
            "nb_clients": nb,
            "pourcentage": round((nb / total) * 100, 1) if total else 0.0,
        })
    return {"total": total, "produit": produit, "repartition": repartition}


@app.get("/campagnes/segments")
def get_segments(produit: str, score_min: float = 0, score_max: float = 100):
    df_scores = calculer_scores_produit(produit)
    df_scores = df_scores[(df_scores["score"] >= score_min) & (df_scores["score"] <= score_max)]
    segments = obtenir_segments_clients()
    resultats = []
    for segment_id, (label, ids_segment) in segments.items():
        df_cible = df_scores[df_scores["client_id"].isin(ids_segment)]
        resultats.append({"segment_id": segment_id, "label": label, **stats_audience(df_cible)})
    return {"segments": resultats}


@app.get("/campagnes/segments/{segment_id}/clients")
def get_clients_segment(
    segment_id: str, produit: str, score_min: float = 0, score_max: float = 100,
    page: int = 1, taille_page: int = 20,
):
    segments = obtenir_segments_clients()
    if segment_id not in segments:
        raise HTTPException(status_code=404, detail="Segment inconnu")
    _, ids_segment = segments[segment_id]
    df_scores = calculer_scores_produit(produit)
    df_scores = df_scores[(df_scores["score"] >= score_min) & (df_scores["score"] <= score_max)]
    df_cible = df_scores[df_scores["client_id"].isin(ids_segment)].sort_values("score", ascending=False)

    total = len(df_cible)
    debut = (page - 1) * taille_page
    fin = debut + taille_page
    page_resultats = df_cible.iloc[debut:fin]

    colonnes = ["client_id", "nom", "prenom", "age", "profession", "situation_familiale", "score"]
    clients = page_resultats[colonnes].copy()
    clients["score"] = clients["score"].round(1)
    return {"total": total, "page": page, "taille_page": taille_page, "clients": clients.to_dict(orient="records")}


@app.get("/campagnes/produit/{produit}/clients")
def get_clients_produit(produit: str, score_min: float = 0, score_max: float = 100, page: int = 1, taille_page: int = 20):
    """Liste des clients éligibles à UN produit précis, dans une plage de score
    donnée -- utilisée pour le bouton 'Voir' du détail par produit (mode multi-produits)."""
    df_scores = calculer_scores_produit(produit)
    df_cible = df_scores[(df_scores["score"] >= score_min) & (df_scores["score"] <= score_max)].sort_values(
        "score", ascending=False
    )

    total = len(df_cible)
    debut = (page - 1) * taille_page
    fin = debut + taille_page
    page_resultats = df_cible.iloc[debut:fin]

    colonnes = ["client_id", "nom", "prenom", "age", "profession", "situation_familiale", "score"]
    clients = page_resultats[colonnes].copy()
    clients["score"] = clients["score"].round(1)
    return {"total": total, "page": page, "taille_page": taille_page, "clients": clients.to_dict(orient="records")}


@app.get("/campagnes/score/{tier}/clients")
def get_clients_par_score(tier: str, produit: str, score_min: float = 0, page: int = 1, taille_page: int = 20):
    if tier not in TIERS_SCORE:
        raise HTTPException(status_code=404, detail="Palier de score inconnu")
    _, mini, maxi = TIERS_SCORE[tier]
    df_scores = calculer_scores_produit(produit)
    df_scores = df_scores[df_scores["score"] >= score_min]
    df_cible = df_scores[(df_scores["score"] >= mini) & (df_scores["score"] <= maxi)].sort_values(
        "score", ascending=False
    )

    total = len(df_cible)
    debut = (page - 1) * taille_page
    fin = debut + taille_page
    page_resultats = df_cible.iloc[debut:fin]

    colonnes = ["client_id", "nom", "prenom", "age", "profession", "situation_familiale", "score"]
    clients = page_resultats[colonnes].copy()
    clients["score"] = clients["score"].round(1)
    return {"total": total, "page": page, "taille_page": taille_page, "clients": clients.to_dict(orient="records")}


OBJECTIFS_DEFINITIONS = {
    "Acquisition": "convaincre un prospect ou un client n'ayant pas encore ce produit de le découvrir et de souscrire ; ton dynamique, orienté découverte et premiers avantages",
    "Fidélisation": "renforcer la relation avec un client déjà présent, le remercier de sa confiance, lui proposer un avantage exclusif ; ton chaleureux et personnel, pas centré sur la vente agressive",
    "Cross-selling": "proposer un produit complémentaire à ce que le client possède déjà, en s'appuyant sur sa relation de confiance existante avec STAR Assurances ; ton conseil, complémentarité",
    "Up-selling": "inciter le client à passer à une formule supérieure d'un produit qu'il a déjà ; ton valorisant, axé sur les bénéfices additionnels obtenus",
    "Rétention": "éviter qu'un client ne parte à l'échéance de son contrat, le rassurer et lui rappeler sa valeur pour STAR Assurances ; ton rassurant, orienté fidélité",
}


CAMPAGNES_FICHIER = os.path.join(DATA_DIR, "campagnes.json")
mongo_client = MongoClient("mongodb://localhost:27017")
db_mongo = mongo_client["star_assurance_db"]
collection_campagnes = db_mongo["campagnes"]


def charger_campagnes() -> list[dict]:
    return [
        {cle: valeur for cle, valeur in document.items() if cle != "_id"}
        for document in collection_campagnes.find()
    ]


@app.post("/campagnes/lancer")
def lancer_campagne(requete: LancementCampagneRequest):
    """
    Simule le lancement d'une campagne (aucune infrastructure d'envoi réelle
    -- pas de vrai email/SMS envoyé), MAIS sauvegarde un vrai enregistrement
    persistant (fichier data/campagnes.json), pour alimenter les pages
    "Mes campagnes" et "Historique".
    """
    verifier_produits_actifs(requete.produits)
    campagne_id = f"CMP-{uuid.uuid4().hex[:8].upper()}"
    enregistrement = {
        "campagne_id": campagne_id,
        "nom": requete.nom,
        "objectif": requete.objectif,
        "produits": requete.produits,
        "statut": "lancee",
        "nb_destinataires": requete.nb_destinataires,
        "canaux": requete.canaux,
        "date_debut": requete.date_debut,
        "date_fin": requete.date_fin,
        "frequence": requete.frequence,
        "fuseau": requete.fuseau,
        "heure": requete.heure,
        "desabonnement": requete.desabonnement,
        "description": requete.description,
        "date_lancement": datetime.now().isoformat(),
    }

    collection_campagnes.insert_one(enregistrement)
    enregistrement.pop("_id", None)

    return enregistrement


@app.get("/campagnes/liste")
def lister_campagnes():
    campagnes = charger_campagnes()
    campagnes_triees = sorted(campagnes, key=lambda c: c["date_lancement"], reverse=True)
    total_contactes = sum(c["nb_destinataires"] for c in campagnes)
    return {
        "campagnes": campagnes_triees,
        "total_campagnes": len(campagnes),
        "total_contactes": total_contactes,
    }


@app.post("/campagnes/generer-message")
def generer_message_campagne(requete: GenerationMessageRequest):
    if client_ollama is None:
        raise HTTPException(status_code=503, detail="LLM non configuré (GROQ_API_KEY manquante)")

    verifier_produits_actifs(requete.produits)
    noms_produits = df_produit[df_produit["produit_code"].isin(requete.produits)]["produit_nom"].tolist()
    produits_texte = ", ".join(noms_produits) if noms_produits else "un produit d'assurance"
    definition_objectif = OBJECTIFS_DEFINITIONS.get(requete.objectif, "")

    if requete.canal == "sms":
        prompt = f"""Tu rédiges un SMS marketing PERSONNALISÉ pour STAR Assurances (compagnie d'assurance tunisienne).

Produit(s) concerné(s) : {produits_texte}
Objectif de la campagne : {requete.objectif} — {definition_objectif}

Ce SMS sera envoyé à des milliers de clients différents. Pour que chacun ait
l'impression que le message lui est destiné personnellement, utilise
OBLIGATOIREMENT le jeton suivant tel quel dans le texte (il sera remplacé
automatiquement par le vrai prénom de chaque destinataire au moment de
l'envoi) :
- {{{{prenom}}}}

Contraintes SMS strictes :
- 160 caractères MAXIMUM au total, jeton {{{{prenom}}}} inclus dans le compte (c'est une vraie contrainte technique, pas une suggestion)
- Une seule idée, un seul appel à l'action clair
- Pas de score, pas de pourcentage, pas de jargon technique
- Signe "STAR Assurances" à la fin si la place le permet
- Réponds UNIQUEMENT avec le texte du SMS, rien d'autre (pas de guillemets, pas de préambule)"""

        reponse = client_ollama.chat.completions.create(
            model=OLLAMA_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.6,
        )
        texte = reponse.choices[0].message.content.strip().strip('"')
        return {"canal": "sms", "texte": texte}

    else:  # email
        prompt = f"""Tu rédiges un email marketing PERSONNALISÉ pour STAR Assurances (compagnie d'assurance tunisienne).

Produit(s) concerné(s) : {produits_texte}
Objectif de la campagne : {requete.objectif} — {definition_objectif}

Cet email sera envoyé à des milliers de clients différents, chacun avec un
profil réel (nom, ancienneté, contrats déjà souscrits...). Pour que chaque
destinataire ait l'impression que le message a été rédigé spécialement pour
lui, utilise NATURELLEMENT dans le texte les jetons suivants (ils seront
remplacés automatiquement par les vraies informations de chaque client au
moment de l'envoi) :
- {{{{prenom}}}} → le prénom du client
- {{{{anciennete}}}} → depuis combien de temps il est client (ex: "3 ans")
- {{{{contrats_existants}}}} → un rappel de sa couverture actuelle

Utilise au moins {{{{prenom}}}} dans la formule d'appel, et idéalement un ou
deux autres jetons dans le corps du texte pour un effet de personnalisation
réel (pas juste au début).

Consignes :
- Rédige un OBJET d'email court et accrocheur (moins de 60 caractères), qui peut inclure {{{{prenom}}}}
- Rédige un CORPS d'email professionnel (3 à 5 paragraphes courts), qui correspond précisément au ton de l'objectif "{requete.objectif}" décrit ci-dessus
- Termine par un appel à l'action clair (ex: bouton "Découvrir l'offre" ou "Contacter mon conseiller")
- Ne termine PAS par une signature complète (elle est ajoutée automatiquement par le gabarit)
- N'invente aucun chiffre, score ou pourcentage
- Réponds STRICTEMENT en JSON valide, sans aucun texte autour, au format exact :
{{"objet": "...", "corps": "..."}}
Dans "corps", utilise \\n\\n pour séparer les paragraphes."""

        reponse = client_ollama.chat.completions.create(
            model=OLLAMA_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.6,
        )
        contenu = reponse.choices[0].message.content.strip()

        try:
            # Retirer d'éventuels ```json ... ``` autour de la réponse
            if contenu.startswith("```"):
                contenu = contenu.strip("`")
                if contenu.startswith("json"):
                    contenu = contenu[4:]
            data = json.loads(contenu)
            objet = data.get("objet", "").strip()
            corps = data.get("corps", "").strip()
        except (json.JSONDecodeError, AttributeError):
            # Repli si le modèle n'a pas respecté le format JSON demandé
            objet = f"STAR Assurances — {produits_texte}"
            corps = contenu

        return {"canal": "email", "objet": objet, "corps": corps}


def construire_email_rapide(client_id: str) -> str:
    client_row = df_client[df_client["client_id"] == client_id].iloc[0]
    recommandations = recommander_produits(client_id, top_n=3)
    noms = [NOMS_PRODUITS_REELS.get(recommandation["produit"], recommandation["produit"]) for recommandation in recommandations]
    produits_texte = ", ".join(noms) if noms else "nos solutions d'assurance"
    prenom = str(client_row["prenom"]) if pd.notna(client_row["prenom"]) else "Client"
    annee_creation = str(client_row["date_creation"])[:4]
    anciennete = max(TODAY.year - int(annee_creation), 0) if annee_creation.isdigit() else 0
    duree = f"{anciennete} an" if anciennete == 1 else f"{anciennete} ans"
    return f"""Objet : Des solutions adaptées à votre situation

Bonjour {prenom},

Depuis {duree}, STAR Assurances vous accompagne. Nous souhaitons vous présenter {produits_texte}, des solutions qui peuvent compléter votre protection selon vos besoins.

Votre conseiller est à votre disposition pour vous expliquer les garanties et vous proposer la formule la plus adaptée.

Cordialement,
STAR Assurances"""


@app.post("/chat")
def chat(requete: ChatRequest):
    debut = time.perf_counter()
    if requete.client_id not in df_client["client_id"].values:
        raise HTTPException(status_code=404, detail="Client introuvable")
    if client_ollama is None:
        raise HTTPException(status_code=503, detail="LLM non configuré (GROQ_API_KEY manquante)")

    question_lower = requete.question.casefold()
    demande_email = any(mot in question_lower for mot in ("email", "e-mail", "mail", "courriel"))
    if demande_email:
        reponse_rapide = construire_email_rapide(requete.client_id)
        logging.info("Chatbot: email rapide, total=%.2fs", time.perf_counter() - debut)
        return {"reponse": reponse_rapide}

    debut_rag = time.perf_counter()
    documents_pertinents = rechercher_documents(requete.question, top_k=3)
    contexte_documents = "\n".join([f"- {d}" for d in documents_pertinents])
    if not contexte_documents:
        contexte_documents = "Aucun extrait documentaire nécessaire pour cette demande."
    contexte_client = construire_contexte_client(requete.client_id)

    prompt_systeme = f"""{contexte_client}

Extraits pertinents de la base de garanties :
{contexte_documents}

Réponds en te basant PRIORITAIREMENT sur ces extraits. Si l'information n'y
figure pas, dis-le clairement au lieu d'inventer."""

    debut_llm = time.perf_counter()
    reponse = client_ollama.chat.completions.create(
        model=OLLAMA_MODEL,
        messages=[
            {"role": "system", "content": prompt_systeme},
            {"role": "user", "content": requete.question},
        ],
        temperature=0.3,
        extra_body={
            "keep_alive": "10m",
            "options": {"num_ctx": 4096, "num_predict": 256},
        },
    )
    logging.info(
        "Chatbot: preparation=%.2fs, llm=%.2fs, total=%.2fs, email=%s",
        time.perf_counter() - debut_rag,
        time.perf_counter() - debut_llm,
        time.perf_counter() - debut,
        demande_email,
    )
    return {"reponse": reponse.choices[0].message.content}
