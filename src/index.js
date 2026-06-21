/**
 * index.js — Point d'entrée du bot Poul le Paulpe 🐙
 */

import 'dotenv/config';
import { connectBot } from './bot.js';
import { demarrerTracker } from './tracker.js';

// Vérification des variables d'environnement obligatoires au démarrage
const VARS_REQUISES = ['DISCORD_TOKEN', 'DISCORD_CHANNEL_ID', 'RAPIDAPI_KEY'];
const manquantes = VARS_REQUISES.filter((v) => !process.env[v]);

if (manquantes.length) {
  console.error(`[Config] ❌ Variables d'environnement manquantes : ${manquantes.join(', ')}`);
  console.error('[Config] Copie .env.example vers .env et remplis les valeurs.');
  process.exit(1);
}

// Gestion propre des erreurs non capturées pour éviter les crashs silencieux
process.on('unhandledRejection', (err) => {
  console.error('[Process] ⚠️  Promesse rejetée non gérée :', err);
});

process.on('uncaughtException', (err) => {
  console.error('[Process] ❌ Exception non capturée :', err);
  process.exit(1);
});

async function main() {
  console.log('🐙 Démarrage de Poul le Paulpe...');

  // 1. Connexion au bot Discord
  await connectBot();

  // 2. Démarrage du tracker de matchs
  await demarrerTracker();
}

main().catch((err) => {
  console.error('[Main] ❌ Erreur fatale au démarrage :', err);
  process.exit(1);
});
