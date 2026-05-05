/**
 * AEGIS TRIVIA SYSTEM — trivia_fix.js
 * Drop-in module for conclave-aegis-discord-core/bot.js
 *
 * Fixes:
 *   - "This interaction failed" on Submit Answer: modal must be shown
 *     synchronously (zero async before showModal)
 *   - Answer validation with fuzzy matching
 *   - ConCoin award via UnbelievaBoat REST API
 *   - Full Supabase audit trail (trivia_sessions + trivia_logs)
 *
 * Integration points — search bot.js for each INTEGRATION POINT comment
 * and splice in the referenced call.
 */

'use strict';

const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

// ─── Supabase client (reuse existing if bot.js already initialises one) ───────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─── UnbelievaBoat API ────────────────────────────────────────────────────────
const UB_API_BASE = 'https://unbelievaboat.com/api/v1';
const UB_TOKEN    = process.env.UNBELIEVABOAT_TOKEN; // add to Render env vars

// ─── Active trivia sessions: Map<channelId, TriviaSession> ───────────────────
const activeSessions = new Map();

/**
 * TriviaSession shape:
 * {
 *   sessionId: string (uuid from Supabase insert),
 *   question:  string,
 *   answer:    string,   // canonical lowercase trimmed
 *   reward:    number,   // ConCoins
 *   expiresAt: number,   // Date.now() + ms
 *   winnerId:  string | null,
 *   messageId: string,
 *   channelId: string,
 *   guildId:   string,
 *   timeoutHandle: NodeJS.Timeout
 * }
 */

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * INTEGRATION POINT 1 — /trivia slash command handler
 * Replace your existing trivia command execute block with this.
 */
async function handleTriviaCommand(interaction) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'trivia') return false;

  await interaction.deferReply(); // safe to defer for slash command

  const channelId = interaction.channelId;
  if (activeSessions.has(channelId)) {
    await interaction.editReply({
      embeds: [errorEmbed('A trivia question is already active in this channel. Answer it first!')]
    });
    return true;
  }

  // Pick question — pull from Supabase trivia_questions table or use inline bank
  const { question, answer, reward } = await pickQuestion(interaction.guildId);

  // Insert session row BEFORE posting (get sessionId for FK refs)
  const { data: sessionRow, error: sessionErr } = await supabase
    .from('trivia_sessions')
    .insert({
      guild_id:    interaction.guildId,
      channel_id:  channelId,
      question,
      answer_hash: simpleHash(answer.toLowerCase().trim()),
      reward,
      started_by:  interaction.user.id,
      status:      'active'
    })
    .select('id')
    .single();

  if (sessionErr) {
    console.error('[TRIVIA] session insert error:', sessionErr);
    await interaction.editReply({ embeds: [errorEmbed('Failed to start trivia session. Try again.')] });
    return true;
  }

  const expiresMs = 120_000; // 2 minutes
  const expiresAt = Date.now() + expiresMs;

  const embed = buildTriviaEmbed(question, reward, expiresMs);
  const components = buildTriviaButtons();

  const msg = await interaction.editReply({ embeds: [embed], components });

  // Register session
  const timeoutHandle = setTimeout(() => expireSession(channelId, interaction.client), expiresMs);

  activeSessions.set(channelId, {
    sessionId: sessionRow.id,
    question,
    answer:    answer.toLowerCase().trim(),
    reward,
    expiresAt,
    winnerId:  null,
    messageId: msg.id,
    channelId,
    guildId:   interaction.guildId,
    timeoutHandle
  });

  return true;
}

/**
 * INTEGRATION POINT 2 — Button interaction handler
 * Inside your interactionCreate: if (interaction.isButton()) block, call this.
 * It returns true if it handled the interaction, false if unrelated.
 */
async function handleTriviaButton(interaction) {
  if (!interaction.isButton()) return false;

  const { customId, channelId } = interaction;

  if (customId === 'trivia_submit') {
    // ⚡ ZERO async before showModal — this is the fix for "This interaction failed"
    const modal = new ModalBuilder()
      .setCustomId(`trivia_answer_modal:${channelId}`)
      .setTitle('🎯 Submit Your Answer');

    const answerInput = new TextInputBuilder()
      .setCustomId('trivia_answer_input')
      .setLabel('Type your answer below')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g. Helena')
      .setRequired(true)
      .setMaxLength(120);

    modal.addComponents(new ActionRowBuilder().addComponents(answerInput));

    // showModal is the FIRST and ONLY thing we do with this interaction
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
    // Only council/admin can skip — adjust role check to match your permission util
    const member = interaction.member;
    const canSkip = member.permissions.has('ManageMessages');
    if (!canSkip) {
      await interaction.reply({ content: '🚫 Only staff can skip trivia questions.', ephemeral: true });
      return true;
    }
    await interaction.deferUpdate();
    await endSession(channelId, null, interaction.client, 'skipped');
    await interaction.followUp({
      embeds: [revealEmbed(session.question, session.answer, null, 'skipped')]
    });
    return true;
  }

  return false;
}

/**
 * INTEGRATION POINT 3 — Modal submit handler
 * Inside your interactionCreate: if (interaction.isModalSubmit()) block, call this.
 */
async function handleTriviaModalSubmit(interaction) {
  if (!interaction.isModalSubmit()) return false;
  if (!interaction.customId.startsWith('trivia_answer_modal:')) return false;

  // Defer ephemerally immediately
  await interaction.deferReply({ ephemeral: true });

  const channelId = interaction.customId.split(':')[1];
  const session   = activeSessions.get(channelId);

  if (!session) {
    await interaction.editReply({ content: '⌛ This trivia session has already ended.' });
    return true;
  }

  if (session.winnerId) {
    await interaction.editReply({ content: '🏆 Someone already answered correctly!' });
    return true;
  }

  const submitted = interaction.fields
    .getTextInputValue('trivia_answer_input')
    .toLowerCase()
    .trim();

  const correct = isCorrectAnswer(submitted, session.answer);

  if (!correct) {
    // Log wrong attempt
    await supabase.from('trivia_logs').insert({
      session_id: session.sessionId,
      guild_id:   session.guildId,
      user_id:    interaction.user.id,
      username:   interaction.user.username,
      submitted,
      is_correct: false,
      coins_awarded: 0
    });

    await interaction.editReply({
      content: `❌ **Incorrect.** Keep trying — the question is still open!`
    });
    return true;
  }

  // ── WINNER ────────────────────────────────────────────────────────────────
  session.winnerId = interaction.user.id;
  clearTimeout(session.timeoutHandle);

  // Award ConCoins via UnbelievaBoat
  let ubSuccess = false;
  let ubError   = null;
  try {
    ubSuccess = await awardUnbelievaBoatCoins(session.guildId, interaction.user.id, session.reward);
  } catch (e) {
    ubError = e.message;
    console.error('[TRIVIA] UB award error:', e);
  }

  // Log correct answer
  await supabase.from('trivia_logs').insert({
    session_id:    session.sessionId,
    guild_id:      session.guildId,
    user_id:       interaction.user.id,
    username:      interaction.user.username,
    submitted,
    is_correct:    true,
    coins_awarded: ubSuccess ? session.reward : 0,
    ub_success:    ubSuccess,
    ub_error:      ubError
  });

  // Close session in DB
  await supabase
    .from('trivia_sessions')
    .update({
      status:       'completed',
      winner_id:    interaction.user.id,
      winner_name:  interaction.user.username,
      completed_at: new Date().toISOString()
    })
    .eq('id', session.sessionId);

  activeSessions.delete(channelId);

  // Ephemeral confirm to winner
  await interaction.editReply({
    content: ubSuccess
      ? `✅ **Correct!** You've been awarded **${session.reward.toLocaleString()} ConCoins** to your Booty Collection!`
      : `✅ **Correct!** (ConCoin transfer pending — contact staff if not received.)`
  });

  // Public reveal
  const channel = interaction.client.channels.cache.get(channelId);
  if (channel) {
    await channel.send({
      embeds: [revealEmbed(session.question, session.answer, interaction.user, 'won')]
    });
  }

  return true;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function expireSession(channelId, client) {
  const session = activeSessions.get(channelId);
  if (!session || session.winnerId) return;

  await endSession(channelId, null, client, 'expired');

  const channel = client.channels.cache.get(channelId);
  if (channel) {
    await channel.send({
      embeds: [revealEmbed(session.question, session.answer, null, 'expired')]
    });
  }
}

async function endSession(channelId, winnerId, client, status) {
  const session = activeSessions.get(channelId);
  if (!session) return;

  clearTimeout(session.timeoutHandle);
  activeSessions.delete(channelId);

  await supabase
    .from('trivia_sessions')
    .update({ status, completed_at: new Date().toISOString() })
    .eq('id', session.sessionId);
}

function isCorrectAnswer(submitted, canonical) {
  if (submitted === canonical) return true;
  // Fuzzy: strip punctuation/articles and compare
  const clean = s => s.replace(/[^a-z0-9\s]/g, '').replace(/\b(the|a|an)\b/g, '').replace(/\s+/g, ' ').trim();
  return clean(submitted) === clean(canonical);
}

function generateHint(answer) {
  // Reveal first letter + length: H _ _ _ _ _ (6)
  const words = answer.split(' ');
  return words.map(w => w[0].toUpperCase() + ' ' + '_ '.repeat(w.length - 1).trim()).join('  ') +
    `  (${answer.length} chars)`;
}

function simpleHash(str) {
  // Non-cryptographic — just prevents storing raw answers in plaintext session row
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h.toString(16);
}

async function awardUnbelievaBoatCoins(guildId, userId, amount) {
  if (!UB_TOKEN) throw new Error('UNBELIEVABOAT_TOKEN not set');
  const res = await fetch(`${UB_API_BASE}/guilds/${guildId}/users/${userId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': UB_TOKEN,
      'Content-Type':  'application/json'
    },
    body: JSON.stringify({ cash: amount, reason: 'TheConclave ARK Trivia Winner 🏆' })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`UB API ${res.status}: ${body}`);
  }
  return true;
}

async function pickQuestion(guildId) {
  // Try Supabase trivia_questions first
  const { data } = await supabase
    .from('trivia_questions')
    .select('question, answer, reward')
    .order('last_used', { ascending: true, nullsFirst: true })
    .limit(5);

  if (data && data.length > 0) {
    const pick = data[Math.floor(Math.random() * data.length)];
    // Mark as used
    await supabase
      .from('trivia_questions')
      .update({ last_used: new Date().toISOString() })
      .eq('question', pick.question);
    return { question: pick.question, answer: pick.answer, reward: pick.reward ?? 15000 };
  }

  // Fallback inline bank
  const bank = [
    { question: 'What is the name of the ARK storyline character you play as?', answer: 'Helena', reward: 15000 },
    { question: 'What resource is required to craft a Rex Saddle?', answer: 'hide', reward: 10000 },
    { question: 'Which ARK map introduced the Reaper creature?', answer: 'Aberration', reward: 12000 },
    { question: 'What element is used to fuel Tek structures?', answer: 'Element', reward: 10000 },
    { question: 'What is the max wild level of a creature in ARK?', answer: '150', reward: 8000 },
    { question: 'Which boss must you defeat to access Aberration on official servers?', answer: 'Rockwell', reward: 15000 },
    { question: 'What material do you need to make a Fabricator?', answer: 'metal', reward: 8000 },
    { question: 'Name the flying creature introduced in Scorched Earth.', answer: 'Wyvern', reward: 12000 },
    { question: 'What is the in-game currency of TheConclave Dominion?', answer: 'ConCoins', reward: 5000 },
    { question: 'What server cluster does TheConclave Dominion run?', answer: 'ARK Survival Ascended', reward: 5000 },
  ];

  return bank[Math.floor(Math.random() * bank.length)];
}

// ─── Embed builders ───────────────────────────────────────────────────────────

function buildTriviaEmbed(question, reward, expiresMs) {
  return new EmbedBuilder()
    .setColor(0xE8A020)
    .setTitle('🎯 TheConclave ARK Trivia!')
    .setDescription(`**${question}**`)
    .addFields(
      { name: '🏆 Reward', value: `${reward.toLocaleString()} ConCoins added to your Booty Collection`, inline: false },
      { name: '⏱ Expires', value: `In ${expiresMs / 60000} minutes`, inline: true }
    )
    .setFooter({ text: 'Click Submit Answer to open the answer box! First correct answer wins — no chat needed.' })
    .setTimestamp();
}

function buildTriviaButtons() {
  const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('trivia_submit').setLabel('Submit Answer').setStyle(ButtonStyle.Primary).setEmoji('💬'),
      new ButtonBuilder().setCustomId('trivia_hint').setLabel('Get Hint').setStyle(ButtonStyle.Secondary).setEmoji('💡'),
      new ButtonBuilder().setCustomId('trivia_skip').setLabel('Skip').setStyle(ButtonStyle.Danger).setEmoji('⏭')
    )
  ];
}

function revealEmbed(question, answer, winner, status) {
  const statusMap = {
    won:     { color: 0x00FF88, title: '✅ Trivia Answered!' },
    expired: { color: 0xFF4444, title: '⌛ Time\'s Up!' },
    skipped: { color: 0x888888, title: '⏭ Trivia Skipped' }
  };
  const { color, title } = statusMap[status] || statusMap.expired;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .addFields(
      { name: '❓ Question', value: question, inline: false },
      { name: '✅ Answer',   value: answer,   inline: false }
    );

  if (winner) {
    embed.addFields({ name: '🏆 Winner', value: `<@${winner.id}> — ConCoins awarded!`, inline: false });
  }

  return embed;
}

function errorEmbed(msg) {
  return new EmbedBuilder().setColor(0xFF4444).setDescription(`⚠️ ${msg}`);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  handleTriviaCommand,
  handleTriviaButton,
  handleTriviaModalSubmit
};
