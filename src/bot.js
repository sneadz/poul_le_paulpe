/**
 * bot.js — Client Discord : connexion et envoi de messages.
 */

import { Client, GatewayIntentBits } from 'discord.js';
import { repondreEnTantQuePoul } from './poul-ai.js';
import { getFixturesByDate } from './api.js';

let client = null;

/** Retourne la date YYYY-MM-DD en heure de Paris. */
function dateParis(date = new Date()) {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
}

/**
 * Construit un résumé texte des matchs du jour pour le contexte IA.
 */
async function getContexteMatchs() {
  try {
    const matchs = await getFixturesByDate(dateParis());
    if (!matchs.length) return '';
    return matchs.map((m) => {
      const heure = new Date(m.utcDate).toLocaleTimeString('fr-FR', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
      });
      const score = m.score?.fullTime?.home != null
        ? `(${m.score.fullTime.home}-${m.score.fullTime.away})`
        : '';
      return `${heure} — ${m.homeTeam.name} vs ${m.awayTeam.name} ${score} [${m.status}]`.trim();
    }).join('\n');
  } catch {
    return '';
  }
}

/**
 * Initialise et connecte le client Discord.
 * Retourne une promesse résolue une fois le bot prêt.
 */
export async function connectBot() {
  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  return new Promise((resolve, reject) => {
    client.once('clientReady', async () => {
      console.log(`[Bot] ✅ Connecté en tant que ${client.user.tag}`);

      // Listener @mention
      client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (!message.mentions.has(client.user)) return;

        // Nettoie le message : retire la mention et les espaces superflus
        const texte = message.content.replace(/<@!?\d+>/g, '').trim();
        const question = texte || 'Bonjour Poul !';

        console.log(`[Bot] 🐙 @mention de ${message.author.username} : "${question.slice(0, 60)}"`);

        try {
          await message.channel.sendTyping();
          const contexte = await getContexteMatchs();
          const reponse = await repondreEnTantQuePoul(message.author.id, question, contexte);

          if (reponse) {
            await message.reply(reponse);
          }
          // Si null (cooldown), on ignore silencieusement
        } catch (err) {
          console.error('[Bot] ❌ Erreur lors de la réponse @mention :', err.message);
        }
      });

      resolve(client);
      try {
        const channel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);
        if (channel?.isTextBased()) {
          await channel.send('🐙 Poul le Paulpe est en ligne et surveille la Coupe du Monde !');
        }
      } catch (err) {
        console.error('[Bot] ❌ Impossible d\'envoyer le message de démarrage :', err.message);
      }
    });

    client.on('error', (err) => {
      console.error('[Bot] ❌ Erreur Discord :', err.message);
    });

    client.login(process.env.DISCORD_TOKEN).catch(reject);
  });
}

/**
 * Poste un message texte brut dans le channel configuré.
 * @param {string} texte
 */
export async function postMessage(texte) {
  if (!client) return;
  try {
    const channel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);
    if (channel?.isTextBased()) await channel.send(texte);
  } catch (err) {
    console.error('[Bot] ❌ Impossible de poster le message :', err.message);
  }
}

/**
 * Poste un embed dans le channel configuré.
 * @param {import('discord.js').EmbedBuilder} embed
 */
export async function postEmbed(embed) {
  if (!client) {
    console.error('[Bot] ❌ Client Discord non initialisé.');
    return;
  }

  try {
    const channel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);
    if (!channel?.isTextBased()) {
      console.error('[Bot] ❌ Le channel configuré n\'est pas un channel texte.');
      return;
    }
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('[Bot] ❌ Impossible de poster dans le channel :', err.message);
  }
}
