"""Génère un dataset fictif de démonstration couvrant tout le catalogue connu.

Le statut actif/inactif est volontairement exclu : il est appliqué à
l'inférence, pas appris par le modèle. Les cibles sont synthétiques et ne
représentent pas des performances métier réelles.
"""
from pathlib import Path

import numpy as np
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
OUTPUT = DATA_DIR / "dataset_produit_prototype_complet.csv"
TODAY_YEAR = 2026


def charger_catalogue() -> pd.DataFrame:
    vie = pd.read_csv(DATA_DIR / "03_produit_reel.csv", dtype={"produit_code": str})[
        ["produit_code", "produit_nom"]
    ]
    non_vie = pd.read_csv(DATA_DIR / "produits_non_vie_officiels.csv", dtype={"produit_code": str})
    return pd.concat([vie, non_vie], ignore_index=True).drop_duplicates("produit_code")


def propension(client: pd.Series, nom: str) -> float:
    age = pd.to_numeric(client.get("age"), errors="coerce")
    revenu = pd.to_numeric(client.get("revenu_annuel"), errors="coerce")
    enfants = pd.to_numeric(client.get("nb_enfants"), errors="coerce")
    age = 40 if pd.isna(age) else float(age)
    revenu = 15000 if pd.isna(revenu) else float(revenu)
    enfants = 0 if pd.isna(enfants) else float(enfants)
    nom = nom.lower()

    score = 0.10 + min(revenu / 100000, 0.25)
    if any(word in nom for word in ("jeunesse", "scolaire")):
        score += 0.35 if age < 45 or enfants > 0 else -0.10
    if any(word in nom for word in ("retraite", "idr", "longue vie")):
        score += 0.35 if age >= 45 else -0.10
    if any(word in nom for word in ("emprunteur", "prévoyance")):
        score += 0.25 if 25 <= age <= 70 else -0.05
    if any(word in nom for word in ("epargne", "vie", "avenir", "homme clé")):
        score += 0.20 if 25 <= age <= 65 else 0
    if any(word in nom for word in ("voyage", "véhicule", "trik", "transport", "chantier")):
        score += 0.25 if 25 <= age <= 65 and revenu >= 10000 else -0.05
    if any(word in nom for word in ("habitation", "mrh", "mra", "mrp", "incendie")):
        score += 0.25 if enfants > 0 or age >= 30 else 0
    if any(word in nom for word in ("gav", "ordinateur", "individuel", "rc")):
        score += 0.15
    return float(np.clip(score, 0.02, 0.85))


def generer() -> pd.DataFrame:
    clients = pd.read_csv(DATA_DIR / "01_client_reel.csv")
    clients = clients.drop_duplicates("client_id", keep="first").reset_index(drop=True)
    clients["age"] = TODAY_YEAR - pd.to_datetime(clients["date_naissance"], errors="coerce").dt.year
    clients["nb_contrats_existants"] = 0
    clients["nb_sinistres_total"] = 0
    catalogue = charger_catalogue()
    rng = np.random.default_rng(42)
    lignes = []
    for _, client in clients.iterrows():
        for _, produit in catalogue.iterrows():
            probabilite = propension(client, produit["produit_nom"])
            lignes.append(
                {
                    "ID_RCU": str(client["client_id"]),
                    "age": client["age"],
                    "sexe": client["sexe"],
                    "situation_familiale": client["situation_familiale"],
                    "nb_enfants": client["nb_enfants"],
                    "profession": client["profession"],
                    "revenu_annuel": client["revenu_annuel"],
                    "nb_contrats_existants": client["nb_contrats_existants"],
                    "nb_sinistres_total": client["nb_sinistres_total"],
                    "produit_code": str(produit["produit_code"]),
                    "souscrit": int(rng.random() < probabilite),
                    "source_donnee": "fictive_prototype",
                }
            )
    dataset = pd.DataFrame(lignes)
    dataset.to_csv(OUTPUT, index=False)
    print(f"Dataset écrit : {OUTPUT}")
    print(f"Clients : {dataset.ID_RCU.nunique()} | Produits : {dataset.produit_code.nunique()} | Lignes : {len(dataset)}")
    print(dataset.groupby("produit_code").souscrit.mean().round(3).to_string())


if __name__ == "__main__":
    generer()