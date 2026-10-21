# Vigie LFMN — Nice Côte d’Azur

Tableau de bord du trafic aérien autour de Nice : carte interactive, mode radar, suivi des avions, graphiques d’altitude et prévisions de vent. Interface en français, adaptée aux ordinateurs et aux mobiles.

## Ouvrir dans Chrome

Pour consulter l’instantané réel intégré, télécharger `vigie-lfmn.html` puis l’ouvrir dans Chrome.

Pour obtenir les positions actualisées, utiliser le serveur local : certaines API ADS-B bloquent les requêtes directement émises par une page HTML (CORS).

### Démarrage avec le direct

Python 3.9 ou supérieur, sans dépendance supplémentaire :

```bash
git clone https://github.com/jbleroy75/avion.git
cd avion
python3 vigie-server.py
```

Sur Windows, utiliser `python vigie-server.py`. Le navigateur s’ouvre automatiquement. Dans Chrome, accéder à **http://127.0.0.1:8765/**.

Laisser le terminal ouvert ; `Ctrl+C` arrête le serveur. Les lanceurs `lancer-vigie.command` (macOS) et `lancer-vigie.bat` (Windows) sont aussi fournis.

Options :

```bash
python3 vigie-server.py --port 9000 --no-browser
```

Le serveur écoute uniquement sur `127.0.0.1`. Il relaie deux endpoints fixes, trafic et météo ; aucune clé API n’est nécessaire.

## Fonctionnalités

- Carte géographique et mode radar, périmètres de 10, 30 et 60 NM.
- Sélection d’un avion, altitude, vitesse sol, route, vitesse verticale, distance et transpondeur.
- Recherche par indicatif, immatriculation, type ou identifiant ICAO.
- Trajectoires et courbes d’altitude construites avec les positions reçues pendant la session.
- Vent, rafales, température, pression au niveau de la mer et prévisions horaires.
- Horodatage des relevés, signalement des réponses périmées et instantané réel de secours.

## Données et limites

| Données | Source | Actualisation |
| --- | --- | --- |
| Positions ADS-B, dans un rayon de 60 NM | [adsb.lol](https://api.adsb.lol/docs), repli airplanes.live | 15 secondes |
| Météo et prévisions | [Open-Meteo](https://open-meteo.com/en/docs) | 10 minutes |
| Fond de carte détaillé | [OpenStreetMap](https://www.openstreetmap.org/copyright) | Chargement en ligne |
| Littoral intégré | [Natural Earth](https://www.naturalearthdata.com/) | Données géographiques intégrées |

Les catégories de montée et de descente sont déduites du mouvement ; elles ne confirment pas l’origine ou la destination du vol. Le trafic détecté n’est pas un tableau des vols commerciaux. Les données météo sont issues de modèles et ne constituent pas un METAR ou un QNH mesuré à l’aéroport.

Le direct dépend d’Internet, de la couverture ADS-B et de la disponibilité des fournisseurs. Le fichier HTML conserve un instantané horodaté en cas d’échec ; il ne le présente pas comme un flux en direct. Les graphiques d’historique ne contiennent pas de données inventées.

**Usage informatif uniquement, non destiné à la navigation aérienne.**

## Fichiers

- `vigie-lfmn.html` : interface autonome, Leaflet intégré.
- `vigie-server.py` : serveur HTTP et relais local des données.
- `lancer-vigie.command` / `lancer-vigie.bat` : lanceurs macOS / Windows.
- `LIRE-MOI.txt` : démarrage rapide.

Une publication HTML statique seule ne fournit pas le relais nécessaire au direct ADS-B.
