# vie-watcher

Surveille les offres VIE de [mon-vie-via.businessfrance.fr](https://mon-vie-via.businessfrance.fr) et envoie les nouvelles offres pertinentes sur Telegram (ou ntfy.sh), via GitHub Actions 3 fois par jour (6h, 12h, 18h UTC). Aucun PC allumé nécessaire.

## Fonctionnement

`check.mjs` (Node 22, zéro dépendance) :

1. Lit la clé `X-API-KEY` publique dans la page d'accueil du site (elle peut changer, on la relit à chaque run).
2. Récupère **toutes** les offres via l'API JSON du site (`POST /api/Offers/search`, pages de 100, avec timeout et 3 tentatives).
3. Filtre sur le **titre** avec `config.json`.
4. Notifie les offres absentes de `seen.json`, en indiquant les technos du profil citées dans l'annonce.
5. Écrit `seen.json` (seulement les offres réellement notifiées). Le workflow le commite.

Garde-fous : rien n'est écrit si l'API échoue, renvoie 0 offre ou une pagination incomplète. Une notif qui échoue sera retentée au run suivant.

## config.json

Les regex sont insensibles à la casse et aux accents : écrire `developpeur`, pas `développeur`.

| Clé | Rôle |
|---|---|
| `include` | le titre doit matcher au moins une regex |
| `exclude` | le titre ne doit en matcher aucune (sales, business developer…) |
| `countries` | vide = tous les pays ; sinon codes (`"BE"`, `"CA"`) ou noms (`"belgique"`) |
| `highlight` | technos recherchées dans la description, affichées dans la notif |

## Installation

1. Pousser ce repo sur GitHub. Il peut être public : aucune valeur sensible n'est dans le code, tout passe par les secrets.
2. Créer un bot Telegram : écrire à [@BotFather](https://t.me/BotFather), `/newbot`, récupérer le token.
3. Envoyer un message au bot, puis ouvrir `https://api.telegram.org/bot<TOKEN>/getUpdates` pour lire `chat.id`.
4. Dans le repo : *Settings › Secrets and variables › Actions*, ajouter `TG_TOKEN` et `TG_CHAT`.
   - Alternative : `NTFY_TOPIC` (un nom de topic difficile à deviner) et l'app ntfy sur le téléphone.
5. *Actions › vie-watcher › Run workflow* pour un premier test.

Le premier run envoie toutes les offres pertinentes du moment (25 messages max, puis un récapitulatif).

## En local

```bash
node check.mjs --dry-run          # affiche les nouvelles offres, n'envoie rien, n'écrit rien
TG_TOKEN=... TG_CHAT=... node check.mjs
```

## À savoir

- GitHub désactive les crons d'un repo sans activité pendant 60 jours. Les commits de `seen.json` comptent, mais sans nouvelle offre pendant 2 mois il faudra réactiver le workflow.
- Les entrées de `seen.json` de plus de 180 jours sont purgées.
