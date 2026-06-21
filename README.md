# 🐙 Poul le Paulpe

Bot Discord d'annonces live pour la **Coupe du Monde 2026** (FIFA World Cup, 48 équipes, 11 juin – 19 juillet 2026).

Poul surveille les matchs et annonce en direct : coup d'envoi, chaque but (avec buteur et minute), mi-temps, et fin de match — le tout avec un ton bien décalé.

---

## Prérequis

- [Node.js](https://nodejs.org/) v18 ou supérieur
- Un compte [RapidAPI](https://rapidapi.com/) avec accès à **API-Football** (plan gratuit)
- Un bot Discord avec un token valide

---

## 1. Créer le bot Discord

1. Va sur le [Portail développeur Discord](https://discord.com/developers/applications)
2. Crée une nouvelle application → **New Application**
3. Dans **Bot** → **Add Bot** → copie le **Token** (tu en auras besoin dans `.env`)
4. Dans **OAuth2 > URL Generator** :
   - Scopes : `bot`
   - Permissions : `Send Messages`, `Embed Links`
5. Ouvre l'URL générée pour **inviter le bot sur ton serveur**
6. Récupère l'**ID du channel** où le bot doit poster (clic droit sur le channel → "Copier l'identifiant" — active le mode développeur dans les paramètres Discord si besoin)

---

## 2. Configurer l'API-Football

1. Crée un compte sur [RapidAPI](https://rapidapi.com/)
2. Abonne-toi à [API-Football](https://rapidapi.com/api-sports/api/api-football) (plan **Basic** gratuit)
3. Copie ta **X-RapidAPI-Key** depuis le dashboard

> **Limite du plan gratuit :** ~100 requêtes/jour. Le bot est conçu pour rester dans ce quota en ne pollant qu'autour des horaires de matchs.

---

## 3. Installation

```bash
git clone https://github.com/sneadz/poul_le_paulpe.git
cd poul_le_paulpe
npm install
```

Copie le fichier d'exemple et remplis tes valeurs :

```bash
cp .env.example .env
```

Édite `.env` :

```env
DISCORD_TOKEN=ton_token_bot_discord
DISCORD_CHANNEL_ID=id_du_channel_discord
RAPIDAPI_KEY=ta_cle_rapidapi
WORLD_CUP_LEAGUE_ID=1
WORLD_CUP_SEASON=2026
POLL_INTERVAL_MS=90000
```

---

## 4. Lancer le bot

```bash
# Production
npm start

# Développement (redémarre automatiquement sur changement de fichier)
npm run dev
```

Au démarrage, Poul :
1. Vérifie que toutes les variables d'env sont présentes
2. Se connecte à Discord
3. Récupère les matchs du jour via l'API
4. Calcule les fenêtres de polling (actif uniquement autour des horaires de matchs)
5. Annonce les événements en live dans le channel configuré

---

## Structure du projet

```
src/
├── index.js    # Point d'entrée
├── bot.js      # Client Discord
├── tracker.js  # Orchestrateur de polling et détection d'événements
├── api.js      # Wrapper API-Football
├── embeds.js   # Constructeurs d'embeds Discord
└── state.js    # Persistance légère (data/state.json)
```

---

## Ajuster la fréquence de poll

La variable `POLL_INTERVAL_MS` dans `.env` contrôle l'intervalle entre deux appels API pendant un match.

| Valeur | Délai | Appels pour un match de 90min |
|---|---|---|
| `60000` | 60s | ~90 appels |
| `90000` | 90s | ~60 appels *(défaut)* |
| `120000` | 2min | ~45 appels |

Vérifie le nombre de matchs simultanés sur la journée la plus chargée et adapte en conséquence pour rester sous les 100 req/jour.

---

## Déploiement (Railway / Render)

1. Pousse le code sur GitHub
2. Connecte ton repo à Railway ou Render
3. Configure les variables d'environnement directement dans leur interface (pas de `.env` à uploader)
4. Lance avec `npm start`

> Le fichier `data/state.json` est régénéré à chaque redémarrage — les événements déjà postés avant le redémarrage ne seront pas re-annoncés (l'état est vide, donc le bot les ignorera s'ils sont déjà terminés).

---

## Licence

MIT
