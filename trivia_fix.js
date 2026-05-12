'use strict';

/**
 * AEGIS TRIVIA — trivia_fix.js  FINAL v2
 *
 * Architecture: triviaFactory(questionBank) — pass TRIVIA_QUESTIONS from bot.js
 * after the array is defined.
 *
 * Wire in bot.js:
 *   const _triviaFactory = require('./trivia_fix');
 *   // ... after TRIVIA_QUESTIONS array ...
 *   const { handleTriviaCommand, handleTriviaButton, handleTriviaModalSubmit }
 *     = _triviaFactory(TRIVIA_QUESTIONS);
 *
 * Root cause of Supabase errors:
 *   Supabase v2 query builders are thenables, NOT real Promises.
 *   .catch() does not exist on them. All fire-and-forget DB writes
 *   go through dbFire() which wraps in Promise.resolve() first.
 */

module.exports = function triviaFactory(questionBank, { addConcoinBooty } = {}) {

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
// dbFire — safe fire-and-forget for Supabase v2 thenables
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

  // Try to persist session row — trivia works without it
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
    console.error('[TRIVIA] session insert (non-fatal):', e?.message || e);
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
    const modal = new ModalBuilder()
      .setCustomId(`trivia_modal:${channelId}:${session.sessionId}`)
      .setTitle('⚔️ Claim the Vault');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('answer_input')
          .setLabel('Your Answer')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Type your answer — first correct wins')
          .setRequired(true)
          .setMaxLength(200)
      )
    );
    await interaction.showModal(modal);
    return true;
  }

  if (customId === 'trivia_hint') {
    const session = activeSessions.get(channelId);
    if (!session) {
      await interaction.reply({ content: '⚠️ No active trivia here.', ephemeral: true });
      return true;
    }
    const hintText = session.hint || generateHint(session.answer);
    await interaction.reply({ content: `🔍 **Hint:** ${hintText}`, ephemeral: true });
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
    await interaction.editReply({ content: '❌ **Wrong.** The question is still open — try again.' });
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

  // ── ALWAYS store booty regardless of UB outcome ──────────────────
  // addConcoinBooty is injected from bot.js — tracks pending payouts in Supabase
  let bootyData = null;
  if (typeof addConcoinBooty === 'function') {
    try {
      bootyData = await addConcoinBooty(
        interaction.user.id,
        interaction.user.username,
        session.reward,
        'Trivia Win'
      );
    } catch (e) {
      console.error('[TRIVIA] addConcoinBooty error:', e.message);
    }
  }

  dbFire(
    supabase.from('trivia_logs').insert({
      session_id:    session.sessionId,
      guild_id:      session.guildId,
      user_id:       interaction.user.id,
      username:      interaction.user.username,
      submitted,
      is_correct:    true,
      coins_awarded: session.reward,
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

  const pending = (bootyData?.pending_grant ?? session.reward).toLocaleString();
  const totalEarned = (bootyData?.total_earned ?? session.reward).toLocaleString();
  const wins = bootyData?.trivia_wins ?? 1;

  await interaction.editReply({
    content: ubSuccess
      ? `✅ **Correct. The vault is yours.**\n\`+${session.reward.toLocaleString()} ConCoins\` added to your Booty Collection.\n> 💰 Pending payout: **${pending}** · Total earned: **${totalEarned}** · Wins: **${wins}**\n-# Use \`/concoin-booty\` to check · Use \`/deposit-concoins\` to send to your wallet`
      : `✅ **Correct. The vault is yours.**\n\`+${session.reward.toLocaleString()} ConCoins\` banked in your Booty Collection.\n> 💰 Pending payout: **${pending}** · Total earned: **${totalEarned}** · Wins: **${wins}**\n-# Use \`/concoin-booty\` to check · Use \`/deposit-concoins\` to send to your wallet`,
  });

  const ch = interaction.client.channels.cache.get(channelId);
  if (ch) {
    Promise.resolve(
      ch.send({ embeds: [revealEmbed(session.question, session.answer, interaction.user, 'won', session.reward)] })
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
    return {
      question: raw.q,
      answer:   raw.a,
      hint:     raw.hint || '',
      reward:   15000,
    };
  }
  // absolute last-resort fallback — should never hit if bot.js wires correctly
  return { question: 'Which map on TheConclave is PvP?', answer: 'aberration', hint: 'Underground biomes.', reward: 15000 };
}

// ═════════════════════════════════════════════════════════════════════
// isCorrectAnswer — full fuzzy matching engine
//
// Layers (in order, first match wins):
//   1. Exact normalized match
//   2. Synonym expansion  (e.g. "center" == "the center")
//   3. Per-token Levenshtein distance  (spelling tolerance scales with word length)
//   4. Token coverage ratio (≥ 75 % of key tokens matched fuzzily)
//   5. Substring containment fallback
// ═════════════════════════════════════════════════════════════════════
function isCorrectAnswer(submitted, canonical) {

  // ── 0. Normalize ──────────────────────────────────────────────────
  const normalize = s => s
    .toLowerCase()
    .replace(/[*•\-_`]/g, ' ')
    .replace(/[\n\r]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const ns = normalize(submitted);
  const nc = normalize(canonical);

  // ── 1. Exact match ────────────────────────────────────────────────
  if (ns === nc) return true;

  // ── 2. Synonym / alias map ────────────────────────────────────────
  // Map of canonical forms → all accepted aliases.
  // Keys are already-normalized. Add more as ARK lore demands.
  const SYNONYMS = {
    'aberration':         ['ab', 'aber'],
    'the island':         ['island'],
    'scorched earth':     ['scorched', 'se'],
    'the center':         ['center', 'centre'],
    'ragnarok':           ['rag'],
    'extinction':         ['ext'],
    'genesis':            ['gen'],
    'genesis part 1':     ['genesis 1', 'gen 1', 'gen1'],
    'genesis part 2':     ['genesis 2', 'gen 2', 'gen2'],
    'lost island':        ['lost isle'],
    'fjordur':            ['fjord'],
    'crystal isles':      ['crystal isle', 'ci'],
    'valguero':           ['val'],
    'ark survival evolved': ['ark', 'ase'],
    'ark survival ascended': ['asa'],
    'argentavis':         ['argy', 'argent', 'arg'],
    'pteranodon':         ['ptera', 'pt', 'ptero'],
    'rex':                ['t rex', 't-rex', 'tyrannosaurus', 'tyrannosaurus rex'],
    'megalosaurus':       ['mega'],
    'ankylosaurus':       ['anky'],
    'doedicurus':         ['doed'],
    'castoroides':        ['beaver'],
    'quetzalcoatlus':     ['quetz', 'quetzal'],
    'giganotosaurus':     ['giga'],
    'wyvern':             ['wyvs', 'wyv'],
    'rock elemental':     ['rock golem', 'golem'],
    'ovis':               ['sheep'],
    'iguanodon':          ['iguana', 'iggy'],
    'therizinosaurus':    ['theri', 'theriz'],
    'deinonychus':        ['deino'],
    'shadowmane':         ['shadowmanes', 'shadow'],
    'noglin':             ['noglins'],
    'managarmr':          ['mana', 'managarr'],
    'snow owl':           ['owl'],
    'gacha':              ['gacha crystal'],
    'velonasaur':         ['velo'],
    'reaper':             ['reaper king', 'reaper queen'],
    'carcharodontosaurus': ['carcha', 'carch'],
    'desmodus':           ['bat'],
    'fjordhawk':          ['hawk'],
    'andrewsarchus':      ['andrews'],
    'amargasaurus':       ['amarga'],
    'rhyniognatha':       ['rhynio'],
    'pyromane':           ['pyro'],
    'conclave':           ['the conclave'],
    'pvp':                ['player vs player', 'player versus player'],
    'pve':                ['player vs environment', 'player versus environment'],
    'true':               ['yes', 'yeah', 'yep', 'correct'],
    'false':              ['no', 'nope', 'wrong', 'incorrect'],
  };

  const expandSynonyms = s => {
    // Check if s is an alias for any canonical key; return canonical if so
    for (const [canon, aliases] of Object.entries(SYNONYMS)) {
      if (s === canon) return canon;
      if (aliases.includes(s)) return canon;
    }
    return s;
  };

  // Expand both sides
  const nsExpanded = expandSynonyms(ns);
  const ncExpanded = expandSynonyms(nc);
  if (nsExpanded === ncExpanded) return true;
  if (nsExpanded === nc || ncExpanded === ns) return true;

  // ── 3. Levenshtein distance helper ───────────────────────────────
  // Iterative, O(n*m) — safe for short words.
  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i-1] === b[j-1]
          ? dp[i-1][j-1]
          : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
      }
    }
    return dp[m][n];
  }

  // Tolerance: 1 typo per 4 chars, capped at 3, 0 for ≤3-char words
  const typoTolerance = len => {
    if (len <= 3) return 0;
    if (len <= 6) return 1;
    if (len <= 9) return 2;
    return 3;
  };

  function fuzzyTokenMatch(a, b) {
    if (a === b) return true;
    const tol = Math.min(typoTolerance(a.length), typoTolerance(b.length));
    return tol > 0 && levenshtein(a, b) <= tol;
  }

  // ── 4. Token-level fuzzy coverage ────────────────────────────────
  const STOP = new Set([
    'the','a','an','and','or','of','to','with','by','for','in','on',
    'at','is','it','its','that','this','be','are','was','you','your',
    'does','do','what','which','how','when','where','who','from','as',
  ]);

  // Strip trailing -s/-es (primitive stem), skip stop words, min 3 chars
  const stem = t => t.replace(/ies$/, 'y').replace(/(?<=[a-z]{3})es$/, '').replace(/(?<=[a-z]{3})s$/, '');

  const keyTokens = s => [...new Set(
    s.split(' ')
      .filter(t => t.length >= 2 && !STOP.has(t))
      .map(stem)
  )];

  const canonTokens = keyTokens(ncExpanded);
  const subTokens   = keyTokens(nsExpanded);

  if (canonTokens.length === 0) {
    return ns.includes(nc) || nc.includes(ns);
  }

  // Count how many canonical tokens are fuzzily matched by any submitted token
  const matched = canonTokens.filter(ct =>
    subTokens.some(st => fuzzyTokenMatch(ct, st))
  ).length;

  const ratio = matched / canonTokens.length;

  // Single/double-keyword answers: require full match
  if (canonTokens.length <= 2) return ratio === 1.0;

  // Multi-keyword: 75 % coverage passes
  if (ratio >= 0.75) return true;

  // ── 5. Substring containment fallback ────────────────────────────
  return nsExpanded.includes(ncExpanded) || ncExpanded.includes(nsExpanded);
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

// ═════════════════════════════════════════════════════════════════════
// EMBED BUILDERS — cinematic dark design
// ═════════════════════════════════════════════════════════════════════

function rewardColor(reward) {
  if (reward >= 25000) return 0xE040FB; // prismatic violet — elite
  if (reward >= 18000) return 0xFF6B00; // ember amber      — hard
  if (reward >= 12000) return 0x00C8FF; // arc cyan         — medium
  return                       0x9DAFBD; // slate silver     — standard
}

function rewardTier(reward) {
  if (reward >= 25000) return '👑  ELITE';
  if (reward >= 18000) return '🔥  HARD';
  if (reward >= 12000) return '⚡  MEDIUM';
  return                       '📜  STANDARD';
}

function buildTriviaEmbed(question, reward, expiresMs) {
  const expiryUnix = Math.floor((Date.now() + expiresMs) / 1000);

  return new EmbedBuilder()
    .setColor(rewardColor(reward))
    .setAuthor({ name: 'AEGIS  ·  DOMINION TRIVIA' })
    .setTitle('❓  A Question Emerges from the Void')
    .setDescription(
      ['```', question, '```', '> *First correct answer claims the vault.*'].join('\n')
    )
    .addFields(
      { name: '💰  Reward',     value: `\`${reward.toLocaleString()}\` **ConCoins**`, inline: true },
      { name: '🏷️  Difficulty', value: rewardTier(reward),                            inline: true },
      { name: '⏳  Closes',     value: `<t:${expiryUnix}:R>`,                         inline: true },
    )
    .setFooter({ text: 'Hit ⚔️ Answer · 🔍 Hint is ephemeral · ⏭ Skip is staff-only  ·  TheConclave Dominion' })
    .setTimestamp();
}

function buildTriviaButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('trivia_submit')
      .setLabel('Answer')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('⚔️'),
    new ButtonBuilder()
      .setCustomId('trivia_hint')
      .setLabel('Hint')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔍'),
    new ButtonBuilder()
      .setCustomId('trivia_skip')
      .setLabel('Skip  [Staff]')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('⏭'),
  );
}

function revealEmbed(question, answer, winner, status, reward = 0) {
  const cfg = {
    won: {
      color:       0x00E676,
      banner:      '✅  Vault Claimed',
      description: winner
        ? `<@${winner.id}> **struck first and seized the reward.**\n\`+${reward.toLocaleString()} ConCoins\` deposited to their Booty Collection.`
        : '✅ Correct answer submitted.',
    },
    expired: {
      color:       0x37474F,
      banner:      '⌛  Consumed by the Void',
      description: 'No survivor answered in time. The knowledge returns to the dark.',
    },
    skipped: {
      color:       0x546E7A,
      banner:      '⏭  Question Dissolved',
      description: 'A council member skipped this question.',
    },
  };

  const { color, banner, description } = cfg[status] ?? cfg.expired;

  return new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: 'AEGIS  ·  DOMINION TRIVIA  ·  CLOSED' })
    .setTitle(banner)
    .setDescription(description)
    .addFields(
      { name: '📋  Question', value: `\`\`\`${question}\`\`\``, inline: false },
      { name: '✅  Answer',   value: `> **${answer}**`,          inline: false },
    )
    .setFooter({ text: 'AEGIS Trivia  ·  TheConclave Dominion' })
    .setTimestamp();
}

function errorEmbed(msg) {
  return new EmbedBuilder()
    .setColor(0xB71C1C)
    .setAuthor({ name: 'AEGIS  ·  ERROR' })
    .setDescription(`\`\`\`diff\n- ${msg}\n\`\`\``);
}

return { handleTriviaCommand, handleTriviaButton, handleTriviaModalSubmit };

}; // end triviaFactory
