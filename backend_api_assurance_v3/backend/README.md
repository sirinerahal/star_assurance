# API Recommandation Assurance IA

API FastAPI qui expose le moteur de recommandation (CatBoost, categories natives),
la generation d'explications, le chatbot RAG, et le module de campagnes massives.

## 1. Installation

python -m venv venv
venv\Scripts\activate   (Windows)   ou   source venv/bin/activate   (Mac/Linux)
pip install -r requirements.txt

## 2. Configurer le modele de langage local

Le projet utilise Ollama pour les explications et le chatbot. Le modele attendu
est `qwen2.5:7b` et doit etre disponible localement :

ollama pull qwen2.5:7b

## 3. Lancer l'API

uvicorn main:app --reload

## 4. Tester

http://127.0.0.1:8000/docs

## Modele de scoring

Le modele de production est un CatBoostClassifier utilisant les categories
natives (pas d'encodage one-hot) : sexe, situation_familiale, profession et
produit_code sont passes tels quels au modele via le parametre cat_features.

Fichiers dans model/ :
- modele_recommandation_final_v2.pkl : le modele CatBoost entraine
- colonnes_modele_v2.pkl : la liste des colonnes dans l'ordre attendu par le modele
- colonnes_categorielles_v2.pkl : la liste des colonnes categorielles

Scripts de reentrainement / comparaison (dans le dossier backend) :
- train_catboost_final.py : reentraine le modele final sur 100% des donnees
- test_catboost_natif.py : compare CatBoost natif a la baseline
- test_stacking.py : teste un ensemble par empilement (Random Forest + XGBoost
  + CatBoost + Regression Logistique) -- conserve a titre de documentation,
  le stacking n'a pas ete retenu (pas de gain reel sur ce dataset)

## Recommandation IA : fonctionnement complet

### Vue d'ensemble

L'endpoint principal est `GET /recommandations/{client_id}`. Pour un client,
l'API construit une ligne de prediction pour chaque produit du catalogue,
calcule un score avec CatBoost, applique des regles metier, exclut les produits
deja detenus, puis retourne les trois meilleurs produits.

Le choix du produit est effectue par CatBoost et les regles metier. Le modele
de langage local ne choisit pas le produit : il genere uniquement une
explication lisible pour le conseiller.

### Donnees utilisees par le modele

Le modele utilise les colonnes suivantes :

- `age`
- `sexe`
- `situation_familiale`
- `nb_enfants`
- `profession`
- `revenu_annuel`
- `nb_contrats_existants`
- `nb_sinistres_total`
- `produit_code`

Les variables categorielles sont `sexe`, `situation_familiale`, `profession`
et `produit_code`. CatBoost les traite directement, sans one-hot encoding.

Les descriptions de produits et les garanties ne sont pas envoyees au modele
de scoring. Le modele recoit surtout des donnees structurees sur le client et
le code du produit teste.

### Origine des donnees

Donnees reelles ou provenant d'exports reels :

- `data/01_client_reel.csv` : profils clients, dates de naissance,
  professions, situations familiales et adresses.
- `data/03_produit_reel.csv` : catalogue des produits.
- `data/04_garantie.csv` : garanties utilisees principalement par le chatbot
  RAG.

Donnees estimees ou derivees :

- `age` est calcule a partir de `date_naissance`.
- `revenu_annuel` est estime a partir de la profession avec une table de
  revenus moyens, et ne represente pas necessairement le revenu reel du client.
- Le nom et le prenom reels n'ayant pas ete fournis, l'identifiant client est
  utilise dans l'application.

Donnees fictives, simulees ou absentes :

- `data/02_contrat_fictif.csv` contient des contrats generes artificiellement.
- `souscrit`, la cible d'entrainement, est generee par des hypotheses metier
  et un tirage aleatoire reproductible (`seed=42`).
- `nb_sinistres_total` est fixe a zero car aucun historique reel de sinistres
  n'a ete fourni.
- `nb_contrats_existants` etait fixe a zero dans le dataset d'entrainement.
- `nb_enfants` est laisse manquant faute de source.
- Les historiques de recommandations, evenements et interactions sont vides
  dans la version actuelle.

### Preparation du profil client

La fonction `construire_features_client()` dans `main.py` realise les etapes
suivantes :

1. Elle recherche le client par `client_id`.
2. Elle recupere les produits associes a ses contrats connus.
3. Elle cree une ligne pour chaque produit du catalogue.
4. Elle recopie le profil client dans chaque ligne.
5. Elle ajoute `deja_souscrit` pour savoir si le produit doit etre exclu.
6. Elle remplace les categories manquantes par `Inconnu`.
7. Elle conserve les colonnes et l'ordre attendus par le modele CatBoost.

Le modele evalue donc des couples `client-produit`, et non le client seul.

### Calcul et classement du score

CatBoost retourne une probabilite de la classe positive avec :

```python
model.predict_proba(X)[:, 1]
```

Cette probabilite correspond a la propension estimee a souscrire au produit.
Elle est ensuite ajustee par une regle metier :

```text
score_final = min(score_catboost * multiplicateur_metier, 0.99)
score_affiche = score_final * 100
```

Exemple : un score CatBoost de 0,70 avec un multiplicateur de 0,60 donne un
score final de 42 %. Les produits sont tries par score decroissant et les trois
premiers sont retournes.

### Regles metier appliquees

Les regles de `regles_metier()` adaptent le score selon le profil et le produit.
Elles peuvent notamment :

- diminuer un produit jeunesse pour un client age ;
- diminuer un produit retraite pour un client jeune ;
- diminuer un produit emprunteur apres 75 ans ;
- diminuer l'epargne pour un revenu faible ;
- diminuer certains produits automobiles pour un profil a faible revenu ;
- diminuer la prevoyance pour un profil jeune ;
- diminuer l'assistance premium pour un revenu inferieur a 18 000 TND ;
- favoriser la sante pour un client age d'au moins 55 ans.

La regle peut aussi fournir une raison textuelle, reutilisee dans
l'explication generee pour le conseiller.

### Influence des contrats existants

Les contrats connus influencent la recommandation de trois manieres :

1. Un produit deja detenu est retire des candidats et ne peut pas etre
   recommande une seconde fois.
2. Le nombre de contrats est calcule dans `nb_contrats_existants`.
3. Les produits deja detenus sont transmis au generateur d'explications.

Limite actuelle : les contrats de `02_contrat_fictif.csv` sont simules et le
modele a ete entraine avec `nb_contrats_existants=0` pour tous les clients.
Cette variable n'a donc pas encore une valeur predictive fiable.

Une autre limite concerne les codes produits : le dataset d'entrainement
contient les cinq codes metier utilises pour la simulation des labels, tandis
que le catalogue actuel contient des codes numeriques reels. Cette nomenclature
doit etre harmonisee avant de presenter le modele comme definitif.

### Construction du dataset d'entrainement

`preparation_dataset_final.py` construit une ligne par client et par produit.
Comme les vraies souscriptions ne sont pas disponibles, la cible `souscrit` est
simulee en trois temps :

1. calcul d'une propension de base selon l'age et le revenu ;
2. application d'un multiplicateur metier selon le produit ;
3. tirage aleatoire reproductible a partir de la probabilite finale.

`train_catboost_final.py` entraine ensuite CatBoost sur ce dataset et sauvegarde
le modele et les listes de colonnes dans `model/`.

Il faut donc distinguer clairement les profils clients reels des labels
d'entrainement simules : le modele actuel apprend des hypotheses metier
appliquees a des profils reels, et non un historique reel de souscriptions.

### Recommandation et modele de langage

Apres le classement, `generer_explication()` peut utiliser Ollama et
`qwen2.5:7b` pour produire une explication de deux ou trois phrases.
L'explication recu pour le conseiller contient notamment l'age, la profession,
le revenu, les produits deja detenus et la raison de la regle metier.

Le modele de langage n'intervient pas dans le score et ne decide pas du
produit recommande.

### Fichiers lies a la recommandation

- `main.py` : preparation, scoring, regles metier, classement et endpoints API.
- `preparation_dataset_final.py` : creation du dataset et simulation de la cible.
- `train_catboost_final.py` : entrainement du modele CatBoost.
- `test_catboost_natif.py` : evaluation du modele.
- `construire_fichiers_reels.py` : normalisation des exports reels.
- `generer_contrats_fictifs.py` : generation des contrats fictifs.
- `data/01_client_reel.csv` : profils clients.
- `data/02_contrat_fictif.csv` : contrats simules.
- `data/03_produit_reel.csv` : catalogue produits.
- `model/modele_recommandation_final_v2.pkl` : modele entraine.
- `frontend/app/clients/[id]/page.tsx` : affichage de la fiche et des recommandations.
- `frontend/components/RecommandationDetailModal.tsx` : affichage du score et de l'explication.

### Formulation pour une presentation

L'application construit une prediction pour chaque couple client-produit.
CatBoost estime une propension de souscription a partir du profil client et du
produit, puis des regles metier ajustent ce resultat. Les produits deja detenus
sont exclus et les trois meilleurs produits sont proposes au conseiller. Une
IA locale genere ensuite une explication en langage naturel. Les profils et le
catalogue sont issus de donnees reelles, mais les contrats et la cible
d'entrainement sont encore simules en attendant de vraies donnees de
souscription.
