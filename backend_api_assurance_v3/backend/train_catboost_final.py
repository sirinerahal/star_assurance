# -*- coding: utf-8 -*-
"""
Entraîne le modèle CatBoost final (catégories natives, sans one-hot) sur
100% des données, et sauvegarde tout ce dont l'API aura besoin.
"""
import joblib
import pandas as pd
from catboost import CatBoostClassifier

TODAY_YEAR = 2026

df = pd.read_csv("dataset_entrainement_reel.csv")
df = df.rename(columns={"souscrit": "a_souscrit"})
df["produit_code"] = df["produit_code"].astype(str)
df[["sexe", "situation_familiale", "profession"]] = df[["sexe", "situation_familiale", "profession"]].fillna("Inconnu")

FEATURES_CATEGORIELLES = ["sexe", "situation_familiale", "profession", "produit_code"]
X = df.drop(columns=["a_souscrit", "ID_RCU"])
y = df["a_souscrit"]
indices_categorielles = [X.columns.get_loc(c) for c in FEATURES_CATEGORIELLES]

model_final = CatBoostClassifier(
    iterations=400, depth=6, learning_rate=0.1, cat_features=indices_categorielles,
    auto_class_weights="Balanced", random_state=42, verbose=False,
)
model_final.fit(X, y)

joblib.dump(model_final, "model/modele_recommandation_final_v2.pkl")
joblib.dump(list(X.columns), "model/colonnes_modele_v2.pkl")
joblib.dump(FEATURES_CATEGORIELLES, "model/colonnes_categorielles_v2.pkl")

print("Modèle CatBoost final sauvegardé.")
print("Colonnes :", list(X.columns))