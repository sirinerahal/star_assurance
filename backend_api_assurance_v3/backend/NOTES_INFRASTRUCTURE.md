# Notes infrastructure — STAR Assurances

Documentation des décisions techniques d'infrastructure (LLM, base de données),
en complément de `NOTES_DONNEES.md` qui couvre les décisions liées aux données.

## Migration LLM : Groq → Ollama (Phase 4)

**Contexte :** migration demandée par l'encadrant, pour confidentialité (LLM
local, aucune donnée client envoyée à un tiers) et indépendance vis-à-vis
d'un service cloud tiers (Groq).

**Choix technique :** utilisation du SDK `openai` pointé vers l'endpoint
compatible OpenAI d'Ollama (`http://localhost:11434/v1`, `api_key="ollama"`
factice). Ce choix permet de garder exactement la même syntaxe d'appel
(`.chat.completions.create(...)`, `.choices[0].message.content`) que
l'ancien code Groq, sans réécrire la logique de traitement des réponses.

**Modèle :** `qwen2.5:7b` (4.7 Go), conforme à la consigne de l'encadrant.

**4 sites migrés dans `main.py` :**
1. Explication de recommandation (temperature 0.4)
2. Génération SMS de campagne (temperature 0.6)
3. Génération email de campagne (temperature 0.6, réponse JSON avec repli
   si le modèle ne respecte pas le format)
4. Chatbot RAG (temperature 0.3)

**Performance observée :**
- Répartition GPU/CPU : `55%/45% CPU/GPU` (`ollama ps`), carte NVIDIA RTX
  2050 (4 Go VRAM) insuffisante pour charger entièrement le modèle
  (5.1 Go) en VRAM — Ollama répartit automatiquement le reste sur CPU/RAM.
- Temps de réponse observé : ~20-25 secondes par génération (contre
  quasi-instantané avec Groq, qui utilise du matériel cloud spécialisé LPU).
- Décision : conserver `qwen2.5:7b` tel quel (consigne de l'encadrant),
  latence jugée acceptable pour un outil interne conseiller (pas d'usage
  client final en temps réel).

**Validation confidentialité :** test réalisé Wi-Fi coupé — toutes les
générations (explication, SMS, email, chatbot) ont fonctionné normalement,
confirmant l'indépendance totale vis-à-vis d'internet.

**Point de vigilance identifié :** le contexte envoyé au chatbot RAG
(`construire_contexte_client()`) ne contenait initialement pas l'ancienneté
du client — corrigé en ajoutant le calcul d'ancienneté (même logique que
celle déjà utilisée dans le prompt d'explication de recommandation), plus
`nb_enfants` et `nb_sinistres_total` pour harmoniser les deux prompts.

## Migration stockage campagnes : JSON → MongoDB (Phase 5)

**Périmètre :** volontairement limité à `campagnes.json` uniquement — les
autres données (clients, produits, garanties...) restent en fichiers plats
CSV/JSON tant que leur schéma n'est pas stabilisé.

**Choix d'infrastructure : MongoDB via Docker**, plutôt qu'une installation
locale classique, en anticipation de la Phase 8 (déploiement, `docker-compose.yml`).

**Configuration :**
- `docker-compose.yml` à la racine du projet, service unique `mongodb`
- Image `mongo:7.0` (version figée, pas `latest`, pour la reproductibilité)
- Port `27017:27017`, volume nommé `mongodb_data` pour la persistance
- Base : `star_assurance_db`, collection : `campagnes`

**Point de vigilance résolu :** un service MongoDB Windows local tournait
déjà sur le port `27017` (installation antérieure, base `DeWini` non liée
au projet) — conflit de port résolu en arrêtant ce service
(`Stop-Service -Name MongoDB`, nécessite un terminal administrateur) avant
de démarrer le conteneur Docker.

**Migration du code dans `main.py` :**
- `charger_campagnes()` : lecture via `collection_campagnes.find()`
  (exclusion du champ `_id` interne MongoDB pour garder le même format de
  retour qu'avant)
- `sauvegarder_campagnes()` : supprimée (pattern "charger tout / réécrire
  tout" remplacé par un `insert_one()` ciblé, plus adapté à MongoDB)
- `lancer_campagne()` : utilise désormais `collection_campagnes.insert_one(enregistrement)`
- `lister_campagnes()` : inchangée (continue d'utiliser `charger_campagnes()`,
  qui elle est migrée en interne)

**Bug rencontré et corrigé :** `insert_one()` modifie l'objet Python en
place en y ajoutant un champ `_id` de type `ObjectId`, non sérialisable en
JSON par FastAPI → `TypeError: 'ObjectId' object is not iterable` au retour
de `lancer_campagne()`. Corrigé avec `enregistrement.pop("_id", None)`
juste après l'insertion, avant le `return`.

**Ancien fichier `campagnes.json` :** conservé sur le disque pour l'instant
(non supprimé), mais plus lu ni écrit par le code depuis cette migration.
Candidat à déplacer vers `_a_verifier_avant_suppression/` une fois la
stabilité de MongoDB confirmée en usage prolongé.

## Nettoyage de projet (entre Phase 4 et Phase 5)

Fichiers déplacés vers `_a_verifier_avant_suppression/` (copiés avant
suppression, pas supprimés directement, par prudence) :
1. `backend_api_assurance_v3/venv/` — ancien environnement virtuel Python,
   doublon non utilisé de `.venv` (racine du projet, actif)
2. `catboost_info/` — logs auto-générés d'entraînement CatBoost, régénérables
3. `modele_recommandation_final.pkl` — remplacé et validé par la version `_v2`
4. `colonnes_modele.pkl` — remplacé et validé par la version `_v2`
5. `colonnes_categorielles.pkl` — remplacé et validé par la version `_v2`
6. `tsconfig.tsbuildinfo` — cache TypeScript frontend, régénéré automatiquement
7. `test_stacking.py` — approche de stacking abandonnée au profit de CatBoost