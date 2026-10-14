# Prototype de recommandation de packs

Ce prototype est séparé du modèle de recommandation des produits.

## Génération et entraînement

Depuis le dossier `backend` :

```powershell
python generer_dataset_pack_prototype.py
python train_catboost_pack_prototype.py
```

Le dataset produit est `data/dataset_pack_prototype_fictif.csv`. Il contient
une ligne par client, produit et pack réellement disponible selon la clé
composite `(produit_id, code_produit)`. La colonne `choix_pack` est générée
par des règles fictives et `source_donnee` vaut `fictive_prototype`.

Les artefacts sont enregistrés dans `model/` avec le suffixe
`_pack_prototype_fictif`.

Les scores et choix obtenus ne sont pas des performances métier. Le modèle
devra être remplacé ou réentraîné avec un historique réel des packs choisis
avant toute utilisation opérationnelle.