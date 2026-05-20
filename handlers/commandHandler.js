// ═══════════════════════════════════════════════════════════════════════
// handlers/commandHandler.js — AEGIS v14 GLOBAL EDITION
// Registers slash commands globally AND to priority guilds instantly.
// Global propagation takes up to 1 hour — priority guilds are instant.
// ═══════════════════════════════════════════════════════════════════════
'use strict';

const { REST, Routes } = require('discord.js');
const fs   = require('fs');
const path = require('path');

const COMMANDS_DIR = path.join(__dirname, '..', 'commands');

// Priority guilds get instant command registration (guild-scoped = instant)
// All other guilds receive commands via global propagation (up to 1hr)
const PRIORITY_GUILDS = [
  process.env.DISCORD_GUILD_ID,               // TheConclave Dominion
  process.env.CYBER_NEXUS_GUILD_ID,           // Cyber Nexus
].filter(Boolean);

// ── Load all command modules ──────────────────────────────────────────
function load(client) {
  const loaded = [];

  const categories = fs.readdirSync(COMMANDS_DIR).filter(f =>
    fs.statSync(path.join(COMMANDS_DIR, f)).isDirectory()
  );

  for (const cat of categories) {
    const catPath = path.join(COMMANDS_DIR, cat);
    const files   = fs.readdirSync(catPath).filter(f => f.endsWith('.js'));

    for (const file of files) {
      try {
        const mod  = require(path.join(catPath, file));
        const cmds = Array.isArray(mod) ? mod : [mod];
        for (const cmd of cmds) {
          if (!cmd?.data?.name || !cmd?.execute) {
            console.warn(`[CommandHandler] Skipping entry in ${file} — missing data.name or execute`);
            continue;
          }
          client.commands.set(cmd.data.name, cmd);
          loaded.push(cmd.data.name);
        }
      } catch (err) {
        console.error(`[CommandHandler] Failed to load ${file}:`, err.message);
      }
    }
  }

  console.log(`[CommandHandler] ✅ Loaded ${loaded.length} commands`);

  // Register after client is ready
  client.once('ready', () => registerCommands(client));
}

// ── Register slash commands ───────────────────────────────────────────
async function registerCommands(client) {
  if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_CLIENT_ID) {
    console.warn('[CommandHandler] Missing BOT_TOKEN or CLIENT_ID — skipping registration');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
  const body = [...client.commands.values()].map(cmd => cmd.data.toJSON());

  // 1. Register to priority guilds FIRST (instant, no propagation delay)
  for (const guildId of PRIORITY_GUILDS) {
    try {
      await rest.put(
        Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, guildId),
        { body }
      );
      console.log(`[CommandHandler] ✅ Guild commands registered → ${guildId} (${body.length} cmds, instant)`);
    } catch (err) {
      console.warn(`[CommandHandler] ⚠️  Guild ${guildId} registration failed: ${err.message}`);
    }
  }

  // 2. Register globally so ALL guilds that add AEGIS get commands
  //    (propagates to all Discord servers within ~1 hour)
  try {
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body }
    );
    console.log(`[CommandHandler] ✅ Global commands registered (${body.length} cmds — propagates ~1hr to new guilds)`);
  } catch (err) {
    console.error('[CommandHandler] ❌ Global registration failed:', err.message);
  }
}

// ── Register to a single guild on demand (called when bot joins a new guild) ──
async function registerToGuild(guildId) {
  if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_CLIENT_ID) return;
  // Global registration already covers new guilds within 1hr.
  // This can be called from guildCreate to ensure instant availability.
  try {
    const rest   = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
    // We'd need the client commands here — this is called from guildCreate.js
    // Pass body directly via dynamic require to avoid circular dep.
    console.log(`[CommandHandler] Guild ${guildId} will receive commands via global propagation (~1hr).`);
    console.log(`[CommandHandler] For instant commands in new guilds, restart the bot once.`);
  } catch (err) {
    console.warn(`[CommandHandler] registerToGuild error:`, err.message);
  }
}

module.exports = { load, registerCommands, registerToGuild };
