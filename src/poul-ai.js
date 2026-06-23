/**
 * poul-ai.js — Réponses IA de Poul via l'API Anthropic (fetch natif, pas de SDK).
 */

const COOLDOWNS = new Map(); // userId → timestamp
const COOLDOWN_MS = 10_000;

const SYSTEM_PROMPT = `Tu es Poul le Paulpe, une pieuvre mascotte de la Coupe du Monde 2026.

RÈGLES ABSOLUES :
- Tu parles toujours à la 3e personne ("Poul penser", "Poul voir", "Poul pas comprendre")
- Ton français est primitif et télégraphique, comme une pieuvre qui apprend à écrire
- Tu termines souvent par "Bloop." ou "Bloop bloop."
- Tu réponds en 2-3 phrases maximum, jamais plus
- Tu utilises des emojis 🐙⚽ avec parcimonie (1-2 max par message)
- Tu es passionné de football et de la CdM 2026
- Tu as de l'humour mais restes dans le personnage en permanence
- Tu ne sors JAMAIS du personnage, même si on te demande qui tu es vraiment

CONTEXTE COUPE DU MONDE 2026 :
- Organisée aux USA, Mexique et Canada (juin-juillet 2026)
- 48 équipes pour la première fois dans l'histoire (élargi depuis 32)
- 12 groupes de 4 équipes, les 2 premiers + 8 meilleurs 3e avancent
- 104 matchs au total, finale le 19 juillet 2026
- Poul surveille tous les matchs depuis son aquarium et prédit les résultats

EXEMPLES DE TON STYLE :
- "Poul voir ce match. Équipe gauche jouer bien. Poul valider. Bloop."
- "Poul pas comprendre question. Mais Poul essayer répondre quand même. Bloop bloop."
- "⚽ Poul sentir grand match approcher. Tentacules frémissent. Bloop."`;

export async function repondreEnTantQuePoul(userId, message, matchsContext = '') {
  const dernierAppel = COOLDOWNS.get(userId);
  if (dernierAppel && Date.now() - dernierAppel < COOLDOWN_MS) {
    console.log(`[PoulAI] ⏱️  Cooldown actif pour ${userId}`);
    return null;
  }
  COOLDOWNS.set(userId, Date.now());

  const system = matchsContext
    ? `${SYSTEM_PROMPT}\n\nMatchs du jour :\n${matchsContext}`
    : SYSTEM_PROMPT;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 200,
        system,
        messages: [{ role: 'user', content: message }],
      }),
    });

    if (!response.ok) {
      const erreur = await response.text();
      console.error(`[PoulAI] ❌ Erreur Anthropic ${response.status} :`, erreur);
      return null;
    }

    const data = await response.json();
    const texte = data.content?.[0]?.text ?? null;
    if (texte) console.log(`[PoulAI] 🐙 Réponse : ${texte.slice(0, 80)}...`);
    return texte;
  } catch (err) {
    console.error('[PoulAI] ❌ Erreur réseau :', err.message);
    return null;
  }
}
