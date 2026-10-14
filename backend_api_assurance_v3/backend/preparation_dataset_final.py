"""
Construction du dataset d'entrainement final sur donnees reelles.
Etapes 1.1 (variable cible) et 1.2 (alignement des features) du plan.

HYPOTHESES DOCUMENTEES (a valider avec l'encadrant avant tout entrainement definitif) :
- Table profession -> revenu_annuel_moyen : nouvelle estimation, validee avec l'utilisatrice
  le 03/09/2026, faute de conserver la table originale du dataset synthetique.
- Propension de base par produit (avant application de regles_metier_valeurs) : nouvelle
  hypothese, regles_metier_valeurs() n'ayant jamais ete concue pour generer des labels
  d'entrainement (usage documente : ajustement du score APRES prediction du modele ML).
- nb_contrats_existants et nb_sinistres_total fixes a 0 pour tous les clients (meme logique
  deja acceptee et documentee pour nb_sinistres_total dans l'application existante).
- nb_enfants laisse manquant (NaN) : aucune source dans les donnees reelles recues,
  CatBoost gere nativement les valeurs manquantes numeriques.
- Perimetre produits : les 21 codes du catalogue produits.xlsx. Comme aucun contrat
    ou historique de souscription n'est fourni, la cible reste un proxy metier et ne
    doit pas etre presentee comme un apprentissage supervise reel.
"""

import numpy as np
import pandas as pd

SEED = 42
rng = np.random.default_rng(SEED)

HARMONISATION_PROFESSION = {
    "Sans activite": "Sans emploi",
    "Etudiant": "Étudiant",
}

REVENU_MOYEN_PAR_PROFESSION = {
    "Fonctionnaires": 18000,
    "Salarie du prive": 16000,
    "Medical et paramedical": 35000,
    "Policiers/Militaires": 17000,
    "Artisan": 14000,
    "Etudes, conseil et assistance": 22000,
    "Agriculteur": 10000,
    "Autres": 15000,
    "Retraité": 9000,
    "Sans emploi": 3000,
    "Étudiant": 0,
}

def regles_metier_valeurs(age, profession, revenu, produit_nom):
    """Ajustements métier fondés sur le libellé du catalogue réel."""
    nom = str(produit_nom).lower()
    age = 40 if pd.isna(age) else age
    revenu = 15000 if pd.isna(revenu) else revenu

    if "jeunesse" in nom and age >= 45:
        return 0.4
    if any(mot in nom for mot in ("retraite", "idr", "longue vie")) and age < 35:
        return 0.4
    if "emprunteur" in nom and age >= 75:
        return 0.5
    if "epargne" in nom and revenu < 12000:
        return 0.6
    if profession in ("Sans emploi", "Retraité", "Étudiant") and revenu < 10000:
        return 0.7
    return 1.0


def _sigmoid(x):
    return 1 / (1 + np.exp(-x))


def propension_de_base(age, revenu, produit_nom):
    """
    NOUVELLE HYPOTHESE (absente du code existant) : probabilite de depart, avant
    application des regles metier. Version 2 (03/09/2026) : courbes continues
    (age + revenu) plutot que des seuils binaires, pour donner un vrai signal
    exploitable au modele plutot qu'un simple bruit d'echantillonnage.
    A affiner plus tard avec de vraies donnees de contrat.
    """
    age_val = 40 if pd.isna(age) else age
    revenu_val = 15000 if pd.isna(revenu) else revenu

    nom = str(produit_nom).lower()
    p_revenu = _sigmoid((revenu_val - 15000) / 6000)

    if "jeunesse" in nom:
        p_age = _sigmoid((35 - age_val) / 8)
        return 0.05 + 0.55 * p_age * p_revenu
    if any(mot in nom for mot in ("retraite", "idr", "longue vie")):
        p_age = _sigmoid((age_val - 42) / 8)
        return 0.05 + 0.50 * p_age * p_revenu
    if "emprunteur" in nom:
        p_age = _sigmoid((age_val - 25) / 8) * _sigmoid((68 - age_val) / 12)
        return 0.05 + 0.50 * p_age * p_revenu
    if any(mot in nom for mot in ("prevoyance", "vie", "epargne", "7ayya")):
        p_age = _sigmoid((age_val - 30) / 10)
        return 0.05 + 0.45 * p_age * p_revenu
    return 0.08 + 0.20 * p_revenu


def construire_dataset(df_client: pd.DataFrame, df_produit: pd.DataFrame) -> pd.DataFrame:
    df = df_client.copy()
    df["age"] = pd.Timestamp("2026-07-08").year - pd.to_datetime(df["date_naissance"], errors="coerce").dt.year
    df["profession"] = df["profession"].replace(HARMONISATION_PROFESSION)
    df["revenu_annuel"] = df["revenu_annuel"].fillna(df["profession"].map(REVENU_MOYEN_PAR_PROFESSION))
    df["situation_familiale"] = df["situation_familiale"]
    df["sexe"] = df["sexe"]
    df["nb_enfants"] = pd.NA
    df["nb_contrats_existants"] = 0
    df["nb_sinistres_total"] = 0

    lignes = []
    for _, row in df.iterrows():
        for _, produit in df_produit.iterrows():
            produit_code = produit["produit_code"]
            produit_nom = produit["produit_nom"]
            age = row["age"]
            profession = row["profession"]
            revenu = row["revenu_annuel"]

            base = propension_de_base(age, revenu, produit_nom)
            mult = regles_metier_valeurs(
                age if not pd.isna(age) else 40, profession, revenu, produit_nom
            )
            proba_finale = min(base * mult, 0.99)
            souscrit = int(rng.random() < proba_finale)

            lignes.append({
                "ID_RCU": row["client_id"],
                "age": age,
                "sexe": sexe if not pd.isna(sexe := row["sexe"]) else pd.NA,
                "situation_familiale": row["situation_familiale"],
                "nb_enfants": row["nb_enfants"],
                "profession": profession,
                "revenu_annuel": revenu,
                "nb_contrats_existants": row["nb_contrats_existants"],
                "nb_sinistres_total": row["nb_sinistres_total"],
                "produit_code": produit_code,
                "souscrit": souscrit,
            })

    return pd.DataFrame(lignes)


if __name__ == "__main__":
    df_client = pd.read_csv("data/01_client_reel.csv")
    df_produit = pd.read_csv("data/03_produit_reel.csv")
    dataset_final = construire_dataset(df_client, df_produit)
    dataset_final.to_csv("dataset_entrainement_reel.csv", index=False)

    print("=== Résumé dataset final ===")
    print("Lignes (client x produit):", len(dataset_final))
    print()
    print("Taux de souscription par produit :")
    print(dataset_final.groupby("produit_code")["souscrit"].mean().round(3))
    print()
    print("Valeurs manquantes par colonne :")
    print(dataset_final.isna().sum())
