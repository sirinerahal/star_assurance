"""Genere un jeu de contrats fictifs coherent avec les clients reels.

Le fichier produit est volontairement separe des exports reels et chaque ligne
porte source_donnee=fictive.
"""

from pathlib import Path
import hashlib

import numpy as np
import pandas as pd


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATE_REFERENCE = pd.Timestamp("2026-07-08")
SEED = 42


def graine_client(client_id: str) -> int:
    digest = hashlib.sha256(f"{SEED}:{client_id}".encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big") % (2**32)


def nombre_contrats(rng: np.random.Generator, client: pd.Series) -> int:
    date_creation = pd.to_datetime(client["date_creation"], errors="coerce")
    anciennete = max(0, DATE_REFERENCE.year - date_creation.year) if pd.notna(date_creation) else 0
    revenu = float(client["revenu_annuel"]) if pd.notna(client["revenu_annuel"]) else 0
    date_naissance = pd.to_datetime(client["date_naissance"], errors="coerce")
    age = DATE_REFERENCE.year - date_naissance.year if pd.notna(date_naissance) else 40

    probabilite = 0.20 + min(anciennete, 10) * 0.035
    probabilite += 0.10 if revenu >= 20000 else 0.0
    probabilite += 0.08 if age >= 45 else 0.0
    probabilite = min(probabilite, 0.72)
    return int(rng.binomial(4, probabilite))


def choisir_produits(rng: np.random.Generator, client: pd.Series, produits: pd.DataFrame, quantite: int) -> list[str]:
    noms = produits["produit_nom"].fillna("").str.lower()
    date_naissance = pd.to_datetime(client["date_naissance"], errors="coerce")
    age = DATE_REFERENCE.year - date_naissance.year if pd.notna(date_naissance) else 40
    profession = str(client["profession"]) if pd.notna(client["profession"]) else ""
    revenu = float(client["revenu_annuel"]) if pd.notna(client["revenu_annuel"]) else 0

    poids = np.ones(len(produits), dtype=float)
    poids += np.where(noms.str.contains("sant|prevoyance|prévoyance"), 1.5, 0)
    poids += np.where(noms.str.contains("retraite|epargne|épargne"), 1.2 if age >= 45 else 0.2, 0)
    poids += np.where(noms.str.contains("emprunteur"), 1.0 if 25 <= age <= 60 else 0.2, 0)
    poids += np.where(noms.str.contains("auto|vehicule|véhicule"), 1.0 if age >= 25 else 0.1, 0)
    poids += np.where(noms.str.contains("collectif"), 0.5 if "Salarie" in profession or "Fonctionnaire" in profession else 0, 0)
    poids += np.where(noms.str.contains("premium|haut de gamme"), 0.8 if revenu >= 25000 else 0, 0)
    poids = np.maximum(poids, 0.05)
    poids /= poids.sum()

    quantite = min(quantite, len(produits))
    indices = rng.choice(len(produits), size=quantite, replace=False, p=poids)
    return produits.iloc[indices]["produit_code"].astype(str).tolist()


def generer() -> pd.DataFrame:
    clients = pd.read_csv(DATA_DIR / "01_client_reel.csv")
    clients = clients.drop_duplicates("client_id", keep="first").reset_index(drop=True)
    produits = pd.read_csv(DATA_DIR / "03_produit_reel.csv", dtype={"produit_code": str}).drop_duplicates("produit_code")
    lignes = []
    numero = 1

    for _, client in clients.iterrows():
        rng = np.random.default_rng(graine_client(str(client["client_id"])))
        quantite = nombre_contrats(rng, client)
        codes = choisir_produits(rng, client, produits, quantite)
        date_creation = pd.to_datetime(client["date_creation"], errors="coerce")
        debut_min = date_creation.normalize() if pd.notna(date_creation) else pd.Timestamp("2018-01-01")
        jours_max = max(1, (DATE_REFERENCE - debut_min).days)

        for produit_code in codes:
            date_effet = debut_min + pd.Timedelta(days=int(rng.integers(0, jours_max + 1)))
            date_souscription = max(debut_min, date_effet - pd.Timedelta(days=int(rng.integers(0, 8))))
            prime = round(float(rng.uniform(180, 950)), 2)
            lignes.append({
                "contrat_id": f"FIC-{numero:07d}",
                "client_id": client["client_id"],
                "produit_code": produit_code,
                "date_souscription": date_souscription.strftime("%Y-%m-%d"),
                "date_effet": date_effet.strftime("%Y-%m-%d"),
                "date_echeance": (date_effet + pd.DateOffset(years=1)).strftime("%Y-%m-%d"),
                "statut": "En cours",
                "prime_annuelle": prime,
                "frequence_paiement": "Annuel",
                "mode_paiement": "Prélèvement",
                "canal_souscription": "Agence",
                "source_donnee": "fictive",
            })
            numero += 1

    colonnes = [
        "contrat_id", "client_id", "produit_code", "date_souscription", "date_effet",
        "date_echeance", "statut", "prime_annuelle", "frequence_paiement",
        "mode_paiement", "canal_souscription", "source_donnee",
    ]
    return pd.DataFrame(lignes, columns=colonnes)


if __name__ == "__main__":
    sortie = DATA_DIR / "02_contrat_fictif.csv"
    contrats = generer()
    contrats.to_csv(sortie, index=False)
    print(f"{len(contrats)} contrats fictifs generes pour {contrats['client_id'].nunique()} clients.")
    print(f"Fichier : {sortie}")