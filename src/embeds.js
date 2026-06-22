/**
 * embeds.js — Constructeurs d'embeds Discord pour chaque type d'événement.
 * Adapté à la structure de football-data.org v4.
 */

import { EmbedBuilder } from 'discord.js';

const TITRES_BUT = [
  '⚽ Poul sentir dans tentacules. But. Bloop.',
  '⚽ Poul voir ballon rentrer. Poul crier très fort. Poissons dans aquarium stressés. Bloop.',
  '⚽ GOAL. Poul savoir. Poul toujours savoir. Bloop.',
  '⚽ Poul pas surpris. Poul voir venir. Poul quand même se lever. Bloop.',
  '⚽ But ! Poul danser avec ses 8 bras. Résultat spectaculaire. Bloop.',
  '⚽ Poul prédire ce but. Poul pas le dire avant. Mais Poul prédire. Bloop.',
  '⚽ Ballon rentrer dans filet. Poul valider. Bloop.',
  '⚽ Poul voir but. Poul perdre un peu de calme. Poul reprendre calme. Bloop.',
  '⚽ Ce but. Poul approuver. Bloop.',
  '⚽ Poul exploser de joie dans aquarium. Vague générée. Dégâts mineurs. Bloop.',
];

const COLORS = {
  debut: 0x1e90ff,
  but: 0xffd700,
  fin: 0x2ecc71,
  mi_temps: 0x95a5a6,
};

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
    .setTimestamp();
}

/**
 * @param {object} match
 * @param {object|null} but - dernier objet but de match.goals[]
 * @param {'home'|'away'} campDuBut - dérivé du changement de score, fiable même si but.team est vide
 */
export function embedBut(match, but, campDuBut) {
  const domicile = match.homeTeam.name;
  const exterieur = match.awayTeam.name;
  const scoreHome = match.score.fullTime.home ?? 0;
  const scoreAway = match.score.fullTime.away ?? 0;

  const equipeQuiMarque = campDuBut === 'home' ? domicile : exterieur;
  const buteur = but?.scorer?.name ?? null;
  const minute = but?.minute ?? null;
  const type = but?.type ?? 'NORMAL';

  let detail = '';
  if (type === 'PENALTY') detail = ' *(pénalty)*';
  else if (type === 'OWN') detail = ' *(csc)*';

  const descButeur = buteur
    ? `**${buteur}**${detail} envoie le cuir au fond des filets !`
    : `But marqué${detail} !`;

  const fields = [{ name: '🏹 Équipe', value: equipeQuiMarque, inline: true }];
  if (minute) fields.unshift({ name: '⏱️ Minute', value: `${minute}'`, inline: true });

  const titreBut = TITRES_BUT[Math.floor(Math.random() * TITRES_BUT.length)];

  return new EmbedBuilder()
    .setColor(COLORS.but)
    .setTitle(titreBut)
    .setDescription(`${descButeur}\n\n**${domicile} ${scoreHome} - ${scoreAway} ${exterieur}**`)
    .addFields(...fields)
    .setTimestamp();
}

export function embedMiTemps(match) {
  const domicile = match.homeTeam.name;
  const exterieur = match.awayTeam.name;
  const scoreHome = match.score.halfTime.home ?? 0;
  const scoreAway = match.score.halfTime.away ?? 0;

  return new EmbedBuilder()
    .setColor(COLORS.mi_temps)
    .setTitle('🫧 Poul reprend son souffle — mi-temps !')
    .setDescription(`**${domicile} ${scoreHome} - ${scoreAway} ${exterieur}**\n\nRetour dans 15 minutes, Poul garde un œil sur le tableau.`)
    .setTimestamp();
}

export function embedFin(match) {
  const domicile = match.homeTeam.name;
  const exterieur = match.awayTeam.name;
  const scoreHome = match.score.fullTime.home ?? 0;
  const scoreAway = match.score.fullTime.away ?? 0;

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
    .setDescription(`**${domicile} ${scoreHome} - ${scoreAway} ${exterieur}**\n\n${resultat}`)
    .addFields({ name: '📋 Résultat', value: typeFin, inline: true })
    .setTimestamp();
}

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
