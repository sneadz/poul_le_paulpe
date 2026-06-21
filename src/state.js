/**
 * state.js — Persistance légère de l'état dans data/state.json
 * Évite de re-annoncer un événement déjà posté après un redémarrage.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, '..', 'data', 'state.json');

/** Structure par défaut d'un match dans l'état */
function defaultMatchState() {
  return {
    status: 'NS',       // statut API-Football (NS, 1H, HT, 2H, ET, FT, ...)
    homeScore: 0,
    awayScore: 0,
    announcedStart: false,
    announcedGoals: [], // liste d'IDs d'événements déjà annoncés : "fixtureId_homeScore_awayScore"
    announcedEnd: false,
  };
}

/** Charge l'état depuis le fichier JSON. Retourne un objet vide si le fichier n'existe pas. */
export function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    return { matches: {} };
  }
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[State] ❌ Impossible de lire state.json, on repart de zéro :', err.message);
    return { matches: {} };
  }
}

/** Sauvegarde l'état complet dans le fichier JSON. */
export function saveState(state) {
  try {
    state.lastUpdate = new Date().toISOString();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('[State] ❌ Impossible d\'écrire state.json :', err.message);
  }
}

/**
 * Retourne l'état d'un match précis, en l'initialisant s'il n'existe pas encore.
 * @param {object} state - état global
 * @param {number} fixtureId
 */
export function getMatchState(state, fixtureId) {
  const id = String(fixtureId);
  if (!state.matches[id]) {
    state.matches[id] = defaultMatchState();
  }
  return state.matches[id];
}

/**
 * Génère un identifiant unique pour un événement "but" afin d'éviter les doublons.
 * On utilise le score comme clé : si le score change, c'est un nouveau but.
 * @param {number} fixtureId
 * @param {number} homeScore
 * @param {number} awayScore
 */
export function goalEventId(fixtureId, homeScore, awayScore) {
  return `${fixtureId}_${homeScore}_${awayScore}`;
}
