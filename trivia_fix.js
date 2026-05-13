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

  // ── 0. Normalize ─────────────────────────────────────────────────
  const normalize = s => s
    .toLowerCase()
    .replace(/[$%*•\-_`'"()]/g, ' ')
    .replace(/[\n\r]/g, ' ')
    .replace(/[^a-z0-9\s×]/g, ' ')
    .replace(/\bx\b/g, '×')
    .replace(/\s+/g, ' ')
    .trim();

  const ns = normalize(submitted);
  const nc = normalize(canonical);

  // ── 1. Exact match ────────────────────────────────────────────────
  if (ns === nc) return true;

  // ── 2. Submission contains full canonical ─────────────────────────
  if (ns.includes(nc) && nc.length > 4) return true;

  // ── 3. Numeric / rate — strict ────────────────────────────────────
  if (/^[\d×]+$/.test(nc.replace(/\s/g,''))) {
    return ns === nc || ns.startsWith(nc + ' ') || ns.endsWith(' ' + nc);
  }

  // ── 4. Synonym map ────────────────────────────────────────────────
  const SYN = {
    'aberration':['ab','aber','aberations','abarration','aberrtion'],
    'the island':['island','the isl'],
    'scorched earth':['scorched','se','scortched earth'],
    'the center':['center','centre'],
    'extinction':['ext','extintion'],
    'valguero':['val','valgero'],
    'crystal isles':['crystal isle','ci'],
    'ragnarok':['rag'],
    'fjordur':['fjord'],
    'genesis part 1':['genesis 1','gen 1','gen1'],
    'genesis part 2':['genesis 2','gen 2','gen2'],
    'lost colony':['lost col','lostcolony'],
    'astraeos':['astreos','astraos'],
    'amissa':['amisa'],
    'volcano':['volc','the volcano'],
    'argentavis':['argy','argent','arg','argie'],
    'pteranodon':['ptera','ptero'],
    'rex':['t rex','t-rex','tyrannosaurus','trex'],
    'megalosaurus':['mega','megalo','megalasaurus'],
    'ankylosaurus':['anky','ankylo'],
    'doedicurus':['doed'],
    'castoroides':['beaver'],
    'quetzalcoatlus':['quetz','quetzal'],
    'giganotosaurus':['giga','gigant'],
    'wyvern':['wyv','wyvs','wivern','wyvren'],
    'rock elemental':['rock golem','golem','rock elem'],
    'ovis':['sheep'],
    'therizinosaurus':['theri','theriz','therizino'],
    'deinonychus':['deino'],
    'shadowmane':['shadow','shadowmanes'],
    'noglin':['noglins'],
    'managarmr':['mana','managarr'],
    'snow owl':['owl'],
    'velonasaur':['velo'],
    'gigantoraptor':['giganto raptor','gigantaraptor'],
    'carcharodontosaurus':['carcha','carch','carchar'],
    'desmodus':['bat'],
    'fjordhawk':['hawk'],
    'andrewsarchus':['andrews'],
    'amargasaurus':['amarga'],
    'rhyniognatha':['rhynio'],
    'pyromane':['pyro'],
    'reaper king':['reaper','reaperking'],
    'karkinos':['crab','giant crab'],
    'basilisk':['basalisk'],
    'gacha':['gacha crystal'],
    'megatherium':['megatheri'],
    'yutyrannus':['yuty','yut'],
    'achatina':['snail'],
    'procoptodon':['kangaroo','roo'],
    'thylacoleo':['thyla'],
    'voidwyrm':['void wyrm','tek wyvern','void wyvern'],
    'broodmother lysrix':['broodmother','brood mother','lysrix'],
    'megapithecus':['mega pithecus','megapithicus','gorilla boss','ape boss'],
    'manticore':['manticor','mantacore'],
    'king titan':['kingtitan','king titian'],
    'overseer':['the overseer'],
    'tw_':['tw','twunderscore'],
    'slothie':['slothy','sloth'],
    'sandy':['sandie'],
    'aegis':['ageis','aegies','agis'],
    'helena walker':['helena','walker'],
    'hlna':['hln-a','heln a'],
    'rockwell':['sir rockwell','edmund rockwell'],
    'no':['nope','nah','disabled','false'],
    'yes':['yeah','yep','enabled','true'],
    '5×':['5x','five times','5times','fivex'],
    '10':['ten'],
    '3':['three'],
    '8':['eight'],
    '20':['twenty'],
    '100':['one hundred'],
    'wyvern milk':['wyv milk','wyrven milk','wyvren milk'],
    'nameless venom':['venom','nameless poison'],
    'element':['elements','tek element'],
    'black pearls':['black pearl','bp'],
    'organic polymer':['org poly','organic poly'],
    'cementing paste':['cement paste','cementing'],
    'reaper pheromone gland':['pheromone gland','reaper gland','pheromone'],
    'passive taming with a fish basket':['fish basket','passive fish basket','fish basket taming'],
    'cryo sickness':['cryosickness','cryo sick'],
    'death inventory keeper':['death keeper','inventory keeper','dik'],
    'awesome spyglass':['spyglass','the spyglass'],
    'arkomatic':['ark-o-matic','arkmatic'],
    'unreal engine 5':['ue5','unreal 5'],
    'lumen':['lumen system'],
    'nanite':['nanites'],
    'xbox playstation and pc':['xbox ps pc','xbox playstation pc','all platforms','all three platforms'],
    'theconclavedominion.com slash shop':['theconclavedominion.com/shop','conclave shop','the website'],
    'cashapp':['cash app','cash'],
    'pvp':['player vs player','player versus player'],
    'pve':['player vs environment','player versus environment'],
    'homo deus':['homo deous','homodeus'],
    'bioluminescent zone':['bio zone','bioluminescent','glow zone'],
    'grave of the lost':['the grave','grave lost'],
    '100 percent':['100%','full imprint','100 imprint'],
    '55 percent':['55%'],
    '2.5 percent':['2.5%','2.5'],
    '7.31 percent':['7.31%','7.31'],
    '20 dollars':['$20','twenty dollars','20 a month'],
    'concoins':['concoin','con coins'],
  };

  const expandPhrase = s => {
    for (const [canon, aliases] of Object.entries(SYN)) {
      if (s === canon || aliases.includes(s)) return canon;
    }
    return s;
  };

  const nsX = expandPhrase(ns);
  const ncX = expandPhrase(nc);
  if (nsX === ncX) return true;
  if (nsX === nc || ncX === ns) return true;
  if (nsX.includes(ncX) && ncX.length > 4) return true;

  // ── 5. Levenshtein ────────────────────────────────────────────────
  function lev(a, b) {
    const m=a.length,n=b.length;
    if(!m)return n; if(!n)return m;
    const dp=Array.from({length:m+1},(_,i)=>[i,...Array(n).fill(0)]);
    for(let j=0;j<=n;j++)dp[0][j]=j;
    for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)
      dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
    return dp[m][n];
  }

  const tol = len => len<=3?0:len<=6?1:len<=9?2:3;

  function fuzzy(a,b){
    if(a===b)return true;
    if(b.startsWith(a)&&a.length>=4)return true;
    if(a.startsWith(b)&&b.length>=4)return true;
    const t=Math.min(tol(a.length),tol(b.length));
    return t>0&&lev(a,b)<=t;
  }

  // ── 6. Token coverage ─────────────────────────────────────────────
  const STOP=new Set(['the','a','an','and','or','of','to','with','by','for','in','on','at','is','it','its','that','this','be','are','was','you','your','does','do','what','which','how','when','where','who','from','as','also','any','all','only','just','not','but','they','their','have','had','has','can','will','via','per','both','each']);
  const stem=t=>t.replace(/ies$/,'y').replace(/(?<=[a-z]{3})es$/,'').replace(/(?<=[a-z]{3})s$/,'');
  const tok=s=>[...new Set(s.split(' ').filter(t=>t.length>=2&&!STOP.has(t)).map(stem))];

  const cTok=tok(ncX.length>nc.length?ncX:nc);
  const sTok=[...new Set([...tok(nsX),...tok(ns)])];

  if(!cTok.length) return ns.includes(nc)||nc.includes(ns);

  const matched=cTok.filter(ct=>sTok.some(st=>fuzzy(ct,st))).length;
  const ratio=matched/cTok.length;

  if(cTok.length<=2) return ratio===1.0;
  if(ratio>=0.70)    return true;

  // ── 7. Substring fallback ─────────────────────────────────────────
  return nsX.includes(ncX)||ncX.includes(nsX);
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
