/**
 * tracker.js — Orchestrateur principal.
 *
 * La "journée Poul" va de 10h00 aujourd'hui à 09h59 le lendemain.
 * Les matchs à 00h ou 06h du matin appartiennent à la journée précédente.
 *
 * Statuts football-data.org :
 *   SCHEDULED / TIMED       → pas encore commencé
 *   IN_PLAY                 → en cours (1ère ou 2ème mi-temps)
 *   PAUSED                  → mi-temps
 *   EXTRA_TIME              → prolongations
 *   PENALTY_SHOOTOUT        → tirs au but
 *   FINISHED / AWARDED      → terminé
 */

import { getFixturesByDate, getLiveFixtures } from './api.js';
import { loadState, saveState, getMatchState, goalEventId } from './state.js';
import { postEmbed } from './bot.js';
import { embedDebut, embedBut, embedMiTemps, embedFin, embedBulletinJournalier } from './embeds.js';

const POLL_INTERVAL    = parseInt(process.env.POLL_INTERVAL_MS ?? '90000', 10);
const MARGE_AVANT      = 5  * 60 * 1000;   // 5 min avant coup d'envoi
const DUREE_MAX_MATCH  = 135 * 60 * 1000;  // 135 min max (prolongations)

const STATUTS_LIVE = new Set(['IN_PLAY', 'PAUSED', 'EXTRA_TIME', 'PENALTY_SHOOTOUT']);
const STATUTS_FIN  = new Set(['FINISHED', 'AWARDED']);

let pollTimer = null;

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------

export async function demarrerTracker() {
  console.log('[Tracker] 🐙 Poul le Paulpe se réveille...');

  // Lance immédiatement la journée en cours
  await planifierJournee();

  // Programme le bulletin + re-planification à 10h00 chaque jour
  programmerProchain10h();
}

// ---------------------------------------------------------------------------
// Journée Poul : 10h00 aujourd'hui → 09h59 demain
// ---------------------------------------------------------------------------

/**
 * Retourne les bornes de la "journée Poul" active au moment de l'appel.
 * Si on est avant 10h, la journée active a commencé hier à 10h.
 */
function bornesJourneePoul() {
  const maintenant = new Date();
  const heure = maintenant.getHours() + maintenant.getMinutes() / 60;

  const debut = new Date(maintenant);
  if (heure < 10) {
    // Avant 10h : la journée active a commencé hier
    debut.setDate(debut.getDate() - 1);
  }
  debut.setHours(10, 0, 0, 0);

  const fin = new Date(debut);
  fin.setDate(fin.getDate() + 1);
  fin.setHours(9, 59, 59, 999);

  return { debut, fin };
}

/**
 * Retourne les dates calendaires à interroger pour couvrir la journée Poul.
 * Exemple : à 08h le 22 juin → on veut les matchs du 21 juin ET du 22 juin.
 */
function datesAInterroger() {
  const { debut, fin } = bornesJourneePoul();
  const dates = [];
  const cursor = new Date(debut);
  while (cursor <= fin) {
    dates.push(cursor.toISOString().split('T')[0]);
    cursor.setDate(cursor.getDate() + 1);
  }
  // Dédoublonnage au cas où
  return [...new Set(dates)];
}

/**
 * Récupère tous les matchs de la journée Poul (filtrés dans la fenêtre 10h–09h59).
 */
async function getMatchesJourneePoul() {
  const { debut, fin } = bornesJourneePoul();
  const dates = datesAInterroger();

  const tous = [];
  for (const date of dates) {
    const matchs = await getFixturesByDate(date);
    tous.push(...matchs);
  }

  // Filtre sur la fenêtre exacte
  return tous.filter((m) => {
    const t = new Date(m.utcDate).getTime();
    return t >= debut.getTime() && t <= fin.getTime();
  });
}

// ---------------------------------------------------------------------------
// Bulletin quotidien à 10h
// ---------------------------------------------------------------------------

async function posterBulletin() {
  const matchs = await getMatchesJourneePoul();

  // Tri par heure de coup d'envoi
  matchs.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

  const { debut } = bornesJourneePoul();
  const dateLabel = debut.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  console.log(`[Tracker] 📰 Bulletin du ${dateLabel} : ${matchs.length} match(s)`);
  await postEmbed(embedBulletinJournalier(matchs, dateLabel));
}

/**
 * Programme le prochain bulletin à 10h00 (aujourd'hui si pas encore passé, sinon demain).
 */
function programmerProchain10h() {
  const maintenant = new Date();
  const prochain10h = new Date(maintenant);
  prochain10h.setHours(10, 0, 0, 0);

  if (prochain10h <= maintenant) {
    // 10h déjà passé aujourd'hui → on vise demain
    prochain10h.setDate(prochain10h.getDate() + 1);
  }

  const attenteMs = prochain10h.getTime() - maintenant.getTime();
  console.log(`[Tracker] 📰 Prochain bulletin dans ${Math.round(attenteMs / 60000)} min (${prochain10h.toLocaleTimeString('fr-FR')})`);

  setTimeout(async () => {
    await posterBulletin();
    await planifierJournee();
    programmerProchain10h(); // reboucle chaque jour
  }, attenteMs);
}

// ---------------------------------------------------------------------------
// Planification du polling
// ---------------------------------------------------------------------------

async function planifierJournee() {
  const matchs = await getMatchesJourneePoul();

  if (!matchs.length) {
    console.log('[Tracker] 💤 Aucun match sur la fenêtre active. Poul se repose.');
    return;
  }

  console.log(`[Tracker] 📋 ${matchs.length} match(s) dans la journée Poul.`);

  const fenetres = matchs.map((m) => {
    const kickoff = new Date(m.utcDate).getTime();
    return {
      debut: kickoff - MARGE_AVANT,
      fin:   kickoff + DUREE_MAX_MATCH,
      label: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
    };
  });

  fenetres.forEach((w) => {
    console.log(`[Tracker]   ⏰ ${w.label} → ${new Date(w.debut).toLocaleTimeString('fr-FR')} – ${new Date(w.fin).toLocaleTimeString('fr-FR')}`);
  });

  const periodes = fusionnerFenetres(fenetres);
  programmerProchainePeriode(periodes);
}

function fusionnerFenetres(fenetres) {
  if (!fenetres.length) return [];
  const triees = [...fenetres].sort((a, b) => a.debut - b.debut);
  const merged = [{ ...triees[0] }];
  for (let i = 1; i < triees.length; i++) {
    const last = merged[merged.length - 1];
    if (triees[i].debut <= last.fin) {
      last.fin = Math.max(last.fin, triees[i].fin);
    } else {
      merged.push({ ...triees[i] });
    }
  }
  return merged;
}

function programmerProchainePeriode(periodes) {
  const maintenant = Date.now();
  const prochaine = periodes.find((p) => p.fin > maintenant);

  if (!prochaine) {
    console.log('[Tracker] 💤 Plus de matchs sur cette fenêtre.');
    return;
  }

  const attente = Math.max(0, prochaine.debut - maintenant);
  if (attente > 0) {
    console.log(`[Tracker] ⏳ Prochain match dans ${Math.round(attente / 60000)} min. Poul patiente...`);
    setTimeout(() => activerPolling(periodes, prochaine), attente);
  } else {
    activerPolling(periodes, prochaine);
  }
}

function activerPolling(toutesLesPeriodes, periode) {
  console.log(`[Tracker] 🟢 Polling actif (toutes les ${POLL_INTERVAL / 1000}s)`);

  async function tick() {
    if (Date.now() > periode.fin) {
      console.log('[Tracker] 🔴 Fin de la période active.');
      clearTimeout(pollTimer);
      const restantes = toutesLesPeriodes.filter((p) => p.debut > periode.debut);
      programmerProchainePeriode(restantes);
      return;
    }

    await pollEtAnnonce();
    pollTimer = setTimeout(tick, POLL_INTERVAL);
  }

  tick();
}

// ---------------------------------------------------------------------------
// Poll + détection des événements
// ---------------------------------------------------------------------------

async function pollEtAnnonce() {
  const fixtures = await getLiveFixtures();
  const state = loadState();

  for (const match of fixtures) {
    await traiterMatch(match, state);
  }

  saveState(state);
}

async function traiterMatch(match, state) {
  const statut    = match.status;
  const scoreHome = match.score.fullTime.home ?? 0;
  const scoreAway = match.score.fullTime.away ?? 0;
  const ms        = getMatchState(state, match.id);

  // Début de match
  if (STATUTS_LIVE.has(statut) && !ms.announcedStart) {
    console.log(`[Tracker] 🔵 Début : ${match.homeTeam.name} vs ${match.awayTeam.name}`);
    await postEmbed(embedDebut(match));
    ms.announcedStart = true;
    ms.status = statut;
  }

  // But(s)
  if (scoreHome + scoreAway > ms.homeScore + ms.awayScore) {
    const goalId = goalEventId(match.id, scoreHome, scoreAway);
    if (!ms.announcedGoals.includes(goalId)) {
      const buts = match.goals ?? [];
      const dernierBut = buts.length ? buts[buts.length - 1] : null;
      console.log(`[Tracker] ⚽ But : ${match.homeTeam.name} ${scoreHome}-${scoreAway} ${match.awayTeam.name}`);
      await postEmbed(embedBut(match, dernierBut));
      ms.announcedGoals.push(goalId);
      ms.homeScore = scoreHome;
      ms.awayScore = scoreAway;
    }
  }

  // Mi-temps
  if (statut === 'PAUSED' && ms.status !== 'PAUSED') {
    console.log(`[Tracker] 🫧 Mi-temps : ${match.homeTeam.name} vs ${match.awayTeam.name}`);
    await postEmbed(embedMiTemps(match));
    ms.status = 'PAUSED';
  }

  // Fin de match
  if (STATUTS_FIN.has(statut) && !ms.announcedEnd) {
    console.log(`[Tracker] 🏁 Fin : ${match.homeTeam.name} ${scoreHome}-${scoreAway} ${match.awayTeam.name}`);
    await postEmbed(embedFin(match));
    ms.announcedEnd = true;
    ms.status = statut;
  }
}
