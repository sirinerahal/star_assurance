"""Entraîne le modèle Produit prototype sur tous les codes connus du catalogue."""
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from catboost import CatBoostClassifier
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score

BASE_DIR = Path(__file__).resolve().parent
DATASET = BASE_DIR / "data" / "dataset_produit_prototype_complet.csv"
MODEL_DIR = BASE_DIR / "model"
FEATURES_CATEGORIELLES = ["sexe", "situation_familiale", "profession", "produit_code"]


def main() -> None:
    data = pd.read_csv(DATASET)
    features = [column for column in data.columns if column not in ("souscrit", "ID_RCU", "source_donnee")]
    for column in FEATURES_CATEGORIELLES:
        data[column] = data[column].fillna("Inconnu").astype(str)
    for column in set(features) - set(FEATURES_CATEGORIELLES):
        data[column] = pd.to_numeric(data[column], errors="coerce").fillna(0)

    clients = data["ID_RCU"].drop_duplicates().to_numpy()
    rng = np.random.default_rng(42)
    rng.shuffle(clients)
    split = int(len(clients) * 0.8)
    train_clients = set(clients[:split])
    train = data[data["ID_RCU"].isin(train_clients)]
    test = data[~data["ID_RCU"].isin(train_clients)]

    model = CatBoostClassifier(
        iterations=400,
        depth=6,
        learning_rate=0.1,
        cat_features=[features.index(column) for column in FEATURES_CATEGORIELLES],
        auto_class_weights="Balanced",
        random_seed=42,
        verbose=False,
    )
    model.fit(train[features], train["souscrit"])
    predicted = model.predict(test[features]).astype(int).ravel()
    probabilities = model.predict_proba(test[features])[:, 1]
    metrics = {
        "accuracy": accuracy_score(test["souscrit"], predicted),
        "precision": precision_score(test["souscrit"], predicted),
        "recall": recall_score(test["souscrit"], predicted),
        "f1": f1_score(test["souscrit"], predicted),
        "auc_roc": roc_auc_score(test["souscrit"], probabilities),
    }
    print("Métriques prototype (données fictives, non métier) :")
    for name, value in metrics.items():
        print(f"{name}={value:.4f}")

    MODEL_DIR.mkdir(exist_ok=True)
    joblib.dump(model, MODEL_DIR / "modele_recommandation_produit_prototype_complet.pkl")
    joblib.dump(features, MODEL_DIR / "colonnes_modele_produit_prototype_complet.pkl")
    joblib.dump(FEATURES_CATEGORIELLES, MODEL_DIR / "colonnes_categorielles_produit_prototype_complet.pkl")
    print("Modèle prototype sauvegardé sans remplacer le modèle courant.")


if __name__ == "__main__":
    main()