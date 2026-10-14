# Frontend — Plateforme IA de recommandation d'assurance

Interface web (Next.js + React + Tailwind) connectee a l'API FastAPI.

## Pages incluses (MVP)
- Dashboard (/) — statistiques globales (clients, contrats, top produits)
- Liste des clients (/clients) — recherche et navigation
- Fiche client (/clients/[id]) — profil, recommandations IA avec scores, chatbot RAG

## 1. Installation

Assurez-vous d'avoir Node.js installe (node -v pour verifier), puis :

npm install

## 2. Configuration

Le fichier .env.local contient deja la configuration par defaut :
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000

Ne le modifiez que si votre API tourne sur une autre adresse.

## 3. Lancer le backend d'abord

IMPORTANT : ce frontend ne fonctionne que si votre API FastAPI tourne en parallele
(voir le projet backend/, commande : uvicorn main:app --reload).

## 4. Lancer le frontend

Dans un second terminal (gardez le premier avec l'API ouvert) :

npm run dev

Ouvrez http://localhost:3000

## Structure du projet

frontend/
  app/
    page.tsx              -> Dashboard
    clients/page.tsx      -> Liste des clients
    clients/[id]/page.tsx -> Fiche client (recommandations + chat)
  components/
    Sidebar.tsx
    ScoreGauge.tsx         -> Jauge circulaire de score
    ChatPanel.tsx          -> Chatbot conversationnel
  lib/
    api.ts                 -> Tous les appels a l'API FastAPI

## Pour aller plus loin (pages non incluses dans ce MVP)

D'apres le cahier des charges, il resterait a ajouter : page Devis, tableau de
bord Manager, generation de PDF. La structure actuelle (un dossier par page
dans app/) permet de les ajouter facilement sur le meme modele.
