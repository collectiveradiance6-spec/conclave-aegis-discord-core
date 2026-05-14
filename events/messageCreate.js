// events/messageCreate.js — Trivia answer checking
'use strict';

const { Events } = require('discord.js');
const { sb, sbOk, dbFire } = require('../services/supabase');

module.exports = {
  name: Events.MessageCreate,
  once: false,

  async execute(message) {
    if (message.author.bot) return;
    if (!message.guild) return;

    // ── Trivia answer checking ───────────────────────────────────
    // Import activeTrivias from the trivia command module
    let activeTrivias, CONCOIN_REWARD;
    try {
      const triviaCmd = require('../commands/fun/fun.js').find?.(c=>c.data?.name==='trivia') ||
                        require('../commands/fun/fun.js')[0];
      activeTrivias   = triviaCmd?.activeTrivias;
      CONCOIN_REWARD  = triviaCmd?.CONCOIN_REWARD || 15000;
    } catch { return; }

    if (!activeTrivias) return;
    const active = activeTrivias.get(message.channelId);
    if (!active) return;
    if (Date.now() > active.expiresAt) { activeTrivias.delete(message.channelId); return; }

    const answer = active.a?.toLowerCase().trim();
    const userAnswer = message.content.toLowerCase().trim();

    // Smart match — extract keywords
    const keywords = answer.split(/\s+/).filter(w=>w.length>2);
    const isCorrect = keywords.length > 0
      ? keywords.every(kw => userAnswer.includes(kw))
      : userAnswer === answer;

    if (!isCorrect) return;

    activeTrivias.delete(message.channelId);

    // Award ConCoins
    const userId  = message.author.id;
    const userTag = message.author.username;

    if (sb && sbOk()) {
      // Upsert concoin booty
      const { data:existing } = await sb.from('aegis_concoin_booty')
        .select('booty,total_earned')
        .eq('discord_id',userId).single().catch(()=>({data:null}));

      const currentBooty    = existing?.booty || 0;
      const currentTotal    = existing?.total_earned || 0;

      await sb.from('aegis_concoin_booty').upsert({
        discord_id:   userId,
        discord_tag:  userTag,
        booty:        currentBooty + CONCOIN_REWARD,
        total_earned: currentTotal + CONCOIN_REWARD,
        last_won:     new Date().toISOString(),
        updated_at:   new Date().toISOString(),
      }, { onConflict:'discord_id' });
    }

    await message.reply({
      embeds: [{
        color: 0x35ED7E,
        title: '🎉 Correct Answer!',
        description: [
          `**${message.author.username}** got it right!`,
          `> ✅ **Answer:** ${active.a}`,
          ``,
          `> 🪙 **+${CONCOIN_REWARD.toLocaleString()} ConCoins** added to your booty!`,
          `-# Use \`/concoin-booty\` to check · \`/deposit-concoins\` to cash out`,
        ].join('\n'),
        footer: { text:'AEGIS Trivia System' },
      }],
    }).catch(()=>{});
  },
};
