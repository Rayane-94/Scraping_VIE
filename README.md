# vie-watcher

[![ci](https://github.com/Rayane-94/Scraping_VIE/actions/workflows/ci.yml/badge.svg)](https://github.com/Rayane-94/Scraping_VIE/actions/workflows/ci.yml)

Bot qui surveille les offres VIE de [mon-vie-via.businessfrance.fr](https://mon-vie-via.businessfrance.fr) et envoie sur Telegram les nouvelles offres qui correspondent à un profil.

Le profil est entièrement réglable : métier, mots-clés, pays, technos. Il est configuré ici pour du développement full stack, mais il peut servir pour n'importe quel métier (finance, marketing, ingénierie…) en modifiant `config.json`.

Le bot tourne sur **GitHub Actions**, le service de GitHub qui exécute du code sur ses propres serveurs. Il se lance tout seul 3 fois par jour (6h, 12h, 18h UTC) : pas besoin de serveur ni de PC allumé.

## Installer son propre bot

### 1. Récupérer le projet

Créer un repo vide sur GitHub (sans README), puis :

```bash
git clone https://github.com/Rayane-94/Scraping_VIE.git vie-watcher
cd vie-watcher
git rm seen.json
git commit -m "Reset seen.json"
git remote set-url origin https://github.com/<ton-pseudo>/<ton-repo>.git
git push -u origin main
```

`seen.json` est la mémoire du bot (voir [Fonctionnement](#fonctionnement)). Celui du repo d'origine contient les offres déjà envoyées à son propriétaire : si on le garde, ces offres ne seront jamais envoyées. Il suffit de le supprimer, le bot le recrée tout seul au premier lancement.

### 2. Créer le bot Telegram

1. Sur Telegram, ouvrir [@BotFather](https://t.me/BotFather) et envoyer `/newbot`.
2. Choisir un nom, puis un identifiant qui finit par `bot`.
3. BotFather renvoie un token (`123456789:AAH...`).
4. Ouvrir la conversation avec **son** bot (lien `t.me/...` donné par BotFather), appuyer sur **Démarrer** et envoyer un message.
5. Aller sur `https://api.telegram.org/bot<TOKEN>/getUpdates` et récupérer le nombre dans `"chat":{"id": ...}`.

Si `getUpdates` renvoie `"result":[]`, c'est que le message a été envoyé à BotFather et pas au bot.

### 3. Ajouter les secrets

Dans le repo GitHub : **Settings › Secrets and variables › Actions › New repository secret**

| Secret | Valeur |
|---|---|
| `TELEGRAM_TOKEN` | le token donné par BotFather |
| `TELEGRAM_CHAT` | le chat id récupéré à l'étape précédente |

### 4. Adapter `config.json` à son métier

C'est le seul fichier à modifier pour changer le type d'offres reçues. Les filtres portent sur le **titre** de l'offre, sans tenir compte des majuscules ni des accents (écrire `developpeur`, pas `développeur`).

| Clé | Rôle | Exemple |
|---|---|---|
| `include` | le titre doit contenir au moins un de ces mots | `"developpeu(r\|se)"`, `"devops"` |
| `exclude` | les titres à écarter | `"business develop"`, `"sales"` |
| `countries` | pays ciblés, `[]` pour tous | `["CA", "belgique"]` |
| `highlight` | technos ou compétences recherchées dans la description, affichées dans le message | `"react"`, `"php"` |

Exemple pour un profil contrôle de gestion :

```json
"include": ["controle(ur|use)? de gestion", "financial controller", "\\bfp&a\\b"],
"exclude": ["stage"],
"highlight": ["excel", "sap", "power ?bi"]
```

Pour vérifier la liste des offres retenues sans rien envoyer (Node.js 22.18 ou plus) :

```bash
npm run dry-run
```

Une fois satisfait, commiter et pousser `config.json`.

### 5. Lancer le bot

Sur GitHub, onglet **Actions** › **vie-watcher** › **Run workflow**.

Ce premier lancement manuel envoie toutes les offres qui correspondent au profil. Ensuite, le bot tourne tout seul 3 fois par jour et n'envoie que les nouvelles offres.

Pour changer les horaires, modifier la ligne `cron` dans `.github/workflows/vie.yml` (en heure UTC).

## Fonctionnement

À chaque lancement, `src/main.ts` :

1. récupère toutes les offres publiées sur le site ;
2. garde celles qui correspondent à `config.json` ;
3. envoie sur Telegram celles qui ne sont pas encore dans `seen.json` ;
4. ajoute les offres envoyées dans `seen.json`.

### seen.json

C'est la mémoire du bot : la liste des offres déjà envoyées, pour ne pas recevoir deux fois la même.

GitHub Actions repart d'une machine vierge à chaque lancement : un fichier modifié pendant l'exécution est perdu à la fin. Le workflow commite donc `seen.json` dans le repo après chaque passage, pour que le lancement suivant le retrouve. Les commits `chore: maj seen.json` dans l'historique viennent de là.

Il n'y a rien à faire dessus : ni le créer, ni le modifier. Le supprimer revient à tout renvoyer au prochain lancement.

Si l'API ne répond pas ou renvoie une liste vide, rien n'est envoyé ni modifié. Une offre dont l'envoi a échoué n'est pas ajoutée à `seen.json` et sera renvoyée au passage suivant.

## Notifications avec ntfy (alternative à Telegram)

[ntfy.sh](https://ntfy.sh) envoie des notifications sur l'application mobile ntfy, sans créer de bot. Il suffit d'ajouter un secret `NTFY_TOPIC` (un nom difficile à deviner) et de s'abonner à ce topic dans l'application.

L'usage de base est gratuit. ntfy propose aussi une offre payante (ntfy Pro) pour réserver son nom de topic et relever les limites d'envoi. Attention : un topic gratuit est public, toute personne qui connaît son nom peut lire les messages.

## Structure du code

Le code est en TypeScript. Node.js l'exécute directement (type stripping), sans étape de compilation : `tsc` sert uniquement à vérifier les types.

```
src/
  main.ts      orchestration : config → offres → filtre → notifs → seen.json
  vie.ts       client de l'API Business France (clé, pagination, dédoublonnage)
  filter.ts    filtres include / exclude / pays et technos à mettre en avant
  format.ts    mise en forme du message
  notify.ts    envoi Telegram et ntfy
  seen.ts      lecture, écriture atomique et purge de seen.json
  http.ts      fetch avec timeout, retry et masquage des secrets dans les logs
  text.ts      normalisation (accents, casse), échappement HTML, dates
  types.ts     types partagés (offre, config, seen.json, canaux)
test/          tests unitaires (node:test)
```

## Développement

```bash
npm install
npm run dry-run     # lance le bot sans rien envoyer
npm run typecheck   # vérifie les types avec tsc
npm test            # tests unitaires
```

La CI (`.github/workflows/ci.yml`) lance le typecheck et les tests à chaque push et pull request.

## Stack

| Élément | Utilisation |
|---|---|
| **TypeScript** | typage strict (`strict`, `noUncheckedIndexedAccess`), vérifié par `tsc` |
| **Node.js 24** | exécution native du TypeScript, `fetch` natif, tests avec `node:test` |
| **GitHub Actions** | exécution planifiée (`cron`) et CI (typecheck + tests) |
| **GitHub Secrets** | stockage du token et du chat id Telegram |
| **Git** | sauvegarde de `seen.json` par un commit automatique |
| **API Business France** | source des offres (`civiweb-api-prd.azurewebsites.net/api/Offers/search`), la même que celle utilisée par le site |
| **Telegram Bot API** | envoi des messages (`sendMessage`, mise en forme HTML) |
| **ntfy.sh** | canal de notification optionnel |
| **JSON** | configuration (`config.json`) et mémoire (`seen.json`) |
