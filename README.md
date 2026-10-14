# STAR Assurances - Recommandation de produits et de packs

## 1. Objectif du projet

Ce projet est une application de recommandation pour STAR Assurances. Elle analyse le profil d'un client et propose les produits d'assurance qui semblent les plus pertinents. Lorsqu'un produit possède des packs dans le catalogue, l'application recherche aussi les packs de ce produit et en sélectionne un.

Le résultat visible sur la fiche client est volontairement simple :

```text
Produit recommande : MRH
Pack recommande : Securite+
```

La liste complete des packs est disponible dans l'ecran **Produits**, dans la section **Verifier la relation Produit -> Packs**.

## 2. Architecture

Le projet contient deux parties principales :

- `backend_api_assurance_v3/backend` : API Python/FastAPI, donnees, modeles et logique metier.
- `frontend_assurance_v12/frontend` : interface Next.js/React/TypeScript.

Le frontend appelle principalement l'endpoint backend :

```text
GET /recommandations/{client_id}?avec_explication=true
```

## 3. Pourquoi la partie Produit <-> Pack a ete ajoutee

Avant l'ajout des packs, l'application recommandait uniquement un produit. Or un produit comme MRH peut etre vendu avec plusieurs niveaux ou formules : Securite, Securite+, Serenite, PNO, Etudiant, etc.

La partie Pack a donc ete ajoutee pour :

1. retrouver les packs reellement associes au produit recommande ;
2. choisir un pack parmi ces packs ;
3. expliquer le choix au conseiller ;
4. controler visuellement la relation entre les produits et les packs.

La relation n'a pas ete recreee dans le code. Elle vient de la source existante :

```text
backend_api_assurance_v3/backend/data/PACK_PRODUIT.xls
```

## 4. Donnees Produit et Pack

### 4.1 Source des packs

Le fichier `PACK_PRODUIT.xls` contient notamment les colonnes suivantes :

- `ID_PACK` : identifiant du pack dans la source ;
- `VALEUR` : valeur ou niveau de l'option ;
- `DESCRIPTION_PACK` : nom du pack ;
- `ID_PRODUIT` : identifiant du produit ;
- `CODE_PRODUIT` : code du produit ;
- `PRODUIT` : nom du produit.

La fonction `charger_packs_reels()` dans `backend/main.py` renomme ces colonnes, convertit les identifiants en texte et supprime les doublons exacts de ligne.

Attention : `ID_PACK` seul n'est pas toujours unique pour une option. Dans MRH, les six options partagent le meme `ID_PACK` et sont distinguees par `VALEUR`. Une option est donc identifiee dans l'application par le couple `(pack_code, valeur)`.

### 4.2 Source du catalogue produit

Les produits sont construits dans `charger_catalogue_produits()` dans `backend/main.py` a partir de :

- `data/03_produit_reel.csv` ;
- `data/produits_non_vie_officiels.csv` ;
- les couples produit presents dans `PACK_PRODUIT.xls`.

Le catalogue final est stocke en memoire dans `df_produit`. Les packs nettoyes sont stockes dans `df_packs`.

## 5. La cle composite Produit <-> Pack

### Definition

Une cle composite est une cle composee de plusieurs colonnes. Dans ce projet, la relation principale utilise :

```text
(produit_id, code_produit)
```

Ces deux colonnes sont necessaires ensemble pour retrouver le bon produit dans la source des packs.

### Pourquoi deux colonnes

`produit_id` identifie le produit dans le referentiel de la source et `code_produit` complete cette identification. Le code ne fait pas une recherche uniquement sur le nom, car les noms peuvent varier ou etre ambigus.

### Creation et utilisation

La cle est preparee dans :

- `charger_packs_reels()` : preparation de `df_packs` ;
- `charger_catalogue_produits()` : ajout de `produit_id` et `code_produit` au catalogue ;
- `trouver_packs(produit_code)` : filtrage des packs ;
- `lister_relation_produits_packs()` : controle de toutes les correspondances.

Le filtrage principal est equivalent a :

```python
packs_produit = df_packs[
    (df_packs["produit_id"] == produit["produit_id"])
    & (df_packs["code_produit"] == produit["code_produit"])
]
```

La valeur du pack est ensuite conservee afin de distinguer les options qui possedent le meme `ID_PACK`.

## 6. Chemin complet de recommandation

Le fonctionnement est le suivant :

```text
Client
-> preparation du profil
-> modele CatBoost produit
-> regles metier produit
-> produit recommande
-> recherche des packs avec (produit_id, code_produit)
-> modele CatBoost pack prototype
-> pack recommande
-> explication affichee
```

### 6.1 Preparation du client

`construire_features_client()` construit une ligne par couple client-produit avec :

- `age` ;
- `sexe` ;
- `situation_familiale` ;
- `nb_enfants` ;
- `profession` ;
- `revenu_annuel` ;
- `nb_contrats_existants` ;
- `nb_sinistres_total` ;
- `produit_code`.

Les produits deja presents dans les contrats connus sont exclus de la recommandation.

### 6.2 Choix du produit

Le produit est choisi dans `recommander_produits()`.

- `model_rf` est le modele CatBoost charge depuis `model/modele_recommandation_final_v2.pkl`.
- Il calcule une probabilite avec `predict_proba()`.
- `regles_metier()` ajuste ensuite le score selon le profil et le produit.
- Les produits sont tries et les trois meilleurs sont retournes.

Les regles metier peuvent par exemple reduire la priorite d'un produit jeunesse pour un client age, ou favoriser la sante pour un client d'au moins 55 ans.

Le produit n'est pas choisi par le LLM. Ollama peut seulement generer une explication textuelle complementaire.

### 6.3 Recherche des packs

Pour chaque produit recommande, `trouver_packs()` utilise exactement le couple `(produit_id, code_produit)`. Aucun nouveau lien Produit-Pack n'est calcule a partir d'une hypothese ou d'un nom.

### 6.4 Choix du pack

`recommander_pack_prototype()` construit une ligne candidate pour chaque pack et appelle :

```python
model_pack_prototype.predict_proba(...)
```

Le pack ayant la probabilite la plus elevee est retenu.

Ce modele est CatBoost, mais il ne s'agit pas encore d'un modele metier entraine sur un historique reel de choix de packs. Sa cible `choix_pack` a ete fabriquee par des regles dans `generer_dataset_pack_prototype.py`.

### 6.5 Explication

`construire_explication_pack()` explique le choix avec les informations disponibles du client : age, revenu, situation familiale, enfants et contrats. Elle indique aussi le meilleur pack concurrent et rappelle que l'entrainement du modele pack est synthetique.

## 7. Donnees reelles, fictives et manquantes

### Donnees provenant des exports ou referentiels disponibles

- `data/01_client_reel.csv` : profils clients disponibles ;
- `data/03_produit_reel.csv` : catalogue produit ;
- `data/produits_non_vie_officiels.csv` : catalogue officiel Non-Vie ;
- `data/PACK_PRODUIT.xls` : relation Produit-Pack utilisee ;
- `data/04_garantie.csv` : garanties utilisees notamment par le RAG.

Le mot `reel` signifie ici que le fichier provient des donnees fournies au projet. Il ne garantit pas que chaque colonne soit complete ou historiquement exploitable pour entrainer un modele.

### Donnees fictives ou generees

- `data/02_contrat_fictif.csv` : contrats simules ;
- `data/dataset_entrainement_reel.csv` : malgre son nom, sa cible de souscription est generee par des hypotheses metier ;
- `data/dataset_pack_prototype_fictif.csv` : choix de packs synthetiques ;
- `model/modele_recommandation_final_v2.pkl` : modele produit entraine avec une cible simulee ;
- `model/modele_pack_prototype_fictif.pkl` : modele pack entraine avec une cible synthetique ;
- `nb_sinistres_total` est actuellement fixe a zero faute d'historique de sinistres reel.

### Donnees encore manquantes ou limitees

- historique reel des souscriptions produit ;
- historique reel des packs choisis ;
- historique reel des sinistres ;
- historique complet des contrats ;
- validation metier des 26 produits sans pack et des 71 lignes pack orphelines detectees par le controle ;
- cible historique permettant d'evaluer une vraie performance predictive.

Les anomalies Produit-Pack sont affichees dans l'application mais ne sont pas corrigees automatiquement : corriger la relation sans validation de STAR pourrait supprimer ou inventer des offres.

## 8. Fichiers modifies pour la partie Produit-Pack

### Backend

- `backend_api_assurance_v3/backend/main.py`
  - charge `PACK_PRODUIT.xls` ;
  - construit `df_packs` ;
  - implemente `trouver_packs()` ;
  - selectionne le pack avec `recommander_pack_prototype()` ;
  - genere l'explication avec `construire_explication_pack()` ;
  - expose `/produits/relation-packs` ;
  - retourne les produits sans pack et les packs orphelins ;
  - compare maintenant les packs avec `(pack_code, valeur)`.

- `backend_api_assurance_v3/backend/generer_dataset_pack_prototype.py`
  - cree le dataset synthetique du prototype pack ;
  - genere la colonne `choix_pack` avec des regles fictives.

- `backend_api_assurance_v3/backend/train_catboost_pack_prototype.py`
  - entraine le modele CatBoost de pack prototype.

- `backend_api_assurance_v3/backend/README_PACK_PROTOTYPE.md`
  - documente le caractere synthetique du prototype pack.

### Frontend

- `frontend_assurance_v12/frontend/lib/api.ts`
  - definit les types de recommandations, packs et controles de relation ;
  - appelle `/produits/relation-packs`.

- `frontend_assurance_v12/frontend/app/clients/[id]/page.tsx`
  - affiche le nom du produit et uniquement le pack recommande ;
  - supprime la liste principale `option 1`, `option 2`, etc. ;
  - affiche l'explication du pack.

- `frontend_assurance_v12/frontend/app/produits/page.tsx`
  - affiche Produit -> tous les packs ;
  - affiche la cle composite ;
  - affiche les produits sans pack et les packs orphelins ;
  - affiche les compteurs de controle.

## 9. Exemple concret

Pour un client comme `R111`, le flux observe est :

```text
Client R111
-> profil client : age, revenu, situation familiale, enfants, contrats
-> produit recommande : MRH
-> cle Produit-Pack : (37, 805)
-> packs trouves : Securite, Securite+, Serenite, PNO, Etudiant, A la carte (FAC)
-> pack recommande : Securite+
```

MRH est classe parmi les produits candidats par `model_rf` puis les regles metier. Une fois MRH retenu, le choix de `Securite+` est effectue par le modele pack prototype parmi les six packs relies par la cle `(37, 805)`. Le choix du pack utilise le profil du client et les valeurs des packs, mais la cible apprise par ce modele est synthetique.

---

# Fiche de préparation aux questions de l'encadrant

Les réponses ci-dessous sont formulées pour être faciles à expliquer à l'oral.
Elles décrivent le fonctionnement réel du projet et indiquent clairement ses
limites.

## 10. Présentation générale

### Question : Quel est l'objectif du projet ?

**Réponse simple :**

Le projet est une plateforme d'aide à la recommandation de produits
d'assurance. Elle analyse le profil d'un client, ses contrats connus et le
catalogue disponible, puis propose les produits les plus pertinents. Lorsqu'un
produit possède des packs, elle propose également un pack et explique le
résultat au conseiller.

### Question : Pouvez-vous expliquer le parcours complet ?

**Réponse simple :**

Le frontend demande un client à l'API. Le backend construit une ligne de
prédiction pour chaque produit actif, calcule les scores CatBoost, applique les
règles métier, retire les produits déjà détenus et renvoie les trois meilleurs.
Pour chaque produit recommandé, il recherche les packs liés avec la clé
composite, choisit un pack et renvoie une explication.

```text
Client -> API -> profil client-produit -> CatBoost -> règles métier
       -> produits recommandés -> clé Produit-Pack -> pack recommandé
       -> JSON -> affichage Next.js
```

### Question : Quelles parties ai-je principalement développées ?

**Réponse simple :**

Les ajouts principaux sont l'intégration des produits et packs disponibles, la
relation par clé composite, la sélection et l'explication du pack, le contrôle
des produits sans pack et des packs orphelins, ainsi que l'affichage dans la
fiche client et la page Produits. J'ai aussi travaillé dans un projet qui
intègre les campagnes, le chatbot RAG et le scoring ML.

## 11. Architecture Full Stack

### Question : Quelle architecture avez-vous utilisée ?

**Réponse simple :**

J'ai séparé l'application en deux parties. Le frontend utilise Next.js, React
et TypeScript. Le backend utilise Python et FastAPI. Le frontend ne lit pas
directement les fichiers de données : il appelle une API REST. Le backend
centralise les données, la logique métier, les modèles et les réponses JSON.

- Frontend : `frontend_assurance_v12/frontend`.
- Backend : `backend_api_assurance_v3/backend`.
- Données et modèles : `backend_api_assurance_v3/backend/data` et `model`.

### Question : Pourquoi séparer le frontend et le backend ?

**Réponse simple :**

Cela sépare l'affichage de la logique métier. Le frontend peut changer sans
modifier le calcul des recommandations. Le backend protège aussi les données,
les modèles et les secrets, et pourrait être utilisé par une autre interface.

### Question : Comment le frontend communique-t-il avec l'API ?

**Réponse simple :**

Le fichier `frontend_assurance_v12/frontend/lib/api.ts` centralise les appels
`fetch`. Il construit l'URL avec `NEXT_PUBLIC_API_URL`, ajoute `X-API-Key`,
envoie les paramètres ou le JSON, vérifie le statut HTTP et retourne des objets
TypeScript typés.

**Exemple :** la fiche client appelle
`GET /recommandations/{client_id}?avec_explication=true`.

### Question : Qu'est-ce qu'un endpoint REST ?

**Réponse simple :**

C'est une URL qui représente une ressource ou une action. `GET` lit des
données, `POST` crée ou lance une action et `PATCH` modifie partiellement une
ressource.

**Exemples du projet :**

- `GET /clients/R111` lit une fiche client.
- `GET /produits` lit le catalogue.
- `PATCH /produits/{produit_code}` active ou désactive un produit.
- `POST /campagnes/lancer` enregistre une campagne.

### Question : Que signifient les principaux codes HTTP utilisés ?

**Réponse simple :**

`200` signifie que la requête a réussi. `400` indique une requête invalide,
`401` une clé API absente ou incorrecte, `404` une ressource introuvable,
`409` un conflit avec une règle métier et `503` un service IA indisponible.

## 12. Données et préparation

### Question : Quelles données utilisez-vous ?

**Réponse simple :**

Les profils clients et le catalogue viennent des exports ou référentiels
disponibles. `PACK_PRODUIT.xls` contient la relation entre produits et packs.
Les garanties alimentent notamment le chatbot. Les contrats sont actuellement
fictifs et servent à simuler les produits déjà détenus.

### Question : Pourquoi certaines données sont-elles dites réelles et d'autres fictives ?

**Réponse simple :**

Un fichier peut venir d'un export réel sans fournir un historique exploitable
pour l'apprentissage. Dans ce projet, les profils et certains référentiels sont
disponibles, mais les contrats et les choix de souscription utilisés comme
cibles d'entraînement sont simulés. Le modèle valide donc surtout la chaîne
technique, pas encore une performance métier définitive.

### Question : Comment gérez-vous les valeurs manquantes ?

**Réponse simple :**

Pour l'API, une valeur absente est renvoyée comme `null` ou comme une chaîne
vide selon le champ. Pour CatBoost, les catégories manquantes sont remplacées
par `Inconnu`. L'âge est calculé depuis la date de naissance et le revenu peut
être estimé à partir de la profession lorsqu'il n'est pas fourni.

### Question : Pourquoi dédupliquer les clients ?

**Réponse simple :**

L'identifiant `client_id` est la clé métier du client. Si l'export contient
plusieurs lignes pour le même identifiant, garder une seule fiche évite de
compter deux fois la personne ou de produire des résultats incohérents.

### Question : Que signifie `nb_sinistres_total = 0` ?

**Réponse simple :**

Cela ne signifie pas que chaque client n'a jamais eu de sinistre. Aucun
historique réel des sinistres n'a été fourni, donc le projet utilise zéro comme
valeur par défaut. C'est une limite à corriger avec une vraie source métier.

## 13. Clé composite : question obligatoire

### Question : « Dans la clé composite, c'est quoi la clé et c'est quoi la valeur ? »

**Réponse très simple à mémoriser :**

La **clé** est l'ensemble des éléments qui permet d'identifier une combinaison
unique. La **valeur** est l'information associée à cette clé.

Dans mon projet :

```text
Clé = (produit_id, code_produit)
Valeur = les informations du ou des packs associés
         (pack_id, pack_nom, valeur, ...)
```

**Exemple concret :**

```text
Clé Produit : (37, 805)
Valeur associée : { pack_nom: "Securite+", valeur: 2, ... }
```

La clé permet donc de retrouver la bonne relation Produit-Pack. La valeur est
ce que l'on récupère grâce à cette relation.

### Question : Pourquoi utiliser une clé composite dans ce projet ?

**Réponse simple :**

Une seule colonne ne suffit pas toujours à identifier correctement le produit
dans la source des packs. `produit_id` et `code_produit` sont utilisés ensemble
pour éviter de rattacher un pack au mauvais produit. Les deux conditions doivent
être vraies en même temps.

```python
packs_produit = df_packs[
    (df_packs["produit_id"] == produit["produit_id"])
    & (df_packs["code_produit"] == produit["code_produit"])
]
```

### Question : Comment fonctionne cette clé dans le parcours de recommandation ?

**Réponse simple :**

Après le choix d'un produit, `trouver_packs()` récupère ses deux identifiants,
filtre `df_packs` avec le couple `(produit_id, code_produit)` et retourne les
packs associés. Le modèle de pack classe ensuite uniquement ces candidats.

### Question : La clé composite est-elle la même chose que `VALEUR` ?

**Réponse simple :**

Non. La clé composite retrouve le groupe de packs lié au produit. `VALEUR` est
un attribut du pack. Elle peut être nécessaire pour distinguer deux options qui
ont le même `ID_PACK`. C'est pourquoi le code compare aussi `(pack_code, valeur)`
pour identifier une option de pack sans ambiguïté.

### Question : Que vérifie `/produits/relation-packs` ?

**Réponse simple :**

L'endpoint renvoie les produits avec leurs packs, les produits sans pack, les
packs orphelins et des compteurs. Un pack orphelin est une ligne de la source
qui ne retrouve aucun produit avec la clé composite. On signale l'anomalie au
lieu d'inventer ou de supprimer une relation sans validation de STAR.

## 14. Modèle de recommandation et score

### Question : Comment le produit est-il recommandé ?

**Réponse simple :**

`construire_features_client()` crée une ligne pour chaque couple client-produit.
CatBoost calcule une probabilité de souscription pour chaque ligne. Les règles
métier ajustent la probabilité, les produits déjà détenus sont retirés, puis les
résultats sont triés. Les trois premiers sont renvoyés par
`GET /recommandations/{client_id}`.

### Question : Quelles variables entrent dans le modèle ?

**Réponse simple :**

L'âge, le sexe, la situation familiale, le nombre d'enfants, la profession, le
revenu annuel, le nombre de contrats, le nombre de sinistres et le code produit.
Les catégories sont notamment le sexe, la situation familiale, la profession et
le code produit.

### Question : Pourquoi CatBoost ?

**Réponse simple :**

CatBoost gère directement les variables catégorielles. Je peux donc fournir la
profession ou le code produit comme texte, sans créer manuellement une colonne
one-hot pour chaque valeur. Je dois surtout conserver les mêmes colonnes et le
même ordre qu'à l'entraînement.

### Question : Que renvoie `predict_proba()` ?

**Réponse simple :**

Le modèle renvoie une probabilité pour chaque classe. Le code prend la
probabilité de la classe positive avec `predict_proba(X)[:, 1]`. C'est une
propension estimée, pas une certitude et pas une décision automatique de vente.

### Question : Comment est calculé le score affiché ?

**Réponse simple :**

Le score CatBoost est multiplié par un coefficient métier, limité à `0,99`,
puis converti en pourcentage.

```text
score_final = min(score_catboost * multiplicateur_metier, 0.99)
score_affiche = score_final * 100
```

**Exemple :** `0,70 x 0,60 = 0,42`, donc le score affiché est `42 %`.

### Question : Pourquoi ajouter des règles métier après le ML ?

**Réponse simple :**

Le modèle donne une estimation statistique, alors que les règles ajoutent une
contrainte de bon sens. Par exemple, un produit jeunesse est diminué pour un
client âgé et le produit santé peut être favorisé à partir de 55 ans. Le
résultat combine donc apprentissage automatique et expertise métier explicite.

### Question : Un produit déjà détenu peut-il être recommandé ?

**Réponse simple :**

Non. Les produits présents dans les contrats connus sont placés dans un
ensemble `deja_souscrits`, puis exclus des candidats. Cela évite de proposer une
deuxième fois le même produit.

### Question : Est-ce que le LLM choisit le produit ?

**Réponse simple :**

Non. CatBoost et les règles métier choisissent et classent les produits. Le
modèle de langage génère seulement une explication lisible pour le conseiller.
Cette séparation rend le classement plus stable et contrôlable.

## 15. Packs et modèle de pack

### Question : Comment choisissez-vous un pack ?

**Réponse simple :**

Pour chaque produit recommandé, l'API récupère les packs réellement associés
dans `PACK_PRODUIT.xls`. Elle construit une ligne candidate par pack avec le
profil client et les attributs du pack. Le modèle CatBoost pack calcule une
probabilité pour chaque candidat et le pack avec la probabilité maximale est
retenu.

### Question : Le modèle de pack est-il entraîné sur de vrais choix clients ?

**Réponse simple :**

Pas encore. C'est un prototype. `choix_pack` est généré par des règles
synthétiques dans `generer_dataset_pack_prototype.py`, à partir notamment de
l'âge, du revenu, des enfants et des contrats. Il faudra un historique réel de
choix de packs pour une utilisation opérationnelle.

### Question : Pourquoi garder ce prototype ?

**Réponse simple :**

Il permet de valider toute la chaîne : clé Produit-Pack, génération des
candidats, prédiction, classement et affichage. Je dois toutefois préciser que
son score n'est pas une performance métier mesurée sur des clients réels.

### Question : Que se passe-t-il si un produit n'a aucun pack ?

**Réponse simple :**

L'API retourne une liste vide et une explication adaptée. Le produit peut
rester recommandé, mais aucun pack n'est inventé.

## 16. Campagnes, segmentation et règles métier

### Question : Comment construisez-vous une audience de campagne ?

**Réponse simple :**

L'utilisateur choisit un produit, une plage de scores et éventuellement un
segment. Le backend calcule le score de ce produit pour les clients éligibles,
applique les filtres et renvoie le nombre de clients, le score moyen et une
estimation du taux de réponse.

### Question : Pourquoi le score d'une campagne dépend-il du produit ?

**Réponse simple :**

Un client peut être intéressé par un produit et pas par un autre. Le backend
calcule donc le score du produit sélectionné, au lieu d'utiliser un score
générique. En multi-produits, un client est compté une fois et son meilleur
score parmi les produits choisis est conservé.

### Question : Comment sont définis les segments ?

**Réponse simple :**

Les segments sont construits à partir des contrats et du profil : clients Auto,
clients habitation, prospects sans contrat, jeunes clients et autres clients.
Les ensembles de clients sont ensuite croisés avec les scores du produit.

### Question : Le taux de réponse est-il un vrai modèle prédictif ?

**Réponse simple :**

Non. C'est une heuristique proportionnelle au score moyen et plafonnée à 45 %.
Elle sert à simuler une estimation dans l'interface. Pour obtenir une vraie
mesure, il faudrait l'historique des messages envoyés et des réponses réelles.

### Question : Les campagnes envoient-elles vraiment les SMS et emails ?

**Réponse simple :**

Non. Le projet génère le contenu et simule le lancement. L'enregistrement de la
campagne est conservé dans MongoDB, mais aucun fournisseur réel d'envoi SMS ou
email n'est branché.

### Question : Pourquoi utiliser Pydantic ?

**Réponse simple :**

Les classes Pydantic décrivent le JSON attendu et valident automatiquement les
requêtes avant l'exécution de la logique métier. Cela limite les types
incorrects et rend le contrat de l'API plus clair.

## 17. Chatbot, RAG et IA générative

### Question : Comment fonctionne le chatbot RAG ?

**Réponse simple :**

RAG signifie que l'application recherche d'abord des documents pertinents,
puis les donne au modèle de langage comme contexte. Les garanties sont
transformées en textes, encodées avec `all-MiniLM-L6-v2` et recherchées dans un
index FAISS. Le profil client et les documents trouvés servent ensuite à
construire la réponse.

### Question : Pourquoi utiliser FAISS ?

**Réponse simple :**

FAISS recherche rapidement les vecteurs les plus proches. La recherche ne
repose donc pas uniquement sur les mots identiques : elle compare une
représentation numérique du sens approximatif de la question et des documents.

### Question : Pourquoi charger le modèle RAG à la demande ?

**Réponse simple :**

Le modèle d'embeddings est lourd. Le charger au premier appel évite de ralentir
le démarrage de l'API quand le chatbot n'est pas utilisé. Après le premier
chargement, l'index est réutilisé en mémoire.

### Question : Quelle différence entre le modèle ML et le LLM ?

**Réponse simple :**

CatBoost travaille sur des données structurées et produit un classement. Le LLM
génère du texte à partir d'un contexte. CatBoost répond à « quel produit
proposer ? », tandis que le LLM répond à « comment expliquer ou rédiger le
message ? ».

## 18. Sécurité et qualité

### Question : Comment protégez-vous l'API ?

**Réponse simple :**

FastAPI applique une dépendance globale qui vérifie l'en-tête `X-API-Key`. La
clé attendue vient de `INTERNAL_API_KEY`, côté serveur. Une requête sans clé
valide reçoit `401`.

### Question : Où doivent être les secrets ?

**Réponse simple :**

Les clés `INTERNAL_API_KEY` et `GROQ_API_KEY` doivent rester dans les variables
d'environnement du backend. Elles ne doivent être ni codées dans le dépôt, ni
envoyées au frontend, ni affichées dans les logs.

### Question : À quoi sert CORS ?

**Réponse simple :**

CORS définit les origines navigateur autorisées à appeler l'API. Le projet
utilise `FRONTEND_URL` et les ports locaux nécessaires. En production, cette
liste doit être limitée aux domaines officiels.

### Question : Comment évitez-vous d'exposer une erreur interne ?

**Réponse simple :**

Le serveur écrit le détail dans ses logs pour le diagnostic, mais renvoie une
réponse générique au navigateur. Une trace Python, un chemin local ou un secret
ne doit pas apparaître dans l'erreur HTTP.

### Question : Quelle amélioration sécurité proposeriez-vous pour la production ?

**Réponse simple :**

J'ajouterais des comptes et des rôles, HTTPS, un rate limiting, une validation
plus stricte des bornes, une gestion complète des sessions et une base de
données pour les données métier. La clé API actuelle protège un prototype
interne, mais ne remplace pas une authentification utilisateur complète.

## 19. Persistance et base de données

### Question : Les données sont-elles dans une base relationnelle ?

**Réponse simple :**

Non. Les fichiers de référence sont chargés avec Pandas en mémoire au démarrage.
MongoDB est utilisé pour persister les campagnes. C'est suffisant pour le
prototype, mais une version de production devrait centraliser clients,
contrats, recommandations et historiques dans une base métier.

### Question : Pourquoi persister les campagnes dans MongoDB ?

**Réponse simple :**

Une campagne doit rester visible après une nouvelle requête ou un redémarrage.
MongoDB conserve donc son identifiant, son statut, ses produits, ses canaux,
son nombre de destinataires et sa date de lancement.

## 20. Tests, limites et améliorations

### Question : Comment testeriez-vous le projet ?

**Réponse simple :**

Je teste d'abord les fonctions métier avec des cas simples : client inconnu,
client sans contrat, produit déjà détenu, produit inactif, produit sans pack et
clé composite inconnue. Ensuite je teste les statuts HTTP, les réponses JSON
et le parcours frontend complet. `verifier_etape_3_2.py` vérifie déjà les
fiches clients, les recommandations, les scores entre 0 et 100 et l'absence de
produit déjà détenu dans les recommandations.

### Question : Que se passe-t-il si le LLM est indisponible ?

**Réponse simple :**

Le calcul du produit ne dépend pas du LLM. L'explication générative peut être
indisponible et l'API renvoie alors une erreur contrôlée, tandis que le frontend
affiche un message. Une panne du service de texte ne doit pas bloquer tout le
moteur de recommandation.

### Question : Quelle est la principale limite du projet ?

**Réponse simple :**

Les historiques réels de souscription, de choix de packs, de sinistres et de
campagnes sont incomplets ou absents. Les profils et référentiels disponibles
permettent de valider le fonctionnement technique, mais il faudra des labels
réels pour mesurer une vraie précision métier.

### Question : Comment amélioreriez-vous le modèle ?

**Réponse simple :**

Je récupérerais des historiques fiables, définirais une cible métier claire,
séparerais les données d'entraînement et de test par client ou par période, et
mesurerais précision, rappel, top-k et calibration. Je comparerais aussi le
modèle aux règles métier et surveillerais les biais et la dérive des données.

### Question : Pourquoi ne pas laisser une IA générative décider seule ?

**Réponse simple :**

Une recommandation d'assurance doit être contrôlable et explicable. Le
classement repose sur des données structurées, un modèle identifié et des
règles visibles. Le LLM est limité à la génération de texte, ce qui réduit les
réponses imprévisibles et facilite l'audit.

## 21. Réponses rapides à mémoriser

- **Architecture :** Next.js/React/TypeScript devant, FastAPI/Python derrière,
  communication par API REST.
- **Produit :** CatBoost calcule une probabilité, les règles métier l'ajustent,
  puis les trois meilleurs produits sont renvoyés.
- **Pack :** la clé composite `(produit_id, code_produit)` retrouve les packs,
  puis le prototype CatBoost en choisit un parmi les candidats.
- **Clé et valeur :** la clé identifie la combinaison ; la valeur est
  l'information retrouvée grâce à cette combinaison.
- **LLM :** il explique et génère du texte ; il ne choisit pas le produit.
- **Campagne :** le score dépend du produit sélectionné ; le lancement est
  persisté dans MongoDB, mais l'envoi réel n'est pas branché.
- **Limite :** les contrats et les cibles d'entraînement sont encore
  synthétiques.
- **Sécurité :** clé API côté backend, variables d'environnement, CORS et
  erreurs génériques côté client.

## 22. Phrase de conclusion pour l'oral

« Mon projet sépare clairement le frontend, l'API et le moteur de
recommandation. CatBoost classe les produits, les règles métier rendent le
résultat plus cohérent, et la clé composite permet de retrouver les packs
réellement associés. J'ai aussi identifié les limites du prototype : les choix
de produits et de packs devront être réentraînés sur des historiques réels
avant une utilisation opérationnelle. »

## Annexe A - Controle dans l'application

Dans le frontend :

1. ouvrir **Produits** ;
2. ouvrir **Verifier la relation Produit -> Packs** ;
3. consulter la cle de chaque produit ;
4. consulter tous les packs associes ;
5. consulter les produits sans pack et les packs orphelins.

Dans l'API, le controle est disponible avec :

```text
GET /produits/relation-packs
```

La reponse contient notamment :

- `produits` ;
- `packs_orphelins` ;
- `produits_sans_pack` ;
- `source` ;
- `cle_composite` ;
- `controle`.

## Annexe B - Limites actuelles

Le projet fonctionne pour une demonstration, mais il ne faut pas presenter les scores comme une performance metier definitive :

1. le modele produit utilise une cible d'entrainement simulee ;
2. le modele pack utilise une cible generee par des regles fictives ;
3. les contrats utilises par l'application sont simules ;
4. les packs orphelins et les produits sans pack necessitent une validation de la source ;
5. un historique reel de choix de packs est necessaire avant un entrainement metier fiable ;
6. les scores servent a classer les candidats et ne constituent pas une probabilite commerciale validee.

## Annexe C - Verification realisee

Les controles effectues sur la version actuelle comprennent :

- compilation Python de `backend/main.py` ;
- verification TypeScript du frontend ;
- audit de `PACK_PRODUIT.xls` ;
- verification de la relation MRH `(37, 805)` ;
- test de recommandations sur plusieurs clients reels disponibles dans `01_client_reel.csv`, notamment `R66`, `R111`, `R113`, `R62` et `R178`.

Le lint global du frontend conserve des erreurs preexistantes dans certaines pages de campagnes. Elles ne concernent pas les fichiers Produit-Pack modifies.
