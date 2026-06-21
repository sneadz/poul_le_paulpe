/**
 * api.js — Wrapper pour API-Football via RapidAPI
 * Gère les appels HTTP, le rate limit et les erreurs réseau.
 */

import fetch from 'node-fetch';

const BASE_URL = 'https://api-football-v1.p.rapidapi.com/v3';

const headers = {
  'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
  'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com',
};

/**
 * Appel générique à l'API avec gestion du rate limit (429) et des erreurs réseau.
 * @param {string} endpoint - ex: '/fixtures'
 * @param {Record<string, string>} params - paramètres de la query string
 * @returns {Promise<object|null>} - données JSON ou null en cas d'erreur
 */
async function apiGet(endpoint, params = {}) {
  const url = new URL(`${BASE_URL}${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  try {
    const response = await fetch(url.toString(), { headers });

    if (response.status === 429) {
      console.warn('[API] ⚠️  Rate limit atteint (429). Poul attend avant de re-essayer...');
      return null;
    }

    if (!response.ok) {
      console.error(`[API] ❌ Erreur HTTP ${response.status} sur ${endpoint}`);
      return null;
    }

    const json = await response.json();

    // L'API renvoie les erreurs métier dans json.errors
    if (json.errors && Object.keys(json.errors).length > 0) {
      console.error('[API] ❌ Erreur API-Football :', json.errors);
      return null;
    }

    return json;
  } catch (err) {
    console.error('[API] ❌ Erreur réseau :', err.message);
    return null;
  }
}

/**
 * Récupère tous les matchs de la Coupe du Monde pour une date donnée.
 * @param {string} date - format 'YYYY-MM-DD'
 * @returns {Promise<Array>} - liste de fixtures ou tableau vide
 */
export async function getFixturesByDate(date) {
  console.log(`[API] 📅 Récupération des matchs du ${date}...`);
  const data = await apiGet('/fixtures', {
    date,
    league: process.env.WORLD_CUP_LEAGUE_ID,
    season: process.env.WORLD_CUP_SEASON,
  });

  if (!data) return [];

  console.log(`[API] ✅ ${data.results} match(s) trouvé(s) pour le ${date}`);
  return data.response ?? [];
}

/**
 * Récupère l'état en direct de tous les matchs de la Coupe du Monde en cours aujourd'hui.
 * Un seul appel suffit pour tous les matchs simultanés.
 * @returns {Promise<Array>} - liste de fixtures live ou tableau vide
 */
export async function getLiveFixtures() {
  const data = await apiGet('/fixtures', {
    live: 'all',
    league: process.env.WORLD_CUP_LEAGUE_ID,
    season: process.env.WORLD_CUP_SEASON,
  });

  if (!data) return [];
  return data.response ?? [];
}

/**
 * Récupère les détails d'un match spécifique (pour avoir les événements/buteurs).
 * @param {number} fixtureId
 * @returns {Promise<object|null>}
 */
export async function getFixtureById(fixtureId) {
  const data = await apiGet('/fixtures', { id: String(fixtureId) });
  if (!data || !data.response?.length) return null;
  return data.response[0];
}
