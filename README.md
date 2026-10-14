# STAR Assurances — Plateforme intelligente de recommandation

Plateforme full-stack d’aide à la recommandation de produits et de packs
d’assurance pour **STAR Assurances**. L’application combine une API FastAPI,
des modèles de machine learning et une interface Next.js afin d’aider un
conseiller à analyser le profil d’un client, identifier les offres pertinentes
et préparer des campagnes personnalisées.

> Projet académique et prototype fonctionnel. Les modèles et certaines données
> doivent être validés sur un historique métier réel avant toute utilisation
> en production.

## Fonctionnalités

- Dashboard avec statistiques globales.
- Recherche et consultation des clients.
- Fiche client avec contrats, produits détenus et événements.
- Recommandation de produits avec score et explication personnalisée.
- Recommandation de packs associés au produit retenu.
- Segmentation et constitution d’audiences de campagne.
- Répartition des clients par score et par produit.
- Génération de contenus Email/SMS.
- Historique et lancement simulé de campagnes.
- Chatbot conversationnel avec recherche documentaire (RAG).
- API REST documentée automatiquement par FastAPI.

## Architecture

```text
┌──────────────────────────────┐
│ Frontend Next.js / React      │
│ TypeScript + Tailwind CSS     │
└──────────────┬───────────────┘
               │ API REST
┌──────────────▼───────────────┐
│ Backend FastAPI               │
│ Recommandation + campagnes    │
│ Chatbot + logique métier      │
└───────┬──────────────┬────────┘
        │              │
┌───────▼──────┐ ┌─────▼────────┐
│ Données CSV  │ │ MongoDB      │
│ Excel, PKL   │ │ Campagnes    │
└──────────────┘ └──────────────┘
```

### Technologies

| Composant | Technologies |
| --- | --- |
| Frontend | Next.js, React, TypeScript, Tailwind CSS |
| Backend | Python, FastAPI, Pydantic, Uvicorn |
| Machine learning | CatBoost, scikit-learn, pandas, joblib |
| Recherche documentaire | FAISS, sentence-transformers |
| IA générative | Ollama en local avec le modèle `qwen2.5:7b` |
| Persistance | MongoDB pour les campagnes |
| Infrastructure locale | Docker Compose |

## Structure du dépôt

```text
.
├── backend_api_assurance_v3/
│   └── backend/
│       ├── main.py                 # API FastAPI et logique métier
│       ├── data/                   # Données et référentiels locaux
│       ├── model/                  # Modèles ML et artefacts
│       ├── requirements.txt
│       └── README*.md
├── frontend_assurance_v12/
│   └── frontend/
│       ├── app/                    # Pages Next.js
│       ├── components/             # Composants d'interface
│       ├── lib/api.ts              # Client API frontend
│       └── package.json
├── docker-compose.yml              # Service MongoDB local
└── README.md
```

## Prérequis

- Python 3.10 ou version ultérieure recommandé.
- Node.js 20 ou version ultérieure recommandé.
- npm.
- Docker Desktop, uniquement si la persistance MongoDB est nécessaire.
- Ollama installé et le modèle `qwen2.5:7b` téléchargé si les explications IA,
  le chatbot ou la génération de messages doivent être activés.

## Installation

### 1. Backend

Depuis PowerShell :

```powershell
cd backend_api_assurance_v3\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 2. Ollama (IA locale, optionnel)

Le backend utilise l’API compatible OpenAI d’Ollama sur
`http://localhost:11434/v1`. Les explications, les messages de campagne et les
réponses du chatbot sont ainsi générés localement, sans envoyer les données
clients à un service cloud.

Installez Ollama depuis [ollama.com](https://ollama.com), démarrez le service,
puis téléchargez le modèle utilisé par l’application :

```powershell
ollama pull qwen2.5:7b
```

Vérifiez que le modèle est disponible :

```powershell
ollama list
```

Le service Ollama doit être accessible avant d’utiliser les fonctions d’IA
générative.

Lancez l’API :

```powershell
uvicorn main:app --reload
```

L’API est disponible à l’adresse `http://127.0.0.1:8000`.

Documentation interactive :

- Swagger UI : `http://127.0.0.1:8000/docs`
- ReDoc : `http://127.0.0.1:8000/redoc`

### 3. MongoDB local (optionnel)

À la racine du projet :

```powershell
docker compose up -d mongodb
```

MongoDB est exposé sur `mongodb://localhost:27017`.

### 4. Frontend

Dans un second terminal :

```powershell
cd frontend_assurance_v12\frontend
npm install
```

Créez un fichier `.env.local` :

```dotenv
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

Démarrez l’application :

```powershell
npm run dev
```

L’interface est disponible à l’adresse `http://localhost:3000`.

## Parcours de recommandation

Le parcours principal suit les étapes suivantes :

```text
Client
  → préparation du profil
  → modèle CatBoost produit
  → règles métier
  → produit recommandé
  → recherche des packs associés
  → modèle de pack prototype
  → explication personnalisée
```

L’endpoint principal est :

```http
GET /recommandations/{client_id}?avec_explication=true
```

La relation entre un produit et ses packs repose sur la clé composite
`(produit_id, code_produit)`. Les packs sont chargés depuis le référentiel
`backend_api_assurance_v3/backend/data/PACK_PRODUIT.xls`.

## Endpoints principaux

| Domaine | Endpoint | Méthode |
| --- | --- | --- |
| Santé | `/` | GET |
| Dashboard | `/dashboard/stats` | GET |
| Clients | `/clients` | GET |
| Client | `/clients/{client_id}` | GET |
| Produits détenus | `/clients/{client_id}/produits-detenus` | GET |
| Recommandations | `/recommandations/{client_id}` | GET |
| Produits | `/produits` | GET |
| Relation packs | `/produits/relation-packs` | GET |
| Segments | `/campagnes/segments` | GET |
| Audiences | `/campagnes/audience` | GET |
| Campagnes | `/campagnes/lancer` | POST |
| Message IA | `/campagnes/generer-message` | POST |
| Chatbot | `/chat` | POST |

La liste complète et les schémas de requêtes/réponses sont disponibles dans
Swagger après le démarrage du backend.

## Données et modèles

Le backend charge au démarrage des données locales ainsi que des artefacts
présents dans `backend_api_assurance_v3/backend/model/`. Les fichiers sources
peuvent contenir des données volumineuses ou de démonstration ; ils ne doivent
pas être remplacés par des données clients réelles sans contrôle d’accès,
anonymisation et validation de conformité.

Le modèle de recommandation de produits est distinct du modèle de packs. Le
modèle de packs présent dans le dépôt est un **prototype entraîné sur des
choix fictifs** et ne constitue pas une mesure de performance métier.

## Vérification

### Backend

Depuis `backend_api_assurance_v3\backend` :

```powershell
python -m compileall .
```

### Frontend

Depuis `frontend_assurance_v12\frontend` :

```powershell
npm run lint
npm run build
```

## Sécurité et bonnes pratiques

- Ne jamais committer `.env` ou une autre clé secrète.
- Ne jamais exposer de configuration LLM sensible dans le frontend.
- Ne pas utiliser de données clients réelles dans un environnement de
  démonstration sans anonymisation.
- Vérifier CORS, authentification et autorisations avant un déploiement public.
- Remplacer les données et modèles prototypes par des versions validées avant
  une utilisation opérationnelle.

## Limites connues

- Le modèle de recommandation de packs est encore expérimental.
- Les campagnes sont principalement préparées et historisées ; l’envoi réel
  de SMS ou d’emails nécessite une intégration avec un fournisseur externe.
- Les performances et la pertinence des recommandations doivent être évaluées
  avec des indicateurs métier et un historique de décisions validé.
- La configuration de production (authentification, secrets, observabilité,
  déploiement et sauvegardes) reste à compléter.

## Licence

Ce dépôt est destiné à un usage académique et de démonstration. Aucune licence
de redistribution n’est définie à ce stade.
