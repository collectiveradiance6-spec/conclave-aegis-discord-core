// ═══════════════════════════════════════════════════════════════════════
// handlers/commandHandler.js
// Auto-loads all commands from commands/**/*.js
// Registers slash commands to Discord (guild + global)
// ═══════════════════════════════════════════════════════════════════════
'use strict';

const { REST, Routes } = require('discord.js');
const fs   = require('fs');
const path = require('path');

const COMMANDS_DIR = path.join(__dirname, '..', 'commands');

// ── Load all command modules ─────────────────────────────────────────
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
        const mod = require(path.join(catPath, file));
        // Support both single export and array export
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

  console.log(`[CommandHandler] ✅ Loaded ${loaded.length} commands: ${loaded.join(', ')}`);

  // Register to Discord after client is ready
  client.once('ready', () => registerCommands(client));
}

// ── Register slash commands to Discord ──────────────────────────────
async function registerCommands(client) {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
  const body = [...client.commands.values()].map(cmd => cmd.data.toJSON());

  try {
    // Guild-specific (instant update for dev/Conclave guilds)
    const targetGuilds = [
      process.env.DISCORD_GUILD_ID,
      process.env.CYBER_NEXUS_GUILD_ID,
    ].filter(Boolean);

    for (const guildId of targetGuilds) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, guildId),
        { body }
      );
      console.log(`[CommandHandler] ✅ Registered ${body.length} commands to guild ${guildId}`);
    }

    // Global registration (for all guilds that add AEGIS)
    if (process.env.REGISTER_GLOBAL === 'true') {
      await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body });
      console.log(`[CommandHandler] ✅ Registered ${body.length} commands globally`);
    }
  } catch (err) {
    console.error('[CommandHandler] Registration failed:', err.message);
  }
}

module.exports = { load };
