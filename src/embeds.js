/**
 * embeds.js — Constructeurs d'embeds Discord pour chaque type d'événement.
 * Adapté à la structure de football-data.org v4.
 */

import { EmbedBuilder } from 'discord.js';

const COLORS = {
  debut: 0x1e90ff,
  but: 0xffd700,
  fin: 0x2ecc71,
  mi_temps: 0x95a5a6,
};

/**
 * Embed pour le début d'un match.
 * @param {object} match - objet match de football-data.org
 */
export function embedDebut(match) {
  const domicile = match.homeTeam.name;
  const exterieur = match.awayTeam.name;
  const heure = new Date(match.utcDate).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  });

  return new EmbedBuilder()
    .setColor(COLORS.debut)
    .setTitle('🐙 Poul sort de son aquarium — le match commence !')
    .setDescription(`**${domicile}** affronte **${exterieur}**\nPoul a les tentacules qui frémissent...`)
    .addFields(
      { name: '🕐 Coup d\'envoi', value: heure, inline: true },
      { name: '🏆 Compétition', value: 'FIFA Coupe du Monde 2026', inline: true },
    )
    .setFooter({ text: `Match ID ${match.id}` })
    .setTimestamp();
}

/**
 * Embed pour un but marqué.
 * @param {object} match - objet match complet
 * @param {object|null} but - dernier objet but de match.goals[]
 */
export function embedBut(match, but) {
  const domicile = match.homeTeam.name;
  const exterieur = match.awayTeam.name;
  const scoreHome = match.score.fullTime.home ?? 0;
  const scoreAway = match.score.fullTime.away ?? 0;
  const score = `${scoreHome} - ${scoreAway}`;

  const equipeQuiMarque = but?.team?.name ?? 'Équipe inconnue';
  const buteur = but?.scorer?.name ?? null;
  const minute = but?.minute ?? null;
  const type = but?.type ?? 'NORMAL';

  let detail = '';
  if (type === 'PENALTY') detail = ' *(pénalty)*';
  else if (type === 'OWN') detail = ' *(csc)*';

  const descButeur = buteur
    ? `**${buteur}**${detail} envoie le cuir au fond des filets !`
    : `But marqué${detail} !`;

  const minuteStr = minute ? `${minute}'` : '??\'';

  return new EmbedBuilder()
    .setColor(COLORS.but)
    .setTitle(`⚽ Poul a senti venir le but ! ${equipeQuiMarque} marque !`)
    .setDescription(`${descButeur}\n\n**${domicile} ${score} ${exterieur}**`)
    .addFields(
      { name: '⏱️ Minute', value: minuteStr, inline: true },
      { name: '🏹 Équipe', value: equipeQuiMarque, inline: true },
    )
    .setFooter({ text: `Match ID ${match.id}` })
    .setTimestamp();
}

/**
 * Embed pour la mi-temps.
 * @param {object} match
 */
export function embedMiTemps(match) {
  const domicile = match.homeTeam.name;
  const exterieur = match.awayTeam.name;
  const scoreHome = match.score.halfTime.home ?? 0;
  const scoreAway = match.score.halfTime.away ?? 0;

  return new EmbedBuilder()
    .setColor(COLORS.mi_temps)
    .setTitle('🫧 Poul reprend son souffle — mi-temps !')
    .setDescription(`**${domicile} ${scoreHome} - ${scoreAway} ${exterieur}**\n\nRetour dans 15 minutes, Poul garde un œil sur le tableau.`)
    .setFooter({ text: `Match ID ${match.id}` })
    .setTimestamp();
}

/**
 * Embed pour la fin d'un match.
 * @param {object} match
 */
/**
 * Embed du bulletin quotidien posté à 10h.
 * Liste tous les matchs de la fenêtre 10h00 → 09h59 le lendemain.
 * @param {Array} matches - matchs triés par heure
 * @param {string} dateLabel - ex: "samedi 21 juin"
 */
export function embedBulletinJournalier(matches, dateLabel) {
  const lignes = matches.map((m) => {
    const heure = new Date(m.utcDate).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Paris',
    });
    return `🕐 **${heure}** — ${m.homeTeam.name} 🆚 ${m.awayTeam.name}`;
  });

  const description = lignes.length
    ? lignes.join('\n')
    : '_Aucun match prévu aujourd\'hui. Poul se prélasse dans son aquarium._';

  const titre = lignes.length
    ? `🐙 Poul scrute le programme — ${lignes.length} match${lignes.length > 1 ? 's' : ''} au menu !`
    : '🐙 Poul vérifie le programme...';

  return new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle(titre)
    .setDescription(description)
    .setFooter({ text: `Programme du ${dateLabel} • Heures en heure de Paris` })
    .setTimestamp();
}

export function embedFin(match) {
  const domicile = match.homeTeam.name;
  const exterieur = match.awayTeam.name;
  const scoreHome = match.score.fullTime.home ?? 0;
  const scoreAway = match.score.fullTime.away ?? 0;
  const score = `${scoreHome} - ${scoreAway}`;

  let resultat = '';
  if (scoreHome > scoreAway) resultat = `🏆 Victoire de **${domicile}** !`;
  else if (scoreAway > scoreHome) resultat = `🏆 Victoire de **${exterieur}** !`;
  else resultat = '🤝 Match nul !';

  const typesFin = {
    FINISHED: 'Temps réglementaire',
    EXTRA_TIME: 'Après prolongations',
    PENALTY_SHOOTOUT: 'Aux tirs au but',
    AWARDED: 'Match sur tapis vert',
  };
  const typeFin = typesFin[match.status] ?? 'Fin de match';

  return new EmbedBuilder()
    .setColor(COLORS.fin)
    .setTitle('🏁 Poul retourne se reposer — match terminé !')
    .setDescription(`**${domicile} ${score} ${exterieur}**\n\n${resultat}`)
    .addFields({ name: '📋 Résultat', value: typeFin, inline: true })
    .setFooter({ text: `Match ID ${match.id}` })
    .setTimestamp();
}
