/**
 * api.js — Wrapper pour football-data.org v4
 * Gère les appels HTTP, le rate limit et les erreurs réseau.
 */

import fetch from 'node-fetch';

const BASE_URL = 'https://api.football-data.org/v4';
const COMPETITION = 'WC'; // Code FIFA World Cup

const headers = {
  'X-Auth-Token': process.env.RAPIDAPI_KEY,
  // Demande à l'API de déplier les buts dans la réponse
  'X-Unfold-Goals': 'true',
};

/**
 * Appel générique avec gestion du rate limit et des erreurs réseau.
 * Lit les headers de réponse pour logger les quotas restants.
 */
async function apiGet(endpoint, params = {}) {
  const url = new URL(`${BASE_URL}${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  try {
    const response = await fetch(url.toString(), { headers });

    // Log du quota restant pour aider à calibrer POLL_INTERVAL_MS
    const restantes = response.headers.get('X-RequestsAvailable');
    const resetDans = response.headers.get('X-RequestCounter-Reset');
    if (restantes !== null) {
      console.log(`[API] 📊 Quota : ${restantes} req restantes (reset dans ${resetDans}s)`);
    }

    if (response.status === 429) {
      console.warn('[API] ⚠️  Rate limit atteint (429). Poul attend le prochain cycle...');
      return null;
    }

    if (response.status === 403) {
      console.error('[API] ❌ Clé API invalide ou plan insuffisant (403).');
      return null;
    }

    if (!response.ok) {
      console.error(`[API] ❌ Erreur HTTP ${response.status} sur ${endpoint}`);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error('[API] ❌ Erreur réseau :', err.message);
    return null;
  }
}

/**
 * Récupère tous les matchs de la Coupe du Monde pour une date donnée.
 * @param {string} date - format 'YYYY-MM-DD'
 * @returns {Promise<Array>}
 */
export async function getFixturesByDate(date) {
  console.log(`[API] 📅 Récupération des matchs du ${date}...`);
  const data = await apiGet(`/competitions/${COMPETITION}/matches`, {
    dateFrom: date,
    dateTo: date,
  });

  if (!data) return [];

  const matches = data.matches ?? [];
  console.log(`[API] ✅ ${matches.length} match(s) trouvé(s) pour le ${date}`);
  return matches;
}

/**
 * Récupère les matchs en cours (IN_PLAY + PAUSED + EXTRA_TIME + PENALTY_SHOOTOUT).
 * Un seul appel couvre tous les matchs simultanés.
 * @returns {Promise<Array>}
 */
export async function getLiveFixtures() {
  const data = await apiGet(`/competitions/${COMPETITION}/matches`, {
    status: 'IN_PLAY,PAUSED,EXTRA_TIME,PENALTY_SHOOTOUT',
  });

  if (!data) return [];
  return data.matches ?? [];
}

/**
 * Récupère les détails complets d'un match (avec les buts dépliés).
 * @param {number} matchId
 * @returns {Promise<object|null>}
 */
export async function getFixtureById(matchId) {
  const data = await apiGet(`/matches/${matchId}`);
  return data ?? null;
}
