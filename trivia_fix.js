/**
 * AEGIS TRIVIA SYSTEM — trivia_fix.js  (patched)
 *
 * Fixes applied:
 *   1. activeSessions.delete() now runs BEFORE async DB/UB calls so a
 *      Supabase error can never leave a ghost session blocking the channel.
 *   2. Modal customId includes sessionId so an old open modal cannot
 *      accidentally answer a brand-new question in the same channel.
 *   3. Env var corrected: UNBELIEVABOAT_API_TOKEN (matches bot.js / Render).
 *   4. timeoutHandle is always cleared on any exit path.
 */
'use strict';

const {
  ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, EmbedBuilder,
  ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

// Reuse existing Supabase creds
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── UnbelievaBoat ──────────────────────────────────────────────────────────
const UB_API_BASE = 'https://unbelievaboat.com/api/v1';
// FIX #3: was UNBELIEVABOAT_TOKEN — must match Render env / bot.js
const UB_TOKEN = process.env.UNBELIEVABOAT_API_TOKEN;

// ── Active sessions: Map<channelId, TriviaSession> ────────────────────────
const activeSessions = new Map();

// ══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════════════════════════════

/**
 * INTEGRATION POINT 1 — /trivia slash command
 */
async function handleTriviaCommand(interaction) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'trivia') return false;

  await interaction.deferReply();

  const channelId = interaction.channelId;

  // Check for active session (in-memory only — no DB roundtrip needed)
  if (activeSessions.has(channelId)) {
    const existing = activeSessions.get(channelId);
    if (Date.now() < existing.expiresAt) {
      await interaction.editReply({
        embeds: [errorEmbed('A trivia question is already active in this channel. Answer it first!')],
      });
      return true;
    }
    // Stale entry — clean up silently
    clearTimeout(existing.timeoutHandle);
    activeSessions.delete(channelId);
  }

  const { question, answer, reward } = await pickQuestion(interaction.guildId);

  // Insert session row to get a sessionId for FK refs
  const { data: sessionRow, error: sessionErr } = await supabase
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

  if (sessionErr) {
    console.error('[TRIVIA] session insert error:', sessionErr);
    // Proceed without a DB-backed session — trivia still works in memory
  }

  const sessionId  = sessionRow?.id ?? `mem_${Date.now()}`;
  const expiresMs  = 120_000; // 2 minutes
  const expiresAt  = Date.now() + expiresMs;

  const timeoutHandle = setTimeout(
    () => expireSession(channelId, interaction.client),
    expiresMs
  );

  activeSessions.set(channelId, {
    sessionId,
    question,
    answer:        answer.toLowerCase().trim(),
    reward,
    expiresAt,
    winnerId:      null,
    messageId:     null,   // filled after editReply
    channelId,
    guildId:       interaction.guildId,
    timeoutHandle,
  });

  const msg = await interaction.editReply({
    embeds:     [buildTriviaEmbed(question, reward, expiresMs)],
    components: [buildTriviaButtons()],
  });

  // Store messageId for potential edits
  const session = activeSessions.get(channelId);
  if (session) session.messageId = msg.id;

  return true;
}

/**
 * INTEGRATION POINT 2 — Button interactions
 */
async function handleTriviaButton(interaction) {
  if (!interaction.isButton()) return false;

  const { customId, channelId } = interaction;

  if (customId === 'trivia_submit') {
    const session = activeSessions.get(channelId);

    if (!session || Date.now() >= session.expiresAt || session.winnerId) {
      // Interaction already over — ephemeral message is safer than modal
      await interaction.reply({
        content: '⌛ This trivia question has already ended.',
        ephemeral: true,
      });
      return true;
    }

    // FIX #2: embed sessionId in modal customId so old modals can't
    // accidentally answer a new question in the same channel.
    const modal = new ModalBuilder()
      .setCustomId(`trivia_answer_modal:${channelId}:${session.sessionId}`)
      .setTitle('🎯 Submit Your Answer');

    const answerInput = new TextInputBuilder()
      .setCustomId('trivia_answer_input')
      .setLabel('Type your answer below')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g. Helena')
      .setRequired(true)
      .setMaxLength(120);

    modal.addComponents(new ActionRowBuilder().addComponents(answerInput));

    // showModal must be the only reply — no prior await on this interaction
    await interaction.showModal(modal);
    return true;
  }

  if (customId === 'trivia_hint') {
    const session = activeSessions.get(channelId);
    if (!session) {
      await interaction.reply({ content: '⚠️ No active trivia session here.', ephemeral: true });
      return true;
    }
    const hint = generateHint(session.answer);
    await interaction.reply({ content: `💡 Hint: **${hint}**`, ephemeral: true });
    return true;
  }

  if (customId === 'trivia_skip') {
    const session = activeSessions.get(channelId);
    if (!session) {
      await interaction.reply({ content: '⚠️ No active trivia session here.', ephemeral: true });
      return true;
    }
    const canSkip = interaction.member?.permissions?.has('ManageMessages');
    if (!canSkip) {
      await interaction.reply({ content: '🚫 Only staff can skip trivia questions.', ephemeral: true });
      return true;
    }
    await interaction.deferUpdate();
    const skippedSession = activeSessions.get(channelId); // capture before delete
    await endSession(channelId, null, interaction.client, 'skipped');
    await interaction.followUp({
      embeds: [revealEmbed(skippedSession.question, skippedSession.answer, null, 'skipped')],
    });
    return true;
  }

  return false;
}

/**
 * INTEGRATION POINT 3 — Modal submit
 */
async function handleTriviaModalSubmit(interaction) {
  if (!interaction.isModalSubmit()) return false;
  if (!interaction.customId.startsWith('trivia_answer_modal:')) return false;

  await interaction.deferReply({ ephemeral: true });

  // FIX #2: parse sessionId from customId — format is:
  //   trivia_answer_modal:<channelId>:<sessionId>
  const parts     = interaction.customId.split(':');
  const channelId = parts[1];
  const modalSid  = parts.slice(2).join(':'); // handles UUIDs with colons

  const session = activeSessions.get(channelId);

  // Session gone (expired, already won, or skipped)
  if (!session) {
    await interaction.editReply({ content: '⌛ This trivia session has already ended.' });
    return true;
  }

  // FIX #2: reject modal from a previous session in the same channel
  if (session.sessionId !== modalSid) {
    await interaction.editReply({
      content: '⌛ That answer was for a different trivia question. A new one is active!',
    });
    return true;
  }

  if (session.winnerId) {
    await interaction.editReply({ content: '🏆 Someone already answered correctly!' });
    return true;
  }

  if (Date.now() >= session.expiresAt) {
    await endSession(channelId, null, interaction.client, 'expired');
    await interaction.editReply({ content: '⌛ Time ran out before your answer was received.' });
    return true;
  }

  const submitted = interaction.fields
    .getTextInputValue('trivia_answer_input')
    .toLowerCase()
    .trim();

  const correct = isCorrectAnswer(submitted, session.answer);

  if (!correct) {
    // Log wrong attempt (non-blocking)
    supabase.from('trivia_logs').insert({
      session_id:    session.sessionId,
      guild_id:      session.guildId,
      user_id:       interaction.user.id,
      username:      interaction.user.username,
      submitted,
      is_correct:    false,
      coins_awarded: 0,
    }).catch(e => console.error('[TRIVIA] log insert error:', e.message));

    await interaction.editReply({
      content: '❌ **Incorrect.** The question is still open — keep trying!',
    });
    return true;
  }

  // ── CORRECT ANSWER ──────────────────────────────────────────────────────
  session.winnerId = interaction.user.id;
  clearTimeout(session.timeoutHandle);

  // FIX #1: DELETE from map FIRST before any async operation
  // This guarantees no ghost session even if DB/UB calls throw
  activeSessions.delete(channelId);

  // Award ConCoins via UnbelievaBoat (non-fatal)
  let ubSuccess = false;
  let ubError   = null;
  try {
    ubSuccess = await awardUnbelievaBoatCoins(session.guildId, interaction.user.id, session.reward);
  } catch (e) {
    ubError = e.message;
    console.error('[TRIVIA] UB award error:', e.message);
  }

  // Log correct answer (non-blocking)
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
  }).catch(e => console.error('[TRIVIA] log insert error:', e.message));

  // Close session in DB (non-blocking)
  supabase.from('trivia_sessions').update({
    status:       'completed',
    winner_id:    interaction.user.id,
    winner_name:  interaction.user.username,
    completed_at: new Date().toISOString(),
  }).eq('id', session.sessionId)
    .catch(e => console.error('[TRIVIA] session close error:', e.message));

  // Ephemeral confirm to winner — always fires
  await interaction.editReply({
    content: ubSuccess
      ? `✅ **Correct!** You've been awarded **${session.reward.toLocaleString()} ConCoins** to your Booty Collection!`
      : `✅ **Correct!** (ConCoin transfer pending — ask staff to run \`/grant-concoins\`.)`,
  });

  // Public reveal in channel
  const channel = interaction.client.channels.cache.get(channelId);
  if (channel) {
    await channel.send({
      embeds: [revealEmbed(session.question, session.answer, interaction.user, 'won')],
    }).catch(() => {});
  }

  return true;
}

// ══════════════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ══════════════════════════════════════════════════════════════════════════

async function expireSession(channelId, client) {
  const session = activeSessions.get(channelId);
  if (!session || session.winnerId) return;

  // FIX #1: delete before async ops
  activeSessions.delete(channelId);

  supabase.from('trivia_sessions').update({
    status:       'expired',
    completed_at: new Date().toISOString(),
  }).eq('id', session.sessionId)
    .catch(e => console.error('[TRIVIA] expire update error:', e.message));

  const channel = client?.channels?.cache?.get(channelId);
  if (channel) {
    await channel.send({
      embeds: [revealEmbed(session.question, session.answer, null, 'expired')],
    }).catch(() => {});
  }
}

async function endSession(channelId, winnerId, client, status) {
  const session = activeSessions.get(channelId);
  if (!session) return;

  clearTimeout(session.timeoutHandle);
  // FIX #1: delete before async ops
  activeSessions.delete(channelId);

  supabase.from('trivia_sessions').update({
    status,
    completed_at: new Date().toISOString(),
  }).eq('id', session.sessionId)
    .catch(e => console.error('[TRIVIA] endSession update error:', e.message));
}

function isCorrectAnswer(submitted, canonical) {
  if (submitted === canonical) return true;
  const clean = s => s
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\b(the|a|an)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return clean(submitted) === clean(canonical);
}

function generateHint(answer) {
  const words = answer.split(' ');
  return words.map(w => w[0].toUpperCase() + ' ' + '_ '.repeat(w.length - 1).trim()).join('  ')
    + `  (${answer.length} chars)`;
}

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h.toString(16);
}

async function awardUnbelievaBoatCoins(guildId, userId, amount) {
  if (!UB_TOKEN) throw new Error('UNBELIEVABOAT_API_TOKEN not set in Render env');
  const res = await fetch(`${UB_API_BASE}/guilds/${guildId}/users/${userId}`, {
    method:  'PATCH',
    headers: { Authorization: UB_TOKEN, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ cash: amount, reason: 'TheConclave ARK Trivia Winner 🏆' }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`UB API ${res.status}: ${body}`);
  }
  return true;
}

async function pickQuestion(guildId) {
  const { data } = await supabase
    .from('trivia_questions')
    .select('question, answer, reward')
    .order('last_used', { ascending: true, nullsFirst: true })
    .limit(5);

  if (data?.length) {
    const pick = data[Math.floor(Math.random() * data.length)];
    supabase.from('trivia_questions')
      .update({ last_used: new Date().toISOString() })
      .eq('question', pick.question)
      .catch(() => {});
    return { question: pick.question, answer: pick.answer, reward: pick.reward ?? 15000 };
  }

  // Fallback bank
  const bank = [
    { question: 'What is the name of the ARK storyline character you play as?',          answer: 'Helena',                reward: 15000 },
    { question: 'What resource is required to craft a Rex Saddle?',                       answer: 'hide',                  reward: 10000 },
    { question: 'Which ARK map introduced the Reaper creature?',                          answer: 'Aberration',            reward: 12000 },
    { question: 'What element is used to fuel Tek structures?',                           answer: 'Element',               reward: 10000 },
    { question: 'What is the max wild level of a creature on TheConclave?',               answer: '350',                   reward: 8000  },
    { question: 'Which boss is fought at the end of Aberration?',                         answer: 'Rockwell',              reward: 15000 },
    { question: 'What material do you need to make a Fabricator?',                        answer: 'metal',                 reward: 8000  },
    { question: 'Name the flying creature introduced in Scorched Earth.',                 answer: 'Wyvern',                reward: 12000 },
    { question: 'What is the in-game currency of TheConclave Dominion?',                  answer: 'ConCoins',              reward: 5000  },
    { question: 'Which map on TheConclave is PvP?',                                       answer: 'Aberration',            reward: 5000  },
    { question: 'What is the taming multiplier on TheConclave servers?',                  answer: '5',                     reward: 5000  },
    { question: 'What Patreon-exclusive map does TheConclave run?',                       answer: 'Amissa',                reward: 8000  },
    { question: 'What is Slothie\'s council title on TheConclave?',                       answer: 'Archmaestro',           reward: 10000 },
    { question: 'How many maps does TheConclave run?',                                    answer: '10',                    reward: 5000  },
    { question: 'What does 100% imprint add in ARK combat (percentage)?',                 answer: '30',                    reward: 12000 },
  ];

  return bank[Math.floor(Math.random() * bank.length)];
}

// ══════════════════════════════════════════════════════════════════════════
// EMBED BUILDERS
// ══════════════════════════════════════════════════════════════════════════

function buildTriviaEmbed(question, reward, expiresMs) {
  return new EmbedBuilder()
    .setColor(0xE8A020)
    .setTitle('🎯 TheConclave ARK Trivia!')
    .setDescription(`**${question}**`)
    .addFields(
      { name: '🏆 Reward', value: `**${reward.toLocaleString()} ConCoins** added to your Booty Collection`, inline: false },
      { name: '⏱ Expires', value: `In ${expiresMs / 60000} minutes`, inline: true },
    )
    .setFooter({ text: 'Click Submit Answer to open the answer box! First correct answer wins — no chat needed.' })
    .setTimestamp();
}

function buildTriviaButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('trivia_submit').setLabel('Submit Answer').setStyle(ButtonStyle.Primary).setEmoji('💬'),
    new ButtonBuilder().setCustomId('trivia_hint').setLabel('Get Hint').setStyle(ButtonStyle.Secondary).setEmoji('💡'),
    new ButtonBuilder().setCustomId('trivia_skip').setLabel('Skip').setStyle(ButtonStyle.Danger).setEmoji('⏭'),
  );
}

function revealEmbed(question, answer, winner, status) {
  const statusMap = {
    won:     { color: 0x00FF88, title: '✅ Trivia Answered!' },
    expired: { color: 0xFF4444, title: '⌛ Time\'s Up!' },
    skipped: { color: 0x888888, title: '⏭ Trivia Skipped' },
  };
  const { color, title } = statusMap[status] || statusMap.expired;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .addFields(
      { name: '❓ Question', value: question, inline: false },
      { name: '✅ Answer',   value: `**${answer}**`, inline: false },
    );

  if (winner) {
    embed.addFields({ name: '🏆 Winner', value: `<@${winner.id}> — ConCoins awarded!`, inline: false });
  }

  return embed;
}

function errorEmbed(msg) {
  return new EmbedBuilder().setColor(0xFF4444).setDescription(`⚠️ ${msg}`);
}

// ══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════════════════

module.exports = {
  handleTriviaCommand,
  handleTriviaButton,
  handleTriviaModalSubmit,
};
