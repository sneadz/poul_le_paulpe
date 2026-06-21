/**
 * embeds.js — Constructeurs d'embeds Discord pour chaque type d'événement.
 * Tout le ton décalé de Poul le Paulpe est ici.
 */

import { EmbedBuilder } from 'discord.js';

/** Couleurs des embeds */
const COLORS = {
  debut: 0x1e90ff,   // bleu vif
  but: 0xffd700,     // or
  fin: 0x2ecc71,     // vert
  mi_temps: 0x95a5a6, // gris
};

/**
 * Formate un nom d'équipe depuis les données API.
 * @param {object} team - objet team de l'API ({ name, logo })
 */
function nomEquipe(team) {
  return team?.name ?? 'Équipe inconnue';
}

/**
 * Embed pour le début d'un match.
 * @param {object} fixture - objet fixture complet de l'API
 */
export function embedDebut(fixture) {
  const { teams, fixture: f, league } = fixture;
  const domicile = nomEquipe(teams.home);
  const exterieur = nomEquipe(teams.away);
  const heure = new Date(f.date).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  });

  return new EmbedBuilder()
    .setColor(COLORS.debut)
    .setTitle(`🐙 Poul sort de son aquarium — le match commence !`)
    .setDescription(`**${domicile}** affronte **${exterieur}**\nPoul a les tentacules qui frémissent...`)
    .addFields(
      { name: '🏟️ Stade', value: f.venue?.name ?? 'Stade inconnu', inline: true },
      { name: '🕐 Coup d\'envoi', value: heure, inline: true },
      { name: '🏆 Compétition', value: league.name, inline: true },
    )
    .setThumbnail(league.logo)
    .setFooter({ text: `Match ID ${f.id}` })
    .setTimestamp();
}

/**
 * Embed pour un but marqué.
 * @param {object} fixture - objet fixture complet de l'API
 * @param {object|null} evenement - dernier événement "Goal" de l'API (peut être null)
 * @param {'home'|'away'} campDuBut - qui a marqué
 */
export function embedBut(fixture, evenement, campDuBut) {
  const { teams, goals } = fixture;
  const domicile = nomEquipe(teams.home);
  const exterieur = nomEquipe(teams.away);
  const equipeQuiMarque = campDuBut === 'home' ? domicile : exterieur;

  const score = `${goals.home ?? 0} - ${goals.away ?? 0}`;
  const buteur = evenement?.player?.name ?? null;
  const minute = evenement?.time?.elapsed ?? null;
  const typeGoal = evenement?.detail ?? 'But';

  // Détail du but : pénalty, CSC, etc.
  let detailGoal = '';
  if (typeGoal === 'Penalty') detailGoal = ' *(pénalty)* ';
  else if (typeGoal === 'Own Goal') detailGoal = ' *(csc)* ';

  const descButeur = buteur
    ? `**${buteur}**${detailGoal} envoie le cuir au fond des filets !`
    : `But marqué${detailGoal}!`;

  const minuteStr = minute ? `${minute}'` : '??\'';

  return new EmbedBuilder()
    .setColor(COLORS.but)
    .setTitle(`⚽ Poul a senti venir le but ! ${equipeQuiMarque} marque !`)
    .setDescription(`${descButeur}\n\n**${domicile} ${score} ${exterieur}**`)
    .addFields(
      { name: '⏱️ Minute', value: minuteStr, inline: true },
      { name: '🏹 Équipe', value: equipeQuiMarque, inline: true },
    )
    .setFooter({ text: `Match ID ${fixture.fixture.id}` })
    .setTimestamp();
}

/**
 * Embed pour la mi-temps (optionnel, informatif).
 * @param {object} fixture
 */
export function embedMiTemps(fixture) {
  const { teams, goals } = fixture;
  const domicile = nomEquipe(teams.home);
  const exterieur = nomEquipe(teams.away);
  const score = `${goals.home ?? 0} - ${goals.away ?? 0}`;

  return new EmbedBuilder()
    .setColor(COLORS.mi_temps)
    .setTitle(`🫧 Poul reprend son souffle — mi-temps !`)
    .setDescription(`**${domicile} ${score} ${exterieur}**\n\nRetour dans 15 minutes, Poul garde un œil sur le tableau de bord.`)
    .setFooter({ text: `Match ID ${fixture.fixture.id}` })
    .setTimestamp();
}

/**
 * Embed pour la fin d'un match.
 * @param {object} fixture
 */
export function embedFin(fixture) {
  const { teams, goals, fixture: f } = fixture;
  const domicile = nomEquipe(teams.home);
  const exterieur = nomEquipe(teams.away);
  const scoreHome = goals.home ?? 0;
  const scoreAway = goals.away ?? 0;
  const score = `${scoreHome} - ${scoreAway}`;

  let resultat = '';
  if (scoreHome > scoreAway) resultat = `🏆 Victoire de **${domicile}** !`;
  else if (scoreAway > scoreHome) resultat = `🏆 Victoire de **${exterieur}** !`;
  else resultat = `🤝 Match nul !`;

  // Détail du type de fin (prolongations, tirs au but...)
  const typesFin = { FT: 'Temps réglementaire', AET: 'Après prolongations', PEN: 'Aux tirs au but' };
  const typeFin = typesFin[f.status?.short] ?? 'Fin de match';

  return new EmbedBuilder()
    .setColor(COLORS.fin)
    .setTitle(`🏁 Poul retourne se reposer — match terminé !`)
    .setDescription(`**${domicile} ${score} ${exterieur}**\n\n${resultat}`)
    .addFields(
      { name: '📋 Résultat', value: typeFin, inline: true },
    )
    .setFooter({ text: `Match ID ${f.id}` })
    .setTimestamp();
}
