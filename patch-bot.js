#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// AEGIS bot.js PATCH — applies all ticket system fixes
// Run once from your project root: node patch-bot.js
// Creates bot.js.bak before modifying
// ═══════════════════════════════════════════════════════════════════
'use strict';

const fs   = require('fs');
const path = require('path');

const BOT_PATH = path.join(__dirname, 'bot.js');
const BAK_PATH = BOT_PATH + '.bak';

if (!fs.existsSync(BOT_PATH)) {
  console.error('❌ bot.js not found in current directory');
  process.exit(1);
}

// Backup
fs.copyFileSync(BOT_PATH, BAK_PATH);
console.log(`✅ Backup saved to bot.js.bak`);

let src = fs.readFileSync(BOT_PATH, 'utf8');

let changes = 0;

// ── PATCH 1: Add handleTicketInteraction import ──────────────────
const IMPORT_SEARCH = `const { sendWatchtowerPanel, handleWatchtowerInteraction } = require('./watchtower-system');`;
const IMPORT_REPLACE = `const { sendWatchtowerPanel, handleWatchtowerInteraction } = require('./watchtower-system');
const { handleTicketInteraction } = require('./ticket-system');`;

if (src.includes(IMPORT_SEARCH) && !src.includes("require('./ticket-system')")) {
  src = src.replace(IMPORT_SEARCH, IMPORT_REPLACE);
  console.log('✅ Patch 1: Added handleTicketInteraction import');
  changes++;
} else if (src.includes("require('./ticket-system')")) {
  console.log('⏭️  Patch 1: Already applied');
} else {
  console.warn('⚠️  Patch 1: Could not find watchtower import line — add manually');
}

// ── PATCH 2: Add handleTicketInteraction as FIRST handler ────────
// Handles both indentation styles seen in bot.js
const HANDLER_PATTERNS = [
  // With irregular indentation (as seen in uploaded file)
  `    if (await handleWatchtowerInteraction(interaction, bot)) return;\n  if (await handleTriviaCommand(interaction)) return;\nif (await handleTriviaButton(interaction)) return;\nif (await handleTriviaModalSubmit(interaction)) return;`,
  // Clean indentation
  `    if (await handleWatchtowerInteraction(interaction, bot)) return;\n    if (await handleTriviaCommand(interaction)) return;\n    if (await handleTriviaButton(interaction)) return;\n    if (await handleTriviaModalSubmit(interaction)) return;`,
  // Already has isTicketInteraction guard
  `if (await handleTicketInteraction(interaction, bot)) return;`,
];

const HANDLER_REPLACE = `    if (await handleTicketInteraction(interaction, bot)) return;
    if (await handleWatchtowerInteraction(interaction, bot)) return;
    if (await handleTriviaCommand(interaction)) return;
    if (await handleTriviaButton(interaction)) return;
    if (await handleTriviaModalSubmit(interaction)) return;`;

if (src.includes('if (await handleTicketInteraction(interaction, bot)) return;')) {
  console.log('⏭️  Patch 2: Already applied');
} else {
  let patched = false;
  for (const pattern of HANDLER_PATTERNS.slice(0, 2)) {
    if (src.includes(pattern)) {
      src = src.replace(pattern, HANDLER_REPLACE);
      console.log('✅ Patch 2: Added handleTicketInteraction as first handler');
      changes++;
      patched = true;
      break;
    }
  }
  if (!patched) {
    // Try a more flexible search for the watchtower handler line
    const lines   = src.split('\n');
    const wIdx    = lines.findIndex(l => l.includes('handleWatchtowerInteraction(interaction, bot)) return'));
    if (wIdx !== -1 && !lines[wIdx - 1]?.includes('handleTicketInteraction')) {
      lines.splice(wIdx, 0, '    if (await handleTicketInteraction(interaction, bot)) return;');
      src = lines.join('\n');
      console.log('✅ Patch 2: Inserted handleTicketInteraction before watchtower handler');
      changes++;
    } else {
      console.warn('⚠️  Patch 2: Could not locate handler block — add manually:\n    if (await handleTicketInteraction(interaction, bot)) return;\n  (as the FIRST line inside the try{} block of bot.on(InteractionCreate)');
    }
  }
}

// ── PATCH 3: Remove old simple ticket_open thread-creation handler ──
// Old handler creates a GuildText channel — replaced by ticket-system.js
const OLD_TICKET_OPEN = /    if \(interaction\.isButton\(\) && interaction\.customId==='ticket_open'\) \{[\s\S]*?await interaction\.editReply\(\{ content:`✅ Ticket created: \$\{ch\}`[\s\S]*?\}\s*\n    \}/m;
if (OLD_TICKET_OPEN.test(src)) {
  src = src.replace(OLD_TICKET_OPEN, '    // ticket_open handled by ticket-system.js');
  console.log('✅ Patch 3: Removed old thread-creation ticket_open handler');
  changes++;
} else {
  console.log('⏭️  Patch 3: Old ticket_open handler not found (may already be removed or is different version)');
}

// ── PATCH 4: Remove old simple ticket_close handler ──────────────
const OLD_TICKET_CLOSE = /    if \(interaction\.isButton\(\) && interaction\.customId==='ticket_close'\) \{[\s\S]*?setTimeout\(\(\)=>interaction\.channel\.delete\(\)[\s\S]*?\n    \}/m;
if (OLD_TICKET_CLOSE.test(src)) {
  src = src.replace(OLD_TICKET_CLOSE, '    // ticket_close handled by ticket-system.js');
  console.log('✅ Patch 4: Removed old ticket_close handler');
  changes++;
} else {
  console.log('⏭️  Patch 4: Old ticket_close handler not found');
}

// ── PATCH 5: Fix dead `if (error)` line in setup-tickets ─────────
const DEAD_ERROR_LINE = /const success = await guildManager\.updateField[\s\S]*?if \(!success\) return interaction\.editReply\(`⚠️ Failed to save webhook\. Check logs\.`\);\s*\n\s*if \(error\) return interaction\.editReply/;
if (DEAD_ERROR_LINE.test(src)) {
  src = src.replace(
    /(\s*if \(!success\) return interaction\.editReply\(`⚠️ Failed to save webhook\. Check logs\.`\);)\s*\n\s*if \(error\) return interaction\.editReply\(`⚠️ Failed to save: \$\{error\.message\}`\);/,
    '$1'
  );
  console.log('✅ Patch 5: Removed dead `if (error)` line in setup-tickets');
  changes++;
} else {
  console.log('⏭️  Patch 5: Dead error line not found (may already be removed)');
}

// ── PATCH 6: Remove duplicate if (!guildCfg) check ───────────────
const DUPE_GUILD_CFG = /(if \(!guildCfg\) return interaction\.editReply\('⚠️ Server config not found\. Contact an admin\.'\);)\s*\n\s*if \(!guildCfg\) return interaction\.editReply\('⚠️ Server config not found\. Contact an admin\.'\);/;
if (DUPE_GUILD_CFG.test(src)) {
  src = src.replace(DUPE_GUILD_CFG, '$1');
  console.log('✅ Patch 6: Removed duplicate guildCfg check');
  changes++;
} else {
  console.log('⏭️  Patch 6: Duplicate guildCfg check not found');
}

// ── WRITE OUTPUT ──────────────────────────────────────────────────
fs.writeFileSync(BOT_PATH, src, 'utf8');
console.log(`\n✅ Done — ${changes} patch(es) applied to bot.js`);
console.log('   Backup is at bot.js.bak if you need to roll back');
console.log('\n   Next: commit + push to GitHub → Render redeploys automatically');
