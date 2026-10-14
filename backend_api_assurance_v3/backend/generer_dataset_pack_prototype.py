"""Génère un dataset fictif isolé pour prototyper le choix d'un pack.

Les profils sont copiés depuis les données clients disponibles, mais la cible
choix_pack est entièrement synthétique. Ce fichier ne doit pas être utilisé
pour entraîner le modèle de recommandation produit.
"""
from pathlib import Path

import numpy as np
import pandas as pd


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
OUTPUT = DATA_DIR / "dataset_pack_prototype_fictif.csv"


def nombre(valeur, valeur_defaut: float = 0) -> float:
    valeur = pd.to_numeric(valeur, errors="coerce")
    return valeur_defaut if pd.isna(valeur) else float(valeur)


def charger_packs() -> pd.DataFrame:
    source = pd.read_excel(DATA_DIR / "PACK_PRODUIT.xls")
    packs = source.rename(
        columns={
            "ID_PACK": "pack_id",
            "VALEUR": "valeur",
            "DESCRIPTION_PACK": "pack_nom",
            "ID_PRODUIT": "produit_id",
            "CODE_PRODUIT": "code_produit",
            "PRODUIT": "produit_nom",
        }
    )[["pack_id", "valeur", "pack_nom", "produit_id", "code_produit", "produit_nom"]]
    for column in ("pack_id", "valeur", "produit_id", "code_produit"):
        packs[column] = pd.to_numeric(packs[column], errors="coerce")
    packs = packs.dropna(subset=["pack_id", "produit_id", "code_produit"])
    for column in ("pack_id", "produit_id", "code_produit"):
        packs[column] = packs[column].astype(int).astype(str)
    packs["valeur"] = packs["valeur"].fillna(0).astype(int)
    return packs.drop_duplicates(["pack_id", "valeur", "produit_id", "code_produit"])


def score_option(client: pd.Series, pack: pd.Series) -> float:
    """Règle fictive explicite utilisée uniquement pour créer la cible prototype."""
    revenu = nombre(client.get("revenu_annuel"))
    enfants = nombre(client.get("nb_enfants"))
    contrats = nombre(client.get("nb_contrats_existants"))
    age = nombre(client.get("age"))
    nom = str(pack["pack_nom"]).lower()

    besoin_protection = enfants * 1.8 + contrats * 0.5 + (1.5 if age >= 55 else 0)
    capacite = min(revenu / 20000, 4)
    niveau = {"securite": 1, "securite +": 2, "serenite": 3, "super securite": 5}.get(nom, float(pack["valeur"]))
    score = -abs(niveau - (1 + besoin_protection * 0.45 + capacite * 0.35))
    score += (0.15 if "serenite" in nom and age >= 55 else 0)
    score += (0.15 if "super" in nom and revenu >= 25000 else 0)
    return score


def generer() -> pd.DataFrame:
    clients = pd.read_csv(DATA_DIR / "01_client_reel.csv")
    clients = clients.drop_duplicates("client_id", keep="first").reset_index(drop=True)
    clients["age"] = 2026 - pd.to_datetime(clients["date_naissance"], errors="coerce").dt.year
    contrats = pd.read_csv(DATA_DIR / "02_contrat_fictif.csv", dtype={"client_id": str})
    nb_contrats = contrats.groupby("client_id").size().rename("nb_contrats_existants")
    clients = clients.merge(nb_contrats, on="client_id", how="left")
    clients["nb_contrats_existants"] = clients["nb_contrats_existants"].fillna(0)

    packs = charger_packs()
    lignes = []
    for _, client in clients.iterrows():
        for _, groupe in packs.groupby(["produit_id", "code_produit"], sort=False):
            scores = groupe.apply(lambda pack: score_option(client, pack), axis=1)
            gagnant = scores.idxmax()
            for index, pack in groupe.iterrows():
                lignes.append(
                    {
                        "client_id": str(client["client_id"]),
                        "age": client["age"],
                        "sexe": client["sexe"],
                        "situation_familiale": client["situation_familiale"],
                        "nb_enfants": client["nb_enfants"],
                        "profession": client["profession"],
                        "revenu_annuel": client["revenu_annuel"],
                        "nb_contrats_existants": client["nb_contrats_existants"],
                        "nb_sinistres_total": 0,
                        "produit_id": pack["produit_id"],
                        "code_produit": pack["code_produit"],
                        "pack_id": pack["pack_id"],
                        "valeur": pack["valeur"],
                        "pack_nom": pack["pack_nom"],
                        "choix_pack": int(index == gagnant),
                        "source_donnee": "fictive_prototype",
                    }
                )
    resultat = pd.DataFrame(lignes)
    resultat.to_csv(OUTPUT, index=False)
    print(f"Dataset prototype écrit : {OUTPUT}")
    print(f"Lignes : {len(resultat)} | Clients : {resultat['client_id'].nunique()} | Produits : {resultat['produit_id'].nunique()}")
    return resultat


if __name__ == "__main__":
    generer()