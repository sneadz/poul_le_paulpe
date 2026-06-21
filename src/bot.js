/**
 * bot.js — Client Discord : connexion et envoi de messages.
 */

import { Client, GatewayIntentBits } from 'discord.js';

let client = null;

/**
 * Initialise et connecte le client Discord.
 * Retourne une promesse résolue une fois le bot prêt.
 */
export async function connectBot() {
  client = new Client({ intents: [GatewayIntentBits.Guilds] });

  return new Promise((resolve, reject) => {
    client.once('clientReady', async () => {
      console.log(`[Bot] ✅ Connecté en tant que ${client.user.tag}`);
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
