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
import { postEmbed, postMessage } from './bot.js';
import { embedDebut, embedBut, embedMiTemps, embedFin, embedBulletinJournalier } from './embeds.js';
import { piocherMessages, genererHorairesAleatoires } from './messages.js';

const POLL_INTERVAL    = parseInt(process.env.POLL_INTERVAL_MS ?? '30000', 10);
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

  await planifierJournee();
  programmerProchain10h();
  programmerMessagesAleatoires();
}

// ---------------------------------------------------------------------------
// Journée Poul : 10h00 aujourd'hui → 09h59 demain
// ---------------------------------------------------------------------------

/** Retourne la date YYYY-MM-DD en heure de Paris. */
function dateParis(date = new Date()) {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
}

/**
 * Retourne les bornes de la "journée Poul" en timestamps UTC.
 * Journée = 10h00 Paris (J) → 09h59 Paris (J+1).
 * Si on est avant 10h Paris, la journée active a commencé hier.
 */
function bornesJourneePoul() {
  const maintenant = new Date();

  const heureParis = parseInt(
    maintenant.toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', hour12: false }),
    10,
  );

  // Date de référence en Paris (hier si avant 10h, aujourd'hui sinon)
  const refParis = new Date(maintenant);
  if (heureParis < 10) refParis.setDate(refParis.getDate() - 1);

  const debutStr = dateParis(refParis);
  const finStr   = dateParis(new Date(refParis.getTime() + 24 * 60 * 60 * 1000));

  // On parse avec l'offset CEST (+02:00) — le runtime JS gère le passage hiver/été
  const debut = new Date(`${debutStr}T10:00:00+02:00`);
  const fin   = new Date(`${finStr}T09:59:59+02:00`);

  return { debut, fin };
}

/**
 * Récupère tous les matchs de la journée Poul.
 * Interroge toujours aujourd'hui ET demain en heure Paris pour ne pas rater
 * les matchs nocturnes dont la date UTC bascule au lendemain.
 */
async function getMatchesJourneePoul() {
  const { debut, fin } = bornesJourneePoul();

  const aujourd_hui = dateParis();
  const demain      = dateParis(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const dates       = [...new Set([aujourd_hui, demain])];

  const tous = [];
  for (const date of dates) {
    const matchs = await getFixturesByDate(date);
    tous.push(...matchs);
  }

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
    // Soit vraiment aucun match, soit l'API a échoué — on reessaie dans 5 min
    console.log('[Tracker] ⚠️  Aucun match trouvé. Nouvelle tentative dans 5 min...');
    setTimeout(planifierJournee, 5 * 60 * 1000);
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
// Messages aléatoires (3/jour entre 12h et 22h Paris)
// ---------------------------------------------------------------------------

let usedMessageIndexes = [];

function programmerMessagesAleatoires() {
  const horaires = genererHorairesAleatoires();
  const { messages, newUsedIndexes } = piocherMessages(usedMessageIndexes);
  usedMessageIndexes = newUsedIndexes;

  horaires.forEach((timestamp, i) => {
    const delai = timestamp - Date.now();
    const heure = new Date(timestamp).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' });
    console.log(`[Tracker] 💬 Message aléatoire ${i + 1}/3 programmé à ${heure}`);

    setTimeout(async () => {
      console.log(`[Tracker] 💬 Envoi : ${messages[i].slice(0, 60)}...`);
      await postMessage(messages[i]);
    }, delai);
  });

  // Reprogramme pour le lendemain à minuit Paris
  const demainStr = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
  const demainMinuit = new Date(`${demainStr}T00:00:00+02:00`);
  setTimeout(programmerMessagesAleatoires, demainMinuit.getTime() - Date.now());
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
    // Si le bot redémarre sur un match déjà en cours avec des buts existants,
    // on initialise le score sans ré-annoncer les anciens buts
    if (scoreHome + scoreAway > 0 && ms.homeScore === 0 && ms.awayScore === 0) {
      console.log(`[Tracker] ↩️  Match déjà en cours (${scoreHome}-${scoreAway}), Poul rattrape le score sans re-annoncer.`);
      ms.homeScore = scoreHome;
      ms.awayScore = scoreAway;
      // Marque tous les scores intermédiaires comme déjà annoncés
      for (let h = 0; h <= scoreHome; h++) {
        for (let a = 0; a <= scoreAway; a++) {
          if (h + a > 0 && h + a <= scoreHome + scoreAway) {
            ms.announcedGoals.push(goalEventId(match.id, h, a));
          }
        }
      }
    }
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
