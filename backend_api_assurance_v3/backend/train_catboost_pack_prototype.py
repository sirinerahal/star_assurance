"""Entraîne le modèle fictif de sélection de pack pour le prototype local."""
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from catboost import CatBoostClassifier


BASE_DIR = Path(__file__).resolve().parent
DATASET = BASE_DIR / "data" / "dataset_pack_prototype_fictif.csv"
MODEL_DIR = BASE_DIR / "model"

FEATURES_CATEGORIELLES = [
    "sexe", "situation_familiale", "profession", "produit_id", "code_produit", "pack_id", "pack_nom",
]
FEATURES = [
    "age", "sexe", "situation_familiale", "nb_enfants", "profession", "revenu_annuel",
    "nb_contrats_existants", "nb_sinistres_total", "produit_id", "code_produit", "pack_id", "valeur", "pack_nom",
]


def main() -> None:
    data = pd.read_csv(DATASET)
    for column in FEATURES_CATEGORIELLES:
        data[column] = data[column].fillna("Inconnu").astype(str)
    for column in set(FEATURES) - set(FEATURES_CATEGORIELLES):
        data[column] = pd.to_numeric(data[column], errors="coerce").fillna(0)

    clients = data["client_id"].drop_duplicates().to_numpy()
    rng = np.random.default_rng(42)
    rng.shuffle(clients)
    split = int(len(clients) * 0.8)
    train_clients = set(clients[:split])
    train = data[data["client_id"].isin(train_clients)]
    test = data[~data["client_id"].isin(train_clients)]

    model = CatBoostClassifier(
        iterations=300,
        depth=6,
        learning_rate=0.08,
        cat_features=[FEATURES.index(column) for column in FEATURES_CATEGORIELLES],
        auto_class_weights="Balanced",
        random_seed=42,
        verbose=False,
    )
    model.fit(train[FEATURES], train["choix_pack"])

    test = test.copy()
    test["probabilite"] = model.predict_proba(test[FEATURES])[:, 1]
    predictions = test.loc[test.groupby(["client_id", "produit_id", "code_produit"])["probabilite"].idxmax()]
    top1 = float(predictions["choix_pack"].mean()) if len(predictions) else 0.0
    print(f"Validation prototype top-1 : {top1:.3f} (donnée synthétique, non métier)")

    MODEL_DIR.mkdir(exist_ok=True)
    joblib.dump(model, MODEL_DIR / "modele_pack_prototype_fictif.pkl")
    joblib.dump(FEATURES, MODEL_DIR / "colonnes_modele_pack_prototype.pkl")
    joblib.dump(FEATURES_CATEGORIELLES, MODEL_DIR / "colonnes_categorielles_pack_prototype.pkl")
    print("Modèle Pack prototype sauvegardé.")


if __name__ == "__main__":
    main()