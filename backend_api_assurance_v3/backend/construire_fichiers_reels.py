"""
Construction des fichiers normalisés clients, produits et garanties à partir
des nouveaux exports XLS/XLSX, dans le format interne attendu par l'API.

Decisions utilisatrice (03/09/2026) :
- Pas de nom/prenom/email/telephone reels disponibles -> on affiche l'ID_RCU
  a la place d'un nom plutot que d'inventer une fausse identite.
"""

import pandas as pd

HARMONISATION_PROFESSION = {
    "Sans activite": "Sans emploi",
    "Etudiant": "Étudiant",
}

REVENU_MOYEN_PAR_PROFESSION = {
    "Fonctionnaires": 18000, "Salarie du prive": 16000, "Medical et paramedical": 35000,
    "Policiers/Militaires": 17000, "Artisan": 14000, "Etudes, conseil et assistance": 22000,
    "Agriculteur": 10000, "Autres": 15000, "Retraité": 9000, "Sans emploi": 3000, "Étudiant": 0,
}


def construire_client_reel(chemin_source: str) -> pd.DataFrame:
    df = pd.read_excel(chemin_source)
    identifiants = pd.to_numeric(df["ID_RCU"], errors="raise").astype(int).astype(str)

    out = pd.DataFrame()
    out["client_id"] = "R" + identifiants
    out["nom"] = identifiants
    out["prenom"] = ""
    out["date_naissance"] = pd.to_datetime(df["DATE_NAISSANCE"], dayfirst=True, errors="coerce")
    out["sexe"] = df["SEXE"]
    out["situation_familiale"] = df["ETAT_CIVIL"]
    out["nb_enfants"] = pd.NA
    out["profession"] = df["PROFESSION"].replace(HARMONISATION_PROFESSION)
    out["revenu_annuel"] = out["profession"].map(REVENU_MOYEN_PAR_PROFESSION)
    out["email"] = ""
    out["telephone"] = ""
    out["adresse"] = (
        df["NUMERO_MAISON"].fillna("").astype(str).replace("nan", "") + " "
        + df["TYPE_DE_VOIE"].fillna("").astype(str) + " "
        + df["ADRESSE"].fillna("").astype(str) + ", "
        + df["LOCALITE"].fillna("").astype(str) + " "
        + df["CODE_POSTAL"].fillna("").astype(str) + ", "
        + df["GOUVERNORAT"].fillna("").astype(str)
    ).str.strip()
    out["date_creation"] = pd.to_datetime(df["DATE_CREATION"], dayfirst=True, errors="coerce")

    return out


def construire_produits_reels() -> pd.DataFrame:
    """
    Le catalogue complet fourni dans produits.xlsx, avec les champs
    additionnels conservés pour compatibilité avec l'API existante.
    """
    source = pd.read_excel("data/produits.xlsx")
    df = source.rename(columns={"code": "produit_code", "description": "produit_nom"})[
        ["produit_code", "produit_nom"]
    ].copy()
    df["produit_code"] = pd.to_numeric(df["produit_code"], errors="raise").astype(int).astype(str)
    df["branche"] = "Assurance"
    df["categorie"] = "Catalogue réel"
    df["description"] = df["produit_nom"]
    df["niveau_couverture"] = "Standard"
    df["est_complementaire"] = False
    df["produit_parent"] = pd.NA
    df["canal_distribution"] = "Agence"
    df["actif"] = True
    df["date_creation"] = "2026-07-08"
    return df


def construire_garanties_reelles() -> pd.DataFrame:
    source = pd.read_excel("data/GARANTIES__ (1).xls")
    df = source.rename(
        columns={
            "CODE_PRODUIT": "produit_code",
            "CODE_GARANTIE": "garantie_code",
            "GARANTIE": "garantie_nom",
            "DESCRIPTION_PRODUIT": "description",
        }
    )[["produit_code", "garantie_code", "garantie_nom", "description"]].copy()
    codes_numeriques = pd.to_numeric(df["produit_code"], errors="coerce")
    df.loc[codes_numeriques.notna(), "produit_code"] = (
        codes_numeriques[codes_numeriques.notna()].astype(int).astype(str)
    )
    df["capital_couvert"] = pd.NA
    df["franchise"] = pd.NA
    df["obligatoire"] = False
    return df


if __name__ == "__main__":
    df_client_reel = construire_client_reel("data/DIGITAL_CLIENT_DD (1).xls")
    df_client_reel.to_csv("data/01_client_reel.csv", index=False)

    df_produit_reel = construire_produits_reels()
    df_produit_reel.to_csv("data/03_produit_reel.csv", index=False)

    df_garantie_reel = construire_garanties_reelles()
    df_garantie_reel.to_csv("data/04_garantie.csv", index=False)

    print("=== 01_client_reel.csv ===")
    print(df_client_reel.shape, "lignes/colonnes")
    print(df_client_reel.columns.tolist())
    print(df_client_reel.head(3).to_string())
    print()
    print("=== 03_produit_reel.csv ===")
    print(df_produit_reel.to_string())
