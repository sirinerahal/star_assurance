"""
Nettoyage du fichier client réel DIGITAL_CLIENT_DD.xls — STAR Assurances.
Étape 0.2 du plan de travail. Ne modifie jamais le fichier source.

Corrections appliquées (toutes documentées dans l'audit des vraies données) :
1. Suppression des 2 doublons exacts (ID_RCU 4907 et 6008).
2. Dates de naissance placeholder (01/01/1900) -> NaN plutôt que fausse valeur.
3. Harmonisation des libellés GOUVERNORAT (KEF/LE KEF, MANNOUBA/MANOUBA).
4. Suppression des colonnes sans valeur prédictive (SYSTEM, STATUT -> constantes ;
   PAYS -> quasi constante).
5. Calcul de l'âge à partir de la date figée du projet (2026-07-08), pour rester
   cohérent avec le choix déjà documenté et assumé dans le reste de l'application
   (TODAY = date(2026, 7, 8) dans main.py).
"""

import pandas as pd

DATE_REFERENCE_PROJET = pd.Timestamp("2026-07-08")  # cohérent avec TODAY dans main.py

GOUVERNORAT_HARMONISATION = {
    "LE KEF": "KEF",
    "MANOUBA": "MANNOUBA",
}

COLONNES_A_SUPPRIMER = ["SYSTEM", "STATUT", "PAYS"]


def nettoyer(chemin_source: str) -> pd.DataFrame:
    df = pd.read_excel(chemin_source)

    # 1. Doublons exacts
    n_avant = len(df)
    df = df.drop_duplicates(subset=["ID_RCU"], keep="first")
    n_doublons_supprimes = n_avant - len(df)

    # 2. Dates placeholder -> NaN
    df["DATE_NAISSANCE"] = pd.to_datetime(
        df["DATE_NAISSANCE"], format="%d/%m/%Y", errors="coerce"
    )
    df.loc[df["DATE_NAISSANCE"] == pd.Timestamp("1900-01-01"), "DATE_NAISSANCE"] = pd.NaT

    # 3. Harmonisation GOUVERNORAT
    df["GOUVERNORAT"] = df["GOUVERNORAT"].replace(GOUVERNORAT_HARMONISATION)

    # 4. Colonnes inutiles
    df = df.drop(columns=[c for c in COLONNES_A_SUPPRIMER if c in df.columns])

    # Age calculé sur la date figée du projet
    df["age"] = ((DATE_REFERENCE_PROJET - df["DATE_NAISSANCE"]).dt.days / 365.25)
    df["age"] = df["age"].round().astype("Int64")

    # Ages incohérents (>100 ou <18) -> traités comme manquants, pas supprimés
    df.loc[(df["age"] > 100) | (df["age"] < 18), "age"] = pd.NA

    resume = {
        "lignes_avant": n_avant,
        "doublons_supprimes": n_doublons_supprimes,
        "lignes_apres": len(df),
        "gouvernorats_uniques": df["GOUVERNORAT"].nunique(),
        "ages_manquants_apres_nettoyage": int(df["age"].isna().sum()),
        "profession_manquants": int(df["PROFESSION"].isna().sum()),
        "sexe_manquants": int(df["SEXE"].isna().sum()),
    }
    return df, resume


if __name__ == "__main__":
    df_propre, resume = nettoyer("DIGITAL_CLIENT_DD__1_.xls")
    df_propre.to_csv("01_client_nettoye.csv", index=False)
    print("=== Résumé nettoyage ===")
    for k, v in resume.items():
        print(f"{k}: {v}")
