"""Vérifie l'intégration des vraies données via l'API locale déjà démarrée."""

import sys

import requests


API_URL = "http://127.0.0.1:8000"
TIMEOUT = 10


def get_json(path: str):
    """Appelle un endpoint GET et retourne la réponse HTTP et son JSON."""
    try:
        response = requests.get(f"{API_URL}{path}", timeout=TIMEOUT)
    except requests.RequestException as exc:
        return None, None, f"API inaccessible : {exc}"

    try:
        data = response.json()
    except ValueError:
        data = None
    return response, data, None


def main() -> int:
    echecs: list[str] = []
    clients_testes: list[str] = []

    print("Etape 1 - liste des clients")
    response, data, erreur = get_json("/clients?recherche=&page=1&taille_page=20")
    if erreur:
        echecs.append(f"GET /clients : {erreur}")
    elif response.status_code != 200:
        echecs.append(f"GET /clients : statut HTTP {response.status_code}")
    elif not isinstance(data, dict) or not isinstance(data.get("clients"), list):
        echecs.append("GET /clients : champ 'clients' absent ou invalide")
    else:
        ids = [client.get("client_id") for client in data["clients"]]
        if not ids or any(not isinstance(client_id, str) or not client_id.startswith("R") for client_id in ids):
            echecs.append("GET /clients : les identifiants ne commencent pas tous par 'R'")
        else:
            print(f"  OK - {len(ids)} identifiants clients commencent par R")

        ids_uniques = list(dict.fromkeys(client_id for client_id in ids if isinstance(client_id, str)))
        if "R49" in ids_uniques:
            clients_testes = ["R49"] + [client_id for client_id in ids_uniques if client_id != "R49"][:4]
        else:
            echecs.append("GET /clients : R49 n'est pas présent dans la première page")
            clients_testes = ids_uniques[:5]

    if len(clients_testes) < 5:
        echecs.append(f"Sélection des clients : seulement {len(clients_testes)} client(s) disponible(s)")
    print(f"  Clients sélectionnés : {', '.join(clients_testes) if clients_testes else 'aucun'}")

    succes_clients = 0
    succes_recommandations = 0

    print("Etape 2 - fiches clients")
    for client_id in clients_testes:
        response, _, erreur = get_json(f"/clients/{client_id}")
        if erreur:
            echecs.append(f"{client_id} fiche client : {erreur}")
        elif response.status_code != 200:
            echecs.append(f"{client_id} fiche client : statut HTTP {response.status_code}")
        else:
            succes_clients += 1

    print("Etape 3 - recommandations et produits détenus")
    for client_id in clients_testes:
        response, recommandations_data, erreur = get_json(f"/recommandations/{client_id}")
        if erreur:
            echecs.append(f"{client_id} recommandations : {erreur}")
            continue
        if response.status_code != 200:
            echecs.append(f"{client_id} recommandations : statut HTTP {response.status_code}")
            continue
        if not isinstance(recommandations_data, dict) or not isinstance(recommandations_data.get("recommandations"), list):
            echecs.append(f"{client_id} recommandations : champ 'recommandations' absent ou invalide")
            continue

        response, produits_data, erreur = get_json(f"/clients/{client_id}/produits-detenus")
        if erreur:
            echecs.append(f"{client_id} produits détenus : {erreur}")
            continue
        if response.status_code != 200 or not isinstance(produits_data, dict):
            statut = response.status_code if response is not None else "inconnu"
            echecs.append(f"{client_id} produits détenus : statut HTTP {statut}")
            continue

        produits_recommandes = recommandations_data["recommandations"]
        produits_detenus = {
            produit.get("produit_code")
            for produit in produits_data.get("produits", [])
            if isinstance(produit, dict)
        }
        client_echec = False
        for recommandation in produits_recommandes:
            produit_code = recommandation.get("produit")
            score = recommandation.get("score")
            if not isinstance(score, (int, float)) or not 0 <= score <= 100:
                echecs.append(f"{client_id} recommandations : score invalide pour {produit_code!r} ({score!r})")
                client_echec = True
            if produit_code in produits_detenus:
                echecs.append(f"{client_id} recommandations : produit déjà détenu recommandé ({produit_code})")
                client_echec = True

        if not client_echec:
            succes_recommandations += 1

    succes_complets = sum(
        1
        for client_id in clients_testes
        if not any(client_id in echec for echec in echecs)
    )

    print("\nRésumé")
    print(f"  Clients testés : {len(clients_testes)}")
    print(f"  Fiches clients réussies : {succes_clients}/{len(clients_testes)}")
    print(f"  Vérifications recommandations réussies : {succes_recommandations}/{len(clients_testes)}")
    print(f"  Clients entièrement réussis : {succes_complets}/{len(clients_testes)}")
    print(f"  Échecs : {len(echecs)}")
    if echecs:
        for echec in echecs:
            print(f"  - {echec}")
        return 1

    print("  Tous les contrôles sont réussis.")
    return 0


if __name__ == "__main__":
    sys.exit(main())