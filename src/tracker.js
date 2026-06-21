/**
 * tracker.js — Orchestrateur principal.
 * Récupère le planning du jour, calcule les fenêtres de match,
 * et poll l'API uniquement pendant ces fenêtres.
 */

import { getFixturesByDate, getLiveFixtures } from './api.js';
import { loadState, saveState, getMatchState, goalEventId } from './state.js';
import { postEmbed } from './bot.js';
import { embedDebut, embedBut, embedMiTemps, embedFin } from './embeds.js';

// Intervalle de poll configurable via .env (défaut : 90s)
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS ?? '90000', 10);

// Marge avant le coup d'envoi pour activer le polling (en ms)
const MARGE_AVANT_MATCH = 5 * 60 * 1000; // 5 minutes

// Durée maximale d'un match (temps réglementaire + prolongations + temps additionnel)
const DUREE_MAX_MATCH = 135 * 60 * 1000; // 135 minutes

// Statuts API-Football considérés comme "match en cours"
const STATUTS_LIVE = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'INT']);

// Statuts API-Football considérés comme "match terminé"
const STATUTS_FIN = new Set(['FT', 'AET', 'PEN']);

let pollTimer = null;

/**
 * Point d'entrée du tracker.
 * Appelle le planning du jour et programme les fenêtres de polling.
 */
export async function demarrerTracker() {
  console.log('[Tracker] 🐙 Poul le Paulpe se réveille...');
  await planifierJournee();
}

/**
 * Charge les matchs du jour et calcule quand activer/désactiver le polling.
 */
async function planifierJournee() {
  const aujourd_hui = new Date().toISOString().split('T')[0];
  const fixtures = await getFixturesByDate(aujourd_hui);

  if (!fixtures.length) {
    console.log('[Tracker] 💤 Aucun match aujourd\'hui. Poul dort jusqu\'à demain.');
    planifierPourDemain();
    return;
  }

  console.log(`[Tracker] 📋 ${fixtures.length} match(s) au programme aujourd'hui.`);

  // Calcule les fenêtres d'activité à partir des horaires des matchs
  const fenetres = fixtures.map((f) => {
    const kickoff = new Date(f.fixture.date).getTime();
    return {
      debut: kickoff - MARGE_AVANT_MATCH,
      fin: kickoff + DUREE_MAX_MATCH,
      fixtureId: f.fixture.id,
      label: `${f.teams.home.name} vs ${f.teams.away.name}`,
    };
  });

  fenetres.forEach((w) => {
    console.log(`[Tracker]   ⏰ ${w.label} → fenêtre active de ${new Date(w.debut).toLocaleTimeString('fr-FR')} à ${new Date(w.fin).toLocaleTimeString('fr-FR')}`);
  });

  // Fusionne les fenêtres qui se chevauchent en une seule période continue
  const periodes = fusionnerFenetres(fenetres);

  programmerProchainePeriode(periodes);

  // Re-planifie pour le lendemain à minuit
  planifierPourDemain();
}

/**
 * Fusionne les intervalles [debut, fin] qui se chevauchent.
 * @param {Array<{debut: number, fin: number}>} fenetres
 * @returns {Array<{debut: number, fin: number}>}
 */
function fusionnerFenetres(fenetres) {
  if (!fenetres.length) return [];

  const triees = [...fenetres].sort((a, b) => a.debut - b.debut);
  const merged = [{ ...triees[0] }];

  for (let i = 1; i < triees.length; i++) {
    const derniere = merged[merged.length - 1];
    if (triees[i].debut <= derniere.fin) {
      // Chevauchement : on étend la période courante
      derniere.fin = Math.max(derniere.fin, triees[i].fin);
    } else {
      merged.push({ ...triees[i] });
    }
  }

  return merged;
}

/**
 * Programme l'activation du polling pour la prochaine période active.
 * @param {Array<{debut: number, fin: number}>} periodes
 */
function programmerProchainePeriode(periodes) {
  const maintenant = Date.now();

  // Cherche la première période qui n'est pas encore terminée
  const prochaine = periodes.find((p) => p.fin > maintenant);

  if (!prochaine) {
    console.log('[Tracker] 💤 Plus de matchs aujourd\'hui. Poul se repose.');
    return;
  }

  const attente = Math.max(0, prochaine.debut - maintenant);

  if (attente > 0) {
    console.log(`[Tracker] ⏳ Prochain match dans ${Math.round(attente / 60000)} min. Poul patiente...`);
    setTimeout(() => activerPolling(periodes, prochaine), attente);
  } else {
    // On est déjà dans la fenêtre active
    activerPolling(periodes, prochaine);
  }
}

/**
 * Active le polling toutes les POLL_INTERVAL ms.
 * S'arrête automatiquement à la fin de la période.
 * @param {Array} toutesLesPeriodes - pour programmer la suivante ensuite
 * @param {{debut: number, fin: number}} periode - période courante
 */
function activerPolling(toutesLesPeriodes, periode) {
  console.log(`[Tracker] 🟢 Polling actif (toutes les ${POLL_INTERVAL / 1000}s)`);

  async function tick() {
    if (Date.now() > periode.fin) {
      console.log('[Tracker] 🔴 Fin de la période active. Poul reprend son souffle.');
      clearTimeout(pollTimer);

      // Cherche la période suivante parmi toutes les périodes
      const restantes = toutesLesPeriodes.filter((p) => p.debut > periode.debut);
      programmerProchainePeriode(restantes);
      return;
    }

    await pollEtAnnonce();
    pollTimer = setTimeout(tick, POLL_INTERVAL);
  }

  tick();
}

/**
 * Un tick de polling : récupère les matchs live et détecte les changements.
 */
async function pollEtAnnonce() {
  const fixtures = await getLiveFixtures();
  const state = loadState();

  for (const fixture of fixtures) {
    await traiterFixture(fixture, state);
  }

  saveState(state);
}

/**
 * Analyse un fixture et poste les embeds si des événements nouveaux sont détectés.
 * @param {object} fixture - objet fixture de l'API
 * @param {object} state - état global (modifié en place)
 */
async function traiterFixture(fixture, state) {
  const fixtureId = fixture.fixture.id;
  const statutActuel = fixture.fixture.status?.short ?? 'NS';
  const scoreHome = fixture.goals?.home ?? 0;
  const scoreAway = fixture.goals?.away ?? 0;

  const matchState = getMatchState(state, fixtureId);

  // --- Début de match ---
  if (STATUTS_LIVE.has(statutActuel) && !matchState.announcedStart) {
    console.log(`[Tracker] 🔵 Début détecté : ${fixture.teams.home.name} vs ${fixture.teams.away.name}`);
    await postEmbed(embedDebut(fixture));
    matchState.announcedStart = true;
    matchState.status = statutActuel;
  }

  // --- But(s) ---
  const totalButs = scoreHome + scoreAway;
  const totalButsConnus = matchState.homeScore + matchState.awayScore;

  if (totalButs > totalButsConnus) {
    const goalId = goalEventId(fixtureId, scoreHome, scoreAway);

    if (!matchState.announcedGoals.includes(goalId)) {
      // Détermine qui a marqué
      const campDuBut = scoreHome > matchState.homeScore ? 'home' : 'away';

      // Cherche l'événement "Goal" le plus récent dans les events API
      const dernierGoal = trouverDernierGoal(fixture.events ?? []);

      console.log(`[Tracker] ⚽ But détecté : ${fixture.teams.home.name} ${scoreHome}-${scoreAway} ${fixture.teams.away.name}`);
      await postEmbed(embedBut(fixture, dernierGoal, campDuBut));

      matchState.announcedGoals.push(goalId);
      matchState.homeScore = scoreHome;
      matchState.awayScore = scoreAway;
    }
  }

  // --- Mi-temps (optionnel, une seule fois) ---
  if (statutActuel === 'HT' && matchState.status !== 'HT') {
    console.log(`[Tracker] 🫧 Mi-temps : ${fixture.teams.home.name} vs ${fixture.teams.away.name}`);
    await postEmbed(embedMiTemps(fixture));
    matchState.status = 'HT';
  }

  // --- Fin de match ---
  if (STATUTS_FIN.has(statutActuel) && !matchState.announcedEnd) {
    console.log(`[Tracker] 🏁 Fin détectée : ${fixture.teams.home.name} ${scoreHome}-${scoreAway} ${fixture.teams.away.name}`);
    await postEmbed(embedFin(fixture));
    matchState.announcedEnd = true;
    matchState.status = statutActuel;
  }
}

/**
 * Cherche le dernier événement de type "Goal" dans la liste des events d'un match.
 * @param {Array} events - fixture.events de l'API
 * @returns {object|null}
 */
function trouverDernierGoal(events) {
  const goals = events.filter((e) => e.type === 'Goal');
  return goals.length ? goals[goals.length - 1] : null;
}

/**
 * Programme une re-planification à minuit pour le lendemain.
 */
function planifierPourDemain() {
  const maintenant = new Date();
  const demainMinuit = new Date(maintenant);
  demainMinuit.setDate(demainMinuit.getDate() + 1);
  demainMinuit.setHours(6, 0, 0, 0); // 6h du matin pour attraper les matchs tôt

  const attenteMs = demainMinuit.getTime() - maintenant.getTime();
  console.log(`[Tracker] 📆 Re-planification à ${demainMinuit.toLocaleString('fr-FR')} (dans ${Math.round(attenteMs / 3600000)}h)`);
  setTimeout(planifierJournee, attenteMs);
}
