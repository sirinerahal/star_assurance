# -*- coding: utf-8 -*-
"""
Teste CatBoost avec ses VRAIES catégories natives (pas de one-hot encoding),
pour lui donner sa vraie chance -- contrairement au premier test où
l'encodage one-hot annulait son principal avantage.
"""
import time
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
)
from catboost import CatBoostClassifier

TODAY_YEAR = 2026

df = pd.read_csv("dataset_entrainement_reel.csv")
df = df.rename(columns={"souscrit": "a_souscrit"})
df[["sexe", "situation_familiale", "profession"]] = df[["sexe", "situation_familiale", "profession"]].fillna("Inconnu")

FEATURES_CATEGORIELLES = ["sexe", "situation_familiale", "profession", "produit_code"]
X = df.drop(columns=["a_souscrit", "ID_RCU"])
y = df["a_souscrit"]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

indices_categorielles = [X.columns.get_loc(c) for c in FEATURES_CATEGORIELLES]

t0 = time.time()
model_catboost_natif = CatBoostClassifier(
    iterations=400,
    depth=6,
    learning_rate=0.1,
    cat_features=indices_categorielles,
    auto_class_weights="Balanced",
    random_state=42,
    verbose=False,
)
model_catboost_natif.fit(X_train, y_train)
print(f"Temps d'entraînement : {time.time()-t0:.1f}s")

y_pred = model_catboost_natif.predict(X_test)
y_proba = model_catboost_natif.predict_proba(X_test)[:, 1]

print("\n=== CatBoost natif (catégories brutes, sans one-hot) ===")
print(f"Accuracy  : {accuracy_score(y_test, y_pred):.3f}")
print(f"Précision : {precision_score(y_test, y_pred):.3f}")
print(f"Rappel    : {recall_score(y_test, y_pred):.3f}")
print(f"F1-score  : {f1_score(y_test, y_pred):.3f}")
print(f"AUC-ROC   : {roc_auc_score(y_test, y_proba):.3f}")

print("\n--- Importance des variables ---")
importances = pd.DataFrame({
    "feature": X.columns,
    "importance": model_catboost_natif.get_feature_importance()
}).sort_values("importance", ascending=False)
print(importances.to_string(index=False))