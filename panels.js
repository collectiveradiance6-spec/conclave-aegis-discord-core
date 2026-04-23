// ═══════════════════════════════════════════════════════════════════════
// AEGIS PANELS — v3.0 COSMIC SOVEREIGN EDITION
// Full cinematic visual design system for Discord embeds
// Animated GIF banners · Unicode HUD art · Depth layering · Scan FX
// ═══════════════════════════════════════════════════════════════════════
'use strict';

const { EmbedBuilder } = require('discord.js');

// ── BRAND ASSETS (hosted on theconclavedominion.com) ─────────────────
const ASSETS = {
  BADGE:       'https://theconclavedominion.com/conclave-badge.png',
  CIRCLE_GIF:  'https://theconclavedominion.com/conclave-circle.gif',
  LIGHTNING:   'https://theconclavedominion.com/lightning.gif',
  LOOT_BLUE:   'https://theconclavedominion.com/BLUELOOTDROP.gif',
  LOOT_PURPLE: 'https://theconclavedominion.com/PURPLELOOTDROP.gif',
  LOOT_WHITE:  'https://theconclavedominion.com/WHITELOOTDROP.gif',
  LOOT_YELLOW: 'https://theconclavedominion.com/YELLOWLLOTDROP.gif',
  ARK_GET:     'https://theconclavedominion.com/GET_ARK_D.gif',
};

// ── COLOUR PALETTE ────────────────────────────────────────────────────
const HEX = {
  void:    0x02010D,   // near-black deep space
  plasma:  0x7B2FFF,   // sovereign purple
  cyan:    0x00D4FF,   // AEGIS blue
  gold:    0xFFB800,   // ClaveShard gold
  emerald: 0x35ED7E,   // online green
  scarlet: 0xFF4500,   // alert red
  magenta: 0xFF4CD2,   // shop pink
  ice:     0xA8D8FF,   // pale blue
  amber:   0xFF8C00,   // warm amber
};

// ── UNICODE PRIMITIVES ────────────────────────────────────────────────
const U = {
  // borders
  TL: '╔', TR: '╗', BL: '╚', BR: '╝', H: '═', V: '║',
  ML: '╠', MR: '╣',
  tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│',
  ml: '├', mr: '┤',

  // blocks & shading
  FULL:  '█', DARK: '▓', MED:  '▒', LIGHT: '░',
  H8: '▉', H7: '▊', H6: '▋', H5: '▌', H4: '▍', H3: '▎', H2: '▏',

  // decorative
  DIAMOND:   '◈',
  DIAMOND2:  '◆',
  DOT:       '●',
  RING:      '○',
  ARROW_R:   '▶',
  ARROW_L:   '◀',
  STAR:      '✦',
  CROSS:     '✕',
  CHECK:     '✔',
  WAVE:      '〰',
  CIRCUIT:   '⌁',
  SCAN:      '⠿',

  // scanline rows (creates depth illusion)
  SCAN_FULL:   '⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿',
  SCAN_LIGHT:  '⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒⠒',
  LINE_HEAVY:  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  LINE_DOUBLE: '══════════════════════════════',
  LINE_DOTS:   '· · · · · · · · · · · · · · ·',
  LINE_WAVE:   '〰〰〰〰〰〰〰〰〰〰〰〰〰〰〰',
};

// ── PROGRESS BAR GENERATOR ────────────────────────────────────────────
// Returns a pixel-perfect block bar with percentage + label
function bar(current, max, length = 16, label = '') {
  const pct    = max > 0 ? Math.min(current / max, 1) : 0;
  const filled = Math.round(pct * length);
  const empty  = length - filled;
  const blocks = U.FULL.repeat(filled) + U.LIGHT.repeat(empty);
  const pctStr = Math.round(pct * 100).toString().padStart(3, ' ') + '%';
  return label
    ? `\`${blocks}\` **${pctStr}**  *${label}*`
    : `\`${blocks}\` **${pctStr}**`;
}

// ── STAT LINE ─────────────────────────────────────────────────────────
// Single-line stat with icon, label, value
function stat(icon, label, value) {
  return `${icon} \`${label.padEnd(14)}\` **${value}**`;
}

// ── HEADER BOX ────────────────────────────────────────────────────────
// Creates a double-border ASCII header box
function headerBox(title, subtitle = '') {
  const width = Math.max(title.length, subtitle.length) + 6;
  const top   = U.TL + U.H.repeat(width) + U.TR;
  const mid   = U.V + '  ' + title.padEnd(width - 2) + '  ' + U.V;
  const sub   = subtitle ? U.V + '  ' + subtitle.padEnd(width - 2) + '  ' + U.V + '\n' : '';
  const bot   = U.BL + U.H.repeat(width) + U.BR;
  return `\`\`\`\n${top}\n${mid}\n${sub}${bot}\n\`\`\``;
}

// ── PANEL ROW ─────────────────────────────────────────────────────────
// Creates a box row with label + value
function panelRow(label, value, width = 32) {
  const inner = ` ${label}: ${value}`;
  return U.V + inner.padEnd(width) + U.V;
}

// ── SIGNAL METER ──────────────────────────────────────────────────────
// Online/offline dot indicator bars
function signal(online, total, label = '') {
  const dots = Array.from({ length: total }, (_, i) =>
    i < online ? U.FULL : U.LIGHT
  ).join('');
  return `\`${dots}\` ${label || `${online}/${total}`}`;
}

// ── CREDIT STACK DISPLAY ──────────────────────────────────────────────
// Visual shard pile for wallet amounts
function shardDisplay(amount) {
  const tiers = [
    [30, '👑'],[ 15, '🌠'],[ 10, '🛡️'],[ 8, '🌌'],
    [ 6, '⚔️'],[ 5, '🔥'],[ 3, '✨'],[ 2, '💎'],[ 1, '💠'],
  ];
  let remaining = amount;
  const parts   = [];
  for (const [val, emoji] of tiers) {
    const count = Math.floor(remaining / val);
    if (count > 0) { parts.push(`${emoji}×${count}`); remaining -= count * val; }
  }
  return parts.length ? parts.join(' ') : '—';
}

// ══════════════════════════════════════════════════════════════════════
// PANEL BUILDERS
// Each returns a fully configured EmbedBuilder
// ══════════════════════════════════════════════════════════════════════

// ── FOOTER FACTORY ────────────────────────────────────────────────────
function footer(tag = 'TheConclave Dominion') {
  return { text: `${U.STAR} ${tag} ${U.STAR}`, iconURL: ASSETS.BADGE };
}

// ── BASE THEMED EMBED ─────────────────────────────────────────────────
function themed(color, authorName, authorIcon = ASSETS.BADGE) {
  return new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: authorName, iconURL: authorIcon })
    .setFooter(footer())
    .setTimestamp();
}

// ─────────────────────────────────────────────────────────────────────
// 🧠 AEGIS AI RESPONSE PANEL
// Deep-space holographic blue. Animated circle GIF thumbnail.
// ─────────────────────────────────────────────────────────────────────
function AegisPanel(responseText, model = 'NEURAL·CORE') {
  const scanHeader = [
    `\`${U.SCAN_FULL}\``,
    `> ${U.DIAMOND} **A E G I S**  ·  *Sovereign Intelligence Online*`,
    `\`${U.SCAN_LIGHT}\``,
    '',
    responseText.slice(0, 3200),
    '',
    `\`${U.LINE_DOTS}\``,
    `-# ⌁ ${model} · GROQ FREE TIER · LLAMA 3`,
  ].join('\n');

  return new EmbedBuilder()
    .setColor(HEX.cyan)
    .setAuthor({ name: '⚡ AEGIS  ·  Neural Response Active', iconURL: ASSETS.CIRCLE_GIF })
    .setThumbnail(ASSETS.LIGHTNING)
    .setDescription(scanHeader)
    .setFooter(footer('AEGIS Sovereign Intelligence'))
    .setTimestamp();
}

// ─────────────────────────────────────────────────────────────────────
// 💎 WALLET PANEL
// Crystal gold. Animated loot-drop GIF. Full stat HUD.
// ─────────────────────────────────────────────────────────────────────
function WalletPanel(title, w, color = HEX.gold) {
  const wallet  = w.wallet_balance  || 0;
  const bank    = w.bank_balance    || 0;
  const earned  = w.lifetime_earned || 0;
  const spent   = w.lifetime_spent  || 0;
  const streak  = w.daily_streak    || 0;
  const total   = wallet + bank;
  const maxVis  = Math.max(total, 100);

  const desc = [
    `\`${U.LINE_HEAVY}\``,
    `> ${U.DIAMOND} **${w.discord_tag || w.discord_id}**`,
    `\`${U.LINE_HEAVY}\``,
    '',
    stat('💎', 'WALLET',  wallet.toLocaleString() + ' shards'),
    stat('🏦', 'VAULT',   bank.toLocaleString()   + ' shards'),
    stat('📊', 'TOTAL',   total.toLocaleString()  + ' shards'),
    '',
    bar(wallet, maxVis, 20, 'wallet'),
    bar(bank,   maxVis, 20, 'vault'),
    '',
    `\`${U.LINE_DOTS}\``,
    stat('📈', 'ALL-TIME EARNED', earned.toLocaleString()),
    stat('📉', 'ALL-TIME SPENT',  spent.toLocaleString()),
    stat('🔥', 'STREAK',          `Week ${streak}`),
    '',
    `> ${U.STAR} *${shardDisplay(wallet)}*`,
  ].join('\n');

  return new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: '💎 ClaveShard Wallet', iconURL: ASSETS.LOOT_YELLOW })
    .setThumbnail(ASSETS.LOOT_YELLOW)
    .setTitle(title)
    .setDescription(desc)
    .setFooter(footer('ClaveShard Economy · $1 = 1 Shard'))
    .setTimestamp();
}

// ─────────────────────────────────────────────────────────────────────
// 🏆 LEADERBOARD PANEL
// Purple sovereign. Animated loot GIF. Ranked entries.
// ─────────────────────────────────────────────────────────────────────
function LeaderboardPanel(rows, title = '🏆 ClaveShard Leaderboard') {
  const medals  = ['👑', '🥇', '🥈', '🥉', '💠', '💠', '💠', '💠', '💠', '💠'];
  const maxBal  = rows[0] ? ((rows[0].wallet_balance || 0) + (rows[0].bank_balance || 0)) : 1;

  const lines = rows.map((r, i) => {
    const total = (r.wallet_balance || 0) + (r.bank_balance || 0);
    const pct   = Math.round((total / maxBal) * 100);
    const bLen  = Math.round((total / maxBal) * 14);
    const bBar  = `\`${U.FULL.repeat(bLen)}${U.LIGHT.repeat(14 - bLen)}\``;
    return `${medals[i] || `**${i + 1}.**`} **${r.discord_tag || r.discord_id}**\n${bBar} **${total.toLocaleString()}** 💎`;
  }).join('\n\n');

  const desc = [
    `\`${U.SCAN_FULL}\``,
    `> ${U.DIAMOND} *Top ClaveShard holders across the Dominion*`,
    `\`${U.SCAN_LIGHT}\``,
    '',
    lines || '_No entries yet._',
    '',
    `\`${U.LINE_HEAVY}\``,
    `-# Donate to earn shards · $1 = 1 ClaveShard`,
  ].join('\n');

  return new EmbedBuilder()
    .setColor(HEX.plasma)
    .setAuthor({ name: title, iconURL: ASSETS.LOOT_PURPLE })
    .setThumbnail(ASSETS.LOOT_PURPLE)
    .setDescription(desc)
    .setFooter(footer('ClaveShard Economy'))
    .setTimestamp();
}

// ─────────────────────────────────────────────────────────────────────
// 🛍️ SHOP / SHARD TIER PANEL
// Magenta merchant. Animated blue loot drop.
// ─────────────────────────────────────────────────────────────────────
function ShopPanel(tier) {
  const desc = [
    `\`${U.LINE_HEAVY}\``,
    `> ${tier.emoji} **${tier.name.toUpperCase()}**  ·  \`${tier.shards > 0 ? tier.shards + ' SHARDS' : 'INSURANCE'}\``,
    `\`${U.LINE_HEAVY}\``,
    '',
    tier.items.map(i => `${U.ARROW_R} ${i}`).join('\n'),
    '',
    `\`${U.LINE_DOTS}\``,
    `> 💳 **CashApp** \`$TheConclaveDominion\`  ·  **Chime** \`$TheConclaveDominion\``,
    `> 💎 **$1 donation = 1 ClaveShard**`,
  ].join('\n');

  return new EmbedBuilder()
    .setColor(HEX.magenta)
    .setAuthor({ name: '🛍️ ClaveShard Shop  ·  theconclavedominion.com/shop', iconURL: ASSETS.LOOT_BLUE })
    .setThumbnail(ASSETS.LOOT_BLUE)
    .setTitle(`${tier.emoji} ${tier.name}`)
    .setDescription(desc)
    .setFooter(footer('ClaveShard Shop'))
    .setTimestamp();
}

// ─────────────────────────────────────────────────────────────────────
// 📦 ORDER SUBMITTED PANEL
// Gold loot drop. Includes QR-code style ref.
// ─────────────────────────────────────────────────────────────────────
function OrderPanel(ref, tier, platform, serverName, notes, items) {
  const desc = [
    `\`${U.SCAN_FULL}\``,
    `> ${U.DIAMOND} **ORDER RECEIVED** — *Council will fulfill within 24–72h*`,
    `\`${U.SCAN_FULL}\``,
    '',
    stat('📋', 'REF',      `\`${ref}\``),
    stat('💎', 'TIER',     tier.name),
    stat('🪙', 'COST',     `${tier.shards} Shard${tier.shards !== 1 ? 's' : ''}`),
    stat('🎮', 'PLATFORM', platform),
    stat('🗺️', 'SERVER',   serverName),
    stat('📝', 'NOTES',    notes.slice(0, 80) || '—'),
    '',
    `\`${U.LINE_DOTS}\``,
    `**📦 Includes:**`,
    items.slice(0, 8).map(i => `${U.ARROW_R} ${i}`).join('\n'),
    '',
    `\`${U.LINE_HEAVY}\``,
    `> 💳 **CashApp** \`$TheConclaveDominion\``,
    `> 💳 **Chime** \`$TheConclaveDominion\``,
    `> *Include your Discord username in the payment note*`,
  ].join('\n');

  return new EmbedBuilder()
    .setColor(HEX.gold)
    .setAuthor({ name: '📦 ClaveShard Order Submitted', iconURL: ASSETS.LOOT_YELLOW })
    .setThumbnail(ASSETS.LOOT_YELLOW)
    .setDescription(desc)
    .setFooter(footer('Orders fulfilled within 24–72 hours'))
    .setTimestamp();
}

// ─────────────────────────────────────────────────────────────────────
// 🗺️ SERVER MONITOR PANEL
// Animated lightning GIF. Green online / red offline grid.
// ─────────────────────────────────────────────────────────────────────
function ServerMonitorPanel(servers) {
  const online  = servers.filter(s => s.status === 'online');
  const offline = servers.filter(s => s.status !== 'online');
  const players = online.reduce((sum, s) => sum + (s.players || 0), 0);

  const onlineLines  = online.map(s =>
    `🟢 ${s.emoji} **${s.name}**${s.pvp ? ' ⚔️' : s.patreon ? ' ⭐' : ''} ${signal(s.players || 0, s.maxPlayers || 20, `\`${(s.players || 0)}/${s.maxPlayers || 20}\``)}`
  ).join('\n');

  const offlineLines = offline.map(s =>
    `🔴 ${s.emoji} ~~${s.name}~~ · *offline*`
  ).join('\n');

  const desc = [
    `\`${U.SCAN_FULL}\``,
    `> ⚡ **LIVE CLUSTER STATUS** · ${online.length}/${servers.length} maps online · **${players}** active survivors`,
    `\`${U.SCAN_LIGHT}\``,
    '',
    onlineLines  || '',
    offlineLines ? '\n' + offlineLines : '',
    '',
    `\`${U.LINE_HEAVY}\``,
    bar(online.length, servers.length, 20, 'cluster health'),
    bar(players, servers.length * 20, 20, 'total capacity'),
    `\`${U.LINE_DOTS}\``,
    `-# ⌁ Auto-refreshes every 5 min · /crossplay to connect`,
  ].join('\n');

  return new EmbedBuilder()
    .setColor(players > 0 ? HEX.emerald : HEX.scarlet)
    .setAuthor({ name: '⚔️ TheConclave — Live Cluster Monitor', iconURL: ASSETS.CIRCLE_GIF })
    .setThumbnail(ASSETS.LIGHTNING)
    .setDescription(desc)
    .setFooter(footer('TheConclave Dominion · 5× Crossplay · 10 Maps'))
    .setTimestamp();
}

// ─────────────────────────────────────────────────────────────────────
// 🎖️ PROFILE PANEL
// Cosmic purple. Animated loot. Full stat dashboard.
// ─────────────────────────────────────────────────────────────────────
function ProfilePanel(user, member, wallet) {
  const joined  = member?.joinedAt  ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:D>` : 'Unknown';
  const created = `<t:${Math.floor(user.createdAt.getTime() / 1000)}:D>`;
  const wallet_b = wallet?.wallet_balance || 0;
  const bank_b   = wallet?.bank_balance   || 0;
  const total    = wallet_b + bank_b;

  const desc = [
    `\`${U.SCAN_FULL}\``,
    `> ${U.DIAMOND} **${user.username.toUpperCase()}**  ·  *Dominion Citizen*`,
    `\`${U.SCAN_LIGHT}\``,
    '',
    stat('🎭', 'JOINED SERVER', joined),
    stat('📅', 'DISCORD SINCE', created),
    '',
    `\`${U.LINE_DOTS}\``,
    stat('💎', 'WALLET',        wallet_b.toLocaleString() + ' shards'),
    stat('🏦', 'VAULT',         bank_b.toLocaleString()   + ' shards'),
    stat('📊', 'TOTAL',         total.toLocaleString()    + ' shards'),
    stat('🔥', 'STREAK',        `Week ${wallet?.daily_streak || 0}`),
    stat('📈', 'LIFETIME EARNED', (wallet?.lifetime_earned || 0).toLocaleString()),
    '',
    total > 0 ? bar(wallet_b, total, 20, 'wallet ratio') : '',
    total > 0 ? `> ${U.STAR} *${shardDisplay(wallet_b)}*` : '',
  ].join('\n');

  return new EmbedBuilder()
    .setColor(HEX.plasma)
    .setAuthor({ name: `🎖️ ${user.username}'s Dominion Profile`, iconURL: user.displayAvatarURL({ size: 64 }) })
    .setThumbnail(user.displayAvatarURL({ size: 128 }))
    .setDescription(desc)
    .setFooter(footer())
    .setTimestamp();
}

// ─────────────────────────────────────────────────────────────────────
// ⚠️ WARN / MOD PANEL
// Scarlet alert. Amber accent.
// ─────────────────────────────────────────────────────────────────────
function WarnPanel(target, reason, warnCount, issuedBy) {
  const urgency  = warnCount >= 3 ? '🔴 **BAN THRESHOLD REACHED**' : warnCount === 2 ? '🟠 *Final warning approaching*' : '🟡 *First formal warning*';
  const desc = [
    `\`${U.LINE_DOUBLE}\``,
    `> ⚠️  **FORMAL WARNING ISSUED**`,
    `\`${U.LINE_DOUBLE}\``,
    '',
    stat('👤', 'TARGET',    `<@${target.id}>`),
    stat('👮', 'ISSUED BY', `<@${issuedBy.id}>`),
    stat('🔢', 'TOTAL',     `${warnCount} warning${warnCount !== 1 ? 's' : ''}`),
    '',
    `\`${U.LINE_DOTS}\``,
    `📋 **Reason:**\n> ${reason}`,
    '',
    urgency,
    `\`${U.LINE_HEAVY}\``,
    `-# 3 warnings = ban · /rules to review the Codex`,
  ].join('\n');

  return new EmbedBuilder()
    .setColor(HEX.scarlet)
    .setAuthor({ name: '⚠️ Dominion Moderation', iconURL: ASSETS.BADGE })
    .setDescription(desc)
    .setFooter(footer('TheConclave Moderation'))
    .setTimestamp();
}

// ─────────────────────────────────────────────────────────────────────
// 🎉 GIVEAWAY PANEL
// Gold shimmer. Loot yellow GIF.
// ─────────────────────────────────────────────────────────────────────
function GiveawayPanel(prize, winners, endTime, hostedBy) {
  const desc = [
    `\`${U.SCAN_FULL}\``,
    `> ${U.STAR} **G I V E A W A Y** ${U.STAR}`,
    `\`${U.SCAN_FULL}\``,
    '',
    `## ${prize}`,
    '',
    stat('🏆', 'WINNERS',  `${winners}`),
    stat('⏰', 'ENDS',     `<t:${Math.floor(endTime / 1000)}:R>`),
    stat('📢', 'HOST',     hostedBy),
    '',
    `\`${U.LINE_DOTS}\``,
    `> ${U.ARROW_R} Click the button below to enter!`,
    `> ${U.ARROW_R} One entry per user`,
  ].join('\n');

  return new EmbedBuilder()
    .setColor(HEX.gold)
    .setAuthor({ name: '🎉 TheConclave Giveaway', iconURL: ASSETS.LOOT_YELLOW })
    .setThumbnail(ASSETS.LOOT_YELLOW)
    .setDescription(desc)
    .setFooter(footer(`Hosted by ${hostedBy}`))
    .setTimestamp();
}

// ─────────────────────────────────────────────────────────────────────
// 🎉 GIVEAWAY ENDED PANEL
// ─────────────────────────────────────────────────────────────────────
function GiveawayEndPanel(prize, winnerMentions, noWinners = false) {
  const desc = noWinners
    ? [
        `\`${U.LINE_DOUBLE}\``,
        `> ~~Giveaway Ended~~ · *No valid entries*`,
        `\`${U.LINE_DOUBLE}\``,
        `\n**Prize:** ${prize}`,
      ].join('\n')
    : [
        `\`${U.SCAN_FULL}\``,
        `> 🎊 **GIVEAWAY CONCLUDED** 🎊`,
        `\`${U.SCAN_FULL}\``,
        '',
        `## ${prize}`,
        '',
        `\`${U.LINE_DOTS}\``,
        `🏆 **Winner${winnerMentions.includes(' ') ? 's' : ''}:**`,
        `> ${winnerMentions}`,
        '',
        `\`${U.LINE_HEAVY}\``,
        `-# Congratulations from TheConclave Council`,
      ].join('\n');

  return new EmbedBuilder()
    .setColor(noWinners ? HEX.scarlet : HEX.gold)
    .setAuthor({ name: '🎉 Giveaway Results', iconURL: ASSETS.LOOT_YELLOW })
    .setDescription(desc)
    .setFooter(footer())
    .setTimestamp();
}

// ─────────────────────────────────────────────────────────────────────
// 📢 ANNOUNCEMENT PANEL
// Deep plasma purple. Animated circle GIF.
// ─────────────────────────────────────────────────────────────────────
function AnnouncementPanel(title, body, authorName) {
  const desc = [
    `\`${U.SCAN_FULL}\``,
    `> ${U.DIAMOND} **C O N C L A V E  A N N O U N C E M E N T**`,
    `\`${U.SCAN_FULL}\``,
    '',
    body,
    '',
    `\`${U.LINE_HEAVY}\``,
    `-# Announced by ${authorName} · TheConclave Council`,
  ].join('\n');

  return new EmbedBuilder()
    .setColor(HEX.plasma)
    .setAuthor({ name: `📢 ${title}`, iconURL: ASSETS.CIRCLE_GIF })
    .setThumbnail(ASSETS.BADGE)
    .setDescription(desc)
    .setFooter(footer('TheConclave Dominion'))
    .setTimestamp();
}

// ─────────────────────────────────────────────────────────────────────
// 📅 EVENT PANEL
// Magenta. Animated circle. Rich info layout.
// ─────────────────────────────────────────────────────────────────────
function EventPanel(title, description, date, hostedBy) {
  const desc = [
    `\`${U.SCAN_FULL}\``,
    `> ${U.STAR} **D O M I N I O N  E V E N T**`,
    `\`${U.SCAN_FULL}\``,
    '',
    `## ${title}`,
    '',
    description,
    '',
    `\`${U.LINE_DOTS}\``,
    stat('🕐', 'DATE & TIME', date),
    stat('📢', 'HOSTED BY',   hostedBy),
    '',
    `\`${U.LINE_HEAVY}\``,
    `> *React 🎉 to show interest!*`,
  ].join('\n');

  return new EmbedBuilder()
    .setColor(HEX.magenta)
    .setAuthor({ name: '📅 Event Announcement', iconURL: ASSETS.CIRCLE_GIF })
    .setThumbnail(ASSETS.BADGE)
    .setDescription(desc)
    .setFooter(footer('TheConclave Events'))
    .setTimestamp();
}

// ─────────────────────────────────────────────────────────────────────
// 🏓 PING / STATUS PANEL
// Animated lightning. Full system readout.
// ─────────────────────────────────────────────────────────────────────
function PingPanel(wsLatency, uptime, memMB, hasGroq, hasSupa, hasMusic) {
  const uptimeH = Math.floor(uptime / 3600);
  const uptimeM = Math.floor((uptime % 3600) / 60);

  const desc = [
    `\`${U.SCAN_FULL}\``,
    `> ${U.CIRCUIT} **SYSTEM STATUS READOUT**`,
    `\`${U.SCAN_LIGHT}\``,
    '',
    stat('📡', 'WS LATENCY',  `${wsLatency}ms`),
    stat('⏰', 'UPTIME',      `${uptimeH}h ${uptimeM}m`),
    stat('💾', 'MEMORY',      `${memMB}MB heap`),
    '',
    `\`${U.LINE_DOTS}\``,
    stat('🧠', 'AI ENGINE',   hasGroq  ? '✅ Groq Free · Llama 3' : '❌ Not configured'),
    stat('🗄️', 'DATABASE',    hasSupa  ? '✅ Supabase Online'     : '❌ Not connected'),
    stat('🎵', 'MUSIC',       hasMusic ? '✅ Runtime Loaded'      : '❌ Disabled'),
    '',
    `\`${U.LINE_HEAVY}\``,
    bar(Math.max(0, 100 - wsLatency / 3), 100, 20, 'connection quality'),
    `\`${U.LINE_DOTS}\``,
    `-# ⌁ AEGIS v10.1 Sovereign · Zero-cost AI`,
  ].join('\n');

  return new EmbedBuilder()
    .setColor(wsLatency < 100 ? HEX.emerald : wsLatency < 250 ? HEX.amber : HEX.scarlet)
    .setAuthor({ name: '🏓 AEGIS System Status', iconURL: ASSETS.CIRCLE_GIF })
    .setThumbnail(ASSETS.LIGHTNING)
    .setDescription(desc)
    .setFooter(footer('AEGIS v10.1 Sovereign'))
    .setTimestamp();
}

// ─────────────────────────────────────────────────────────────────────
// 🎫 TICKET PANEL
// Cyan tech. Clean layout.
// ─────────────────────────────────────────────────────────────────────
function TicketPanel() {
  const desc = [
    `\`${U.SCAN_FULL}\``,
    `> 🎫 **SUPPORT CENTER** · *TheConclave Dominion*`,
    `\`${U.SCAN_LIGHT}\``,
    '',
    `${U.ARROW_R} **General Support** — Server issues, questions, help`,
    `${U.ARROW_R} **ClaveShard Issues** — Orders, economy disputes`,
    `${U.ARROW_R} **Report a Player** — Rules violations, griefing`,
    '',
    `\`${U.LINE_DOTS}\``,
    `> Council responds within **24 hours**`,
    `> Your ticket is private — only staff can see it`,
    '',
    `\`${U.LINE_HEAVY}\``,
    `-# Click below to open a private support ticket`,
  ].join('\n');

  return new EmbedBuilder()
    .setColor(HEX.cyan)
    .setAuthor({ name: '🎫 TheConclave Support Center', iconURL: ASSETS.BADGE })
    .setDescription(desc)
    .setFooter(footer())
    .setTimestamp();
}

// ─────────────────────────────────────────────────────────────────────
// ℹ️ INFO PANEL
// Full server info. Animated GIF.
// ─────────────────────────────────────────────────────────────────────
function InfoPanel() {
  const desc = [
    `\`${U.SCAN_FULL}\``,
    `> ${U.DIAMOND} **T H E C O N C L A V E  D O M I N I O N**`,
    `> *5× Crossplay ARK: Survival Ascended · 10 Maps · All Platforms*`,
    `\`${U.SCAN_FULL}\``,
    '',
    '**🗺️ Cluster**',
    '> Island · Volcano · Extinction · Center · Lost Colony',
    '> Astraeos · Valguero · Scorched · Aberration ⚔️ · Amissa ⭐',
    '',
    `\`${U.LINE_DOTS}\``,
    '**📈 Rates**',
    `${U.ARROW_R} 5× XP · Harvest · Taming · Breeding`,
    `${U.ARROW_R} 1,000,000 Weight · No Fall Damage`,
    `${U.ARROW_R} Max Wild Level: 350`,
    '',
    `\`${U.LINE_DOTS}\``,
    '**💎 Economy**',
    `${U.ARROW_R} Use \`/order\` to shop the ClaveShard catalog`,
    `${U.ARROW_R} **$1 donation = 1 ClaveShard** via CashApp/Chime`,
    `${U.ARROW_R} CashApp & Chime: \`$TheConclaveDominion\``,
    '',
    `\`${U.LINE_HEAVY}\``,
    `> 🔗 **theconclavedominion.com** · **discord.gg/theconclave**`,
    `> ⭐ **patreon.com/theconclavedominion** — Amissa at Elite tier`,
  ].join('\n');

  return new EmbedBuilder()
    .setColor(HEX.cyan)
    .setAuthor({ name: '⚔️ TheConclave Dominion', iconURL: ASSETS.CIRCLE_GIF })
    .setThumbnail(ASSETS.BADGE)
    .setDescription(desc)
    .setFooter(footer('We didn\'t wait for the light. We became it.'))
    .setTimestamp();
}

// ─────────────────────────────────────────────────────────────────────
// ✅ SUCCESS / GENERIC PANEL
// ─────────────────────────────────────────────────────────────────────
function SuccessPanel(title, body, color = HEX.emerald) {
  return new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: `✅ ${title}`, iconURL: ASSETS.BADGE })
    .setDescription([
      `\`${U.LINE_HEAVY}\``,
      body,
      `\`${U.LINE_DOTS}\``,
    ].join('\n'))
    .setFooter(footer())
    .setTimestamp();
}

// ─────────────────────────────────────────────────────────────────────
// ❌ ERROR PANEL
// ─────────────────────────────────────────────────────────────────────
function ErrorPanel(title, body) {
  return new EmbedBuilder()
    .setColor(HEX.scarlet)
    .setAuthor({ name: `⚠️ ${title}`, iconURL: ASSETS.BADGE })
    .setDescription([
      `\`${U.LINE_DOUBLE}\``,
      `> ❌ ${body}`,
      `\`${U.LINE_DOUBLE}\``,
    ].join('\n'))
    .setFooter(footer('AEGIS Error Handler'))
    .setTimestamp();
}

// ─────────────────────────────────────────────────────────────────────
// 📊 AI COST / USAGE PANEL
// ─────────────────────────────────────────────────────────────────────
function AiUsagePanel(total, fast, smart, inp, out) {
  const desc = [
    `\`${U.SCAN_FULL}\``,
    `> ${U.CIRCUIT} **AEGIS AI USAGE REPORT**  ·  *Groq Free Tier*`,
    `\`${U.SCAN_LIGHT}\``,
    '',
    stat('🔢', 'TOTAL CALLS',    total.toLocaleString()),
    stat('⚡', 'FAST  (8B)',     `${fast.toLocaleString()} calls`),
    stat('🧠', 'SMART (70B)',    `${smart.toLocaleString()} calls`),
    '',
    `\`${U.LINE_DOTS}\``,
    stat('📥', 'INPUT TOKENS',   inp.toLocaleString()),
    stat('📤', 'OUTPUT TOKENS',  out.toLocaleString()),
    stat('💸', 'TOTAL COST',     '**$0.00** — Free Forever'),
    '',
    bar(fast, total, 20, 'fast calls'),
    bar(smart, total, 20, 'smart calls'),
    '',
    `\`${U.LINE_HEAVY}\``,
    stat('🔋', 'DAILY LIMIT',   '14,400 req/day'),
    stat('⏱️', 'HOURLY LIMIT',  '6,000 req/hour'),
    stat('🤖', 'MODELS',        'Llama 3.1 8B + 3.3 70B'),
  ].join('\n');

  return new EmbedBuilder()
    .setColor(HEX.cyan)
    .setAuthor({ name: '💸 AEGIS AI Dashboard', iconURL: ASSETS.LIGHTNING })
    .setThumbnail(ASSETS.LIGHTNING)
    .setDescription(desc)
    .setFooter(footer('Powered by Groq · Zero Cost'))
    .setTimestamp();
}

// ─────────────────────────────────────────────────────────────────────
// 📜 RULES PANEL
// ─────────────────────────────────────────────────────────────────────
function RulesPanel() {
  const rules = [
    ['1️⃣', 'RESPECT',     'No harassment, hate speech, or discrimination'],
    ['2️⃣', 'NO CHEATING', 'No exploits, duplication, mesh building, speed hacks'],
    ['3️⃣', 'NO GRIEFING', 'No foundation wiping or trap cages on PvE maps'],
    ['4️⃣', 'BASE LIMITS', 'Follow structure limits — admins may demolish violations'],
    ['5️⃣', 'LANGUAGE',    'Keep chat SFW in public. English in global chat'],
    ['⚔️', 'PVP',         'PvP only on Aberration. All other maps are PvE'],
    ['⚠️', 'WARNINGS',    '3 warnings = ban. Admin abuse = instant ban'],
  ];

  const lines = rules.map(([num, label, val]) =>
    `${num} **${label}**\n> *${val}*`
  ).join('\n\n');

  const desc = [
    `\`${U.SCAN_FULL}\``,
    `> ${U.DIAMOND} **D O M I N I O N  C O D E X**`,
    `\`${U.SCAN_FULL}\``,
    '',
    lines,
    '',
    `\`${U.LINE_HEAVY}\``,
    `-# Zero tolerance enforced · /ticket to report violations`,
  ].join('\n');

  return new EmbedBuilder()
    .setColor(HEX.plasma)
    .setAuthor({ name: '📜 Dominion Codex', iconURL: ASSETS.BADGE })
    .setDescription(desc)
    .setFooter(footer('TheConclave Dominion'))
    .setTimestamp();
}

// ─────────────────────────────────────────────────────────────────────
// 🦕 DINO LOOKUP PANEL
// ARK green. Animated GET_ARK_D.gif
// ─────────────────────────────────────────────────────────────────────
function DinoPanel(name, responseText) {
  const desc = [
    `\`${U.SCAN_FULL}\``,
    `> 🦕 **ARK ENCYCLOPEDIA** · ${name.toUpperCase()}`,
    `\`${U.SCAN_LIGHT}\``,
    '',
    responseText.slice(0, 3000),
    '',
    `\`${U.LINE_DOTS}\``,
    `-# ⌁ TheConclave · 5× rates · Max wild 350`,
  ].join('\n');

  return new EmbedBuilder()
    .setColor(HEX.emerald)
    .setAuthor({ name: `🦕 ${name}`, iconURL: ASSETS.ARK_GET })
    .setThumbnail(ASSETS.ARK_GET)
    .setDescription(desc)
    .setFooter(footer('ARK: Survival Ascended'))
    .setTimestamp();
}

// ─────────────────────────────────────────────────────────────────────
// 💡 TIP PANEL
// ─────────────────────────────────────────────────────────────────────
function TipPanel(tipText) {
  return new EmbedBuilder()
    .setColor(HEX.emerald)
    .setAuthor({ name: '💡 Survivor Tip', iconURL: ASSETS.BADGE })
    .setDescription([
      `\`${U.LINE_HEAVY}\``,
      `> ${U.STAR} ${tipText}`,
      `\`${U.LINE_DOTS}\``,
      `-# TheConclave · 5× Crossplay · 10 Maps`,
    ].join('\n'))
    .setFooter(footer())
    .setTimestamp();
}

// ─────────────────────────────────────────────────────────────────────
// 🗺️ MAP INFO PANEL
// ─────────────────────────────────────────────────────────────────────
function MapPanel(m) {
  const desc = [
    `\`${U.SCAN_FULL}\``,
    `> ${m.emoji} **${m.name.toUpperCase()}**${m.pvp ? '  ·  ⚔️ *PvP Enabled*' : m.patreon ? '  ·  ⭐ *Patreon Exclusive*' : ''}`,
    `\`${U.SCAN_LIGHT}\``,
    '',
    `> ${m.desc}`,
    '',
    `\`${U.LINE_DOTS}\``,
    stat('📡', 'CONNECTION', `\`${m.ip}\``),
    stat('⚔️', 'PVP',        m.pvp     ? 'Enabled' : 'Disabled — PvE'),
    stat('⭐', 'ACCESS',     m.patreon ? 'Elite Patreon Only' : 'Open to All'),
    '',
    `\`${U.LINE_HEAVY}\``,
    `-# /crossplay for connection guide · Xbox · PS · PC`,
  ].join('\n');

  return new EmbedBuilder()
    .setColor(HEX.cyan)
    .setAuthor({ name: `${m.emoji} ${m.name}`, iconURL: ASSETS.ARK_GET })
    .setThumbnail(ASSETS.ARK_GET)
    .setDescription(desc)
    .setFooter(footer('TheConclave Dominion'))
    .setTimestamp();
}

// ─────────────────────────────────────────────────────────────────────
// 🎵 WELCOME PANEL
// Purple cosmic. Animated circle GIF.
// ─────────────────────────────────────────────────────────────────────
function WelcomePanel(user, memberCount) {
  const desc = [
    `\`${U.SCAN_FULL}\``,
    `> ${U.DIAMOND} **W E L C O M E  T O  T H E  D O M I N I O N**`,
    `\`${U.SCAN_FULL}\``,
    '',
    `> *You've joined TheConclave Dominion — 5× crossplay ARK across **10 maps**.*`,
    '',
    `\`${U.LINE_DOTS}\``,
    `${U.ARROW_R} **Start:** Read \`#rules\` — the Dominion Codex`,
    `${U.ARROW_R} **Connect:** \`/servers\` for live map IPs`,
    `${U.ARROW_R} **Earn Shards:** Donate \`$1 = 1 ClaveShard\``,
    `${U.ARROW_R} **Shop:** \`/order\` to redeem in-game packages`,
    `${U.ARROW_R} **Support:** \`/ticket\` opens a private thread`,
    `${U.ARROW_R} **Ask AEGIS:** \`/aegis [anything]\``,
    '',
    `\`${U.LINE_HEAVY}\``,
    `> *Member #${memberCount} · We didn't wait for the light. We became it.*`,
  ].join('\n');

  return new EmbedBuilder()
    .setColor(HEX.plasma)
    .setAuthor({ name: `⚔️ Welcome, ${user.username}!`, iconURL: ASSETS.CIRCLE_GIF })
    .setThumbnail(user.displayAvatarURL({ size: 128 }))
    .setDescription(desc)
    .setFooter(footer('TheConclave Dominion'))
    .setTimestamp();
}

// ─────────────────────────────────────────────────────────────────────
// 🎰 DICE / GAME PANEL
// ─────────────────────────────────────────────────────────────────────
function RollPanel(notation, rolls, sum, mod) {
  const desc = [
    `\`${U.LINE_HEAVY}\``,
    `> 🎲 **${notation.toUpperCase()}** · *${rolls.length} dice*`,
    `\`${U.LINE_DOTS}\``,
    '',
    `**Result: ${sum}**`,
    `\`[ ${rolls.join('  ·  ')} ]\`${mod ? `  ${mod > 0 ? '+' : ''}${mod}` : ''}`,
    '',
    bar(sum, rolls.length * parseInt(notation.replace(/.*d/, '')) + (mod || 0), 20, 'roll'),
  ].join('\n');

  return new EmbedBuilder()
    .setColor(HEX.amber)
    .setAuthor({ name: '🎲 Dice Roll', iconURL: ASSETS.BADGE })
    .setDescription(desc)
    .setFooter(footer())
    .setTimestamp();
}

// ─────────────────────────────────────────────────────────────────────
// 📊 POLL PANEL
// ─────────────────────────────────────────────────────────────────────
function PollPanel(question, options, authorName) {
  const L    = ['🇦','🇧','🇨','🇩','🇪','🇫','🇬','🇭','🇮','🇯'];
  const lines = options.map((o, i) => `${L[i]} **${o}**`).join('\n\n');

  const desc = [
    `\`${U.SCAN_FULL}\``,
    `> 📊 **DOMINION POLL**`,
    `\`${U.SCAN_LIGHT}\``,
    '',
    `## ${question}`,
    '',
    lines,
    '',
    `\`${U.LINE_HEAVY}\``,
    `-# React below to vote · Poll by ${authorName}`,
  ].join('\n');

  return new EmbedBuilder()
    .setColor(HEX.cyan)
    .setAuthor({ name: '📊 Community Poll', iconURL: ASSETS.BADGE })
    .setDescription(desc)
    .setFooter(footer(`Poll by ${authorName}`))
    .setTimestamp();
}

// ─────────────────────────────────────────────────────────────────────
// 📦 ECONOMY SUPPLY PANEL
// ─────────────────────────────────────────────────────────────────────
function SupplyPanel(s) {
  const total = s.walletTotal + s.bankTotal;
  const desc  = [
    `\`${U.SCAN_FULL}\``,
    `> ${U.DIAMOND} **ECONOMY SUPPLY LEDGER**`,
    `\`${U.SCAN_LIGHT}\``,
    '',
    stat('💎', 'IN WALLETS',  s.walletTotal.toLocaleString() + ' shards'),
    stat('🏦', 'IN VAULTS',   s.bankTotal.toLocaleString()   + ' shards'),
    stat('📦', 'GRAND TOTAL', total.toLocaleString()          + ' shards'),
    stat('👥', 'HOLDERS',     s.holders.toLocaleString()),
    '',
    bar(s.walletTotal, total, 20, 'circulating'),
    bar(s.bankTotal,   total, 20, 'vaulted'),
    '',
    `\`${U.LINE_HEAVY}\``,
    `-# $1 donation = 1 ClaveShard · Supply grows with community`,
  ].join('\n');

  return new EmbedBuilder()
    .setColor(HEX.gold)
    .setAuthor({ name: '📊 ClaveShard Supply', iconURL: ASSETS.LOOT_YELLOW })
    .setDescription(desc)
    .setFooter(footer('ClaveShard Economy'))
    .setTimestamp();
}

// ─────────────────────────────────────────────────────────────────────
// 🧾 TX HISTORY PANEL
// ─────────────────────────────────────────────────────────────────────
const TX_ICO = {
  deposit: '🏦', withdraw: '💸', transfer_out: '➡️', transfer_in: '⬅️',
  grant: '🎁', deduct: '⬇️', daily_claim: '🌟', admin_set: '🔧',
};

function HistoryPanel(username, rows) {
  const lines = rows.map(r => {
    const sign = ['transfer_in','grant','daily_claim'].includes(r.action) ? '+' : '-';
    const ico  = TX_ICO[r.action] || '💠';
    return `${ico} \`${sign}${r.amount.toLocaleString().padStart(6)}\` ${r.note || r.action} · <t:${Math.floor(new Date(r.created_at).getTime()/1000)}:R>`;
  }).join('\n');

  const desc = [
    `\`${U.SCAN_FULL}\``,
    `> 🧾 **TRANSACTION LOG** · *${username}*`,
    `\`${U.SCAN_LIGHT}\``,
    '',
    lines || '*No transactions yet.*',
    '',
    `\`${U.LINE_HEAVY}\``,
  ].join('\n');

  return new EmbedBuilder()
    .setColor(HEX.plasma)
    .setAuthor({ name: `🧾 ${username}'s History`, iconURL: ASSETS.LOOT_PURPLE })
    .setDescription(desc.slice(0, 4000))
    .setFooter(footer('ClaveShard Ledger'))
    .setTimestamp();
}

// ─────────────────────────────────────────────────────────────────────
// ⏰ REMINDER PANEL
// ─────────────────────────────────────────────────────────────────────
function ReminderSetPanel(message, fireAt) {
  return new EmbedBuilder()
    .setColor(HEX.cyan)
    .setAuthor({ name: '⏰ Reminder Set', iconURL: ASSETS.BADGE })
    .setDescription([
      `\`${U.LINE_HEAVY}\``,
      `> ⏰ I'll ping you <t:${Math.floor(fireAt / 1000)}:R>`,
      `> 📝 *${message}*`,
      `\`${U.LINE_DOTS}\``,
    ].join('\n'))
    .setFooter(footer())
    .setTimestamp();
}

function ReminderFirePanel(message) {
  return new EmbedBuilder()
    .setColor(HEX.amber)
    .setAuthor({ name: '⏰ Reminder!', iconURL: ASSETS.BADGE })
    .setDescription([
      `\`${U.LINE_HEAVY}\``,
      `> 📝 *${message}*`,
      `\`${U.LINE_DOTS}\``,
    ].join('\n'))
    .setFooter(footer())
    .setTimestamp();
}

// ── EXPORTS ──────────────────────────────────────────────────────────
module.exports = {
  // Panels
  AegisPanel, WalletPanel, LeaderboardPanel, ShopPanel, OrderPanel,
  ServerMonitorPanel, ProfilePanel, WarnPanel, GiveawayPanel,
  GiveawayEndPanel, AnnouncementPanel, EventPanel, PingPanel,
  TicketPanel, InfoPanel, SuccessPanel, ErrorPanel, AiUsagePanel,
  RulesPanel, DinoPanel, TipPanel, MapPanel, WelcomePanel,
  RollPanel, PollPanel, SupplyPanel, HistoryPanel,
  ReminderSetPanel, ReminderFirePanel,
  // Primitives (for inline use in bot.js)
  bar, stat, signal, shardDisplay, U, HEX, ASSETS,
};
