'use strict';

/**
 * AEGIS TRIVIA — trivia_fix.js  FINAL
 *
 * Wire in bot.js AFTER TRIVIA_QUESTIONS is defined:
 *   const _triviaFactory = require('./trivia_fix');          // near top
 *   ...
 *   const { handleTriviaCommand, handleTriviaButton, handleTriviaModalSubmit }
 *     = _triviaFactory(TRIVIA_QUESTIONS);                    // after TRIVIA_QUESTIONS array
 *
 * Root cause of all previous errors:
 *   Supabase v2 query builders are thenables, NOT real Promises.
 *   .catch() does not exist on them. All fire-and-forget DB writes
 *   go through dbFire() which wraps the query in Promise.resolve()
 *   first, giving us a real Promise before we attach error handling.
 */

module.exports = function triviaFactory(questionBank) {

const {
  ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, EmbedBuilder,
  ButtonBuilder, ButtonStyle,
} = require('discord.js');

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const UB_TOKEN = process.env.UNBELIEVABOAT_API_TOKEN;

// ─────────────────────────────────────────────────────────────────────
// dbFire — safe fire-and-forget for Supabase queries
// Promise.resolve() converts any thenable into a real Promise so
// .catch() actually works. Never throws — just logs on error.
// ─────────────────────────────────────────────────────────────────────
function dbFire(query, label) {
  Promise.resolve(query).catch(e =>
    console.error(`[TRIVIA DB:${label}]`, e?.message || String(e))
  );
}

// ─────────────────────────────────────────────────────────────────────
// Active sessions  Map<channelId, Session>
// ─────────────────────────────────────────────────────────────────────
const activeSessions = new Map();

// ═════════════════════════════════════════════════════════════════════
// 1. /trivia slash command
// ═════════════════════════════════════════════════════════════════════
async function handleTriviaCommand(interaction) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'trivia') return false;

  await interaction.deferReply();

  const channelId = interaction.channelId;

  if (activeSessions.has(channelId)) {
    const stale = activeSessions.get(channelId);
    if (Date.now() < stale.expiresAt) {
      await interaction.editReply({
        embeds: [errorEmbed('A trivia question is already active here. Answer it first!')],
      });
      return true;
    }
    clearTimeout(stale.timeoutHandle);
    activeSessions.delete(channelId);
  }

  const { question, answer, hint, reward } = pickQuestion();

  // Try to persist session row — but trivia works without it
  let sessionId = `mem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  try {
    const { data, error } = await supabase
      .from('trivia_sessions')
      .insert({
        guild_id:    interaction.guildId,
        channel_id:  channelId,
        question,
        answer_hash: simpleHash(answer.toLowerCase().trim()),
        reward,
        started_by:  interaction.user.id,
        status:      'active',
      })
      .select('id')
      .single();
    if (!error && data?.id) sessionId = data.id;
  } catch (e) {
    console.error('[TRIVIA] session insert:', e?.message || e);
  }

  const expiresMs     = 120_000;
  const expiresAt     = Date.now() + expiresMs;
  const timeoutHandle = setTimeout(
    () => expireSession(channelId, interaction.client),
    expiresMs
  );

  activeSessions.set(channelId, {
    sessionId,
    question,
    answer:        answer.toLowerCase().trim(),
    hint:          hint || '',
    reward,
    expiresAt,
    winnerId:      null,
    channelId,
    guildId:       interaction.guildId,
    timeoutHandle,
  });

  await interaction.editReply({
    embeds:     [buildTriviaEmbed(question, reward, expiresMs)],
    components: [buildTriviaButtons()],
  });

  return true;
}

// ═════════════════════════════════════════════════════════════════════
// 2. Button interactions
// ═════════════════════════════════════════════════════════════════════
async function handleTriviaButton(interaction) {
  if (!interaction.isButton()) return false;

  const { customId, channelId } = interaction;

  if (customId === 'trivia_submit') {
    const session = activeSessions.get(channelId);
    if (!session || Date.now() >= session.expiresAt || session.winnerId) {
      await interaction.reply({ content: '⌛ This trivia question has already ended.', ephemeral: true });
      return true;
    }
    // sessionId baked into customId so old modals can't answer new questions
    const modal = new ModalBuilder()
      .setCustomId(`trivia_modal:${channelId}:${session.sessionId}`)
      .setTitle('🎯 Submit Your Answer');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('answer_input')
          .setLabel('Your answer')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(200)
      )
    );
    await interaction.showModal(modal); // must be only reply
    return true;
  }

  if (customId === 'trivia_hint') {
    const session = activeSessions.get(channelId);
    if (!session) {
      await interaction.reply({ content: '⚠️ No active trivia here.', ephemeral: true });
      return true;
    }
    const hintText = session.hint || generateHint(session.answer);
    await interaction.reply({ content: `💡 **Hint:** ${hintText}`, ephemeral: true });
    return true;
  }

  if (customId === 'trivia_skip') {
    const session = activeSessions.get(channelId);
    if (!session) {
      await interaction.reply({ content: '⚠️ No active trivia here.', ephemeral: true });
      return true;
    }
    if (!interaction.member?.permissions?.has('ManageMessages')) {
      await interaction.reply({ content: '🚫 Staff only.', ephemeral: true });
      return true;
    }
    await interaction.deferUpdate();
    const { question, answer, sessionId } = session;
    clearTimeout(session.timeoutHandle);
    activeSessions.delete(channelId);
    dbFire(
      supabase.from('trivia_sessions')
        .update({ status: 'skipped', completed_at: new Date().toISOString() })
        .eq('id', sessionId),
      'skip'
    );
    await interaction.followUp({ embeds: [revealEmbed(question, answer, null, 'skipped')] });
    return true;
  }

  return false;
}

// ═════════════════════════════════════════════════════════════════════
// 3. Modal submit
// ═════════════════════════════════════════════════════════════════════
async function handleTriviaModalSubmit(interaction) {
  if (!interaction.isModalSubmit()) return false;
  if (!interaction.customId.startsWith('trivia_modal:')) return false;

  await interaction.deferReply({ ephemeral: true });

  const parts     = interaction.customId.split(':');
  const channelId = parts[1];
  const modalSid  = parts.slice(2).join(':');

  const session = activeSessions.get(channelId);

  if (!session) {
    await interaction.editReply({ content: '⌛ This trivia session has already ended.' });
    return true;
  }
  if (String(session.sessionId) !== String(modalSid)) {
    await interaction.editReply({ content: '⌛ That was for a different question. A new one is active!' });
    return true;
  }
  if (session.winnerId) {
    await interaction.editReply({ content: '🏆 Someone already answered correctly!' });
    return true;
  }
  if (Date.now() >= session.expiresAt) {
    clearTimeout(session.timeoutHandle);
    activeSessions.delete(channelId);
    await interaction.editReply({ content: '⌛ Time ran out before your answer arrived.' });
    return true;
  }

  const submitted = interaction.fields.getTextInputValue('answer_input').toLowerCase().trim();
  const correct   = isCorrectAnswer(submitted, session.answer);

  if (!correct) {
    dbFire(
      supabase.from('trivia_logs').insert({
        session_id:    session.sessionId,
        guild_id:      session.guildId,
        user_id:       interaction.user.id,
        username:      interaction.user.username,
        submitted,
        is_correct:    false,
        coins_awarded: 0,
      }),
      'wrong-log'
    );
    await interaction.editReply({ content: '❌ **Incorrect.** The question is still open — keep trying!' });
    return true;
  }

  // ── CORRECT ──────────────────────────────────────────────────────
  session.winnerId = interaction.user.id;
  clearTimeout(session.timeoutHandle);
  activeSessions.delete(channelId); // DELETE FIRST — before any async

  let ubSuccess = false, ubError = null;
  try {
    ubSuccess = await awardCoins(session.guildId, interaction.user.id, session.reward);
  } catch (e) {
    ubError = e.message;
    console.error('[TRIVIA] UB award error:', e.message);
  }

  dbFire(
    supabase.from('trivia_logs').insert({
      session_id:    session.sessionId,
      guild_id:      session.guildId,
      user_id:       interaction.user.id,
      username:      interaction.user.username,
      submitted,
      is_correct:    true,
      coins_awarded: ubSuccess ? session.reward : 0,
      ub_success:    ubSuccess,
      ub_error:      ubError,
    }),
    'correct-log'
  );

  dbFire(
    supabase.from('trivia_sessions').update({
      status:       'completed',
      winner_id:    interaction.user.id,
      winner_name:  interaction.user.username,
      completed_at: new Date().toISOString(),
    }).eq('id', session.sessionId),
    'session-close'
  );

  // Reply always fires — no dependency on DB or UB success
  await interaction.editReply({
    content: ubSuccess
      ? `✅ **Correct!** **${session.reward.toLocaleString()} ConCoins** sent to your wallet!`
      : `✅ **Correct!** (Ask staff to run \`/grant-concoins\` if coins don't appear.)`,
  });

  const ch = interaction.client.channels.cache.get(channelId);
  if (ch) {
    Promise.resolve(
      ch.send({ embeds: [revealEmbed(session.question, session.answer, interaction.user, 'won')] })
    ).catch(() => {});
  }

  return true;
}

// ═════════════════════════════════════════════════════════════════════
// INTERNAL
// ═════════════════════════════════════════════════════════════════════

async function expireSession(channelId, client) {
  const session = activeSessions.get(channelId);
  if (!session || session.winnerId) return;
  activeSessions.delete(channelId);
  dbFire(
    supabase.from('trivia_sessions')
      .update({ status: 'expired', completed_at: new Date().toISOString() })
      .eq('id', session.sessionId),
    'expire'
  );
  const ch = client?.channels?.cache?.get(channelId);
  if (ch) {
    Promise.resolve(
      ch.send({ embeds: [revealEmbed(session.question, session.answer, null, 'expired')] })
    ).catch(() => {});
  }
}

function pickQuestion() {
  if (questionBank?.length) {
    const raw = questionBank[Math.floor(Math.random() * questionBank.length)];
    return { question: raw.q, answer: raw.a, hint: raw.hint || '', reward: 15000 };
  }
  return { question: 'Which map on TheConclave is PvP?', answer: 'aberration', hint: 'Underground biomes.', reward: 15000 };
}

function isCorrectAnswer(submitted, canonical) {
  if (submitted === canonical) return true;
  const clean = s => s.replace(/[^a-z0-9\s]/g,'').replace(/\b(the|a|an)\b/g,'').replace(/\s+/g,' ').trim();
  return clean(submitted) === clean(canonical);
}

function generateHint(answer) {
  return answer.split(' ').map(w => w[0].toUpperCase() + ' ' + '_ '.repeat(w.length - 1).trim()).join('  ')
    + ` (${answer.length} chars)`;
}

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h.toString(16);
}

async function awardCoins(guildId, userId, amount) {
  if (!UB_TOKEN) throw new Error('UNBELIEVABOAT_API_TOKEN not set in Render env');
  const res = await fetch(`https://unbelievaboat.com/api/v1/guilds/${guildId}/users/${userId}`, {
    method:  'PATCH',
    headers: { Authorization: UB_TOKEN, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ cash: amount, reason: 'TheConclave ARK Trivia Winner 🏆' }),
  });
  if (!res.ok) throw new Error(`UB API ${res.status}: ${await res.text()}`);
  return true;
}

// ─── Embeds ──────────────────────────────────────────────────────────

function buildTriviaEmbed(question, reward, expiresMs) {
  return new EmbedBuilder()
    .setColor(0xE8A020)
    .setAuthor({ name: 'AEGIS · DOMINION TRIVIA' })
    .setTitle('❓ A Question Emerges from the Void')
    .setDescription(`\`\`\`${question}\`\`\`\n*First correct answer claims the vault.*`)
    .addFields(
      { name: '🏆 Reward',     value: `${reward.toLocaleString()} **ConCoins**`, inline: true },
      { name: '⚡ Difficulty', value: 'MEDIUM',                                  inline: true },
      { name: '⏳ Closes',     value: `in ${expiresMs / 60000} minutes`,         inline: true },
    )
    .setFooter({ text: 'Hit Answer · Hint is ephemeral · Skip is staff-only · TheConclave Dominion' })
    .setTimestamp();
}

function buildTriviaButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('trivia_submit').setLabel('Answer').setStyle(ButtonStyle.Primary).setEmoji('🗡️'),
    new ButtonBuilder().setCustomId('trivia_hint').setLabel('Hint').setStyle(ButtonStyle.Secondary).setEmoji('🔵'),
    new ButtonBuilder().setCustomId('trivia_skip').setLabel('Skip [Staff]').setStyle(ButtonStyle.Danger).setEmoji('⏭'),
  );
}

function revealEmbed(question, answer, winner, status) {
  const cfg = {
    won:     { color: 0x00FF88, title: '✅ Correct Answer!' },
    expired: { color: 0xFF4444, title: '⌛ Time\'s Up!' },
    skipped: { color: 0x888888, title: '⏭ Question Skipped' },
  };
  const { color, title } = cfg[status] || cfg.expired;
  const emb = new EmbedBuilder().setColor(color).setTitle(title)
    .addFields(
      { name: '❓ Question', value: question,        inline: false },
      { name: '✅ Answer',   value: `**${answer}**`, inline: false },
    );
  if (winner) emb.addFields({ name: '🏆 Winner', value: `<@${winner.id}> — ConCoins awarded!`, inline: false });
  return emb;
}

function errorEmbed(msg) {
  return new EmbedBuilder().setColor(0xFF4444).setDescription(`⚠️ ${msg}`);
}

return { handleTriviaCommand, handleTriviaButton, handleTriviaModalSubmit };

}; // end triviaFactory
