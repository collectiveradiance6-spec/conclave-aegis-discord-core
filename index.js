'use strict';
require('dotenv').config();

const http = require('http');
const { Client, GatewayIntentBits, Collection } = require('discord.js');

const commandHandler    = require('./handlers/commandHandler');
const eventHandler      = require('./handlers/eventHandler');
const interactionRouter = require('./handlers/interactionRouter');
const wsServer          = require('./launchpad/wsServer');

// ── Safety Hooks ─────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[FATAL]', err);
});

process.on('unhandledRejection', (err) => {
  console.error('[PROMISE ERROR]', err);
});

// ── ENV CHECK ────────────────────────────────────────
if (!process.env.DISCORD_BOT_TOKEN) {
  console.error('❌ Missing DISCORD_BOT_TOKEN');
  process.exit(1);
}

// ── DISCORD CLIENT ───────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildModeration,
  ],
});

client.commands = new Collection();

// ── LOAD HANDLERS ────────────────────────────────────
try {
  commandHandler.load(client);
  eventHandler.load(client);
} catch (err) {
  console.error('[BOOT ERROR] handler load failed', err);
  process.exit(1);
}

// ── INTERACTION ROUTER (THIS IS THE KEY FIX) ─────────
client.on('interactionCreate', async (interaction) => {
  try {
    await interactionRouter.route(interaction, client);
  } catch (err) {
    console.error('[INTERACTION ERROR]', err);
  }
});

// ── HTTP SERVER ──────────────────────────────────────
const PORT = process.env.BOT_PORT || 3001;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      guilds: client.guilds?.cache?.size || 0,
      ts: new Date().toISOString(),
    }));
  }

  res.writeHead(404);
  res.end('Not Found');
});

// ── WS SERVER ────────────────────────────────────────
try {
  wsServer.attach(server, client);
} catch (err) {
  console.error('[WS ERROR]', err);
}

// ── SERVER SAFETY SETTINGS ───────────────────────────
server.keepAliveTimeout = 120000;
server.headersTimeout    = 120000;

// ── START SERVER ─────────────────────────────────────
server.listen(PORT, () => {
  console.log(`HTTP + WS running on port ${PORT}`);
});

// ── READY EVENT ──────────────────────────────────────
client.once('ready', () => {
  console.log(`🟢 READY: ${client.user.tag}`);
});

// ── LOGIN ────────────────────────────────────────────
client.login(process.env.DISCORD_BOT_TOKEN)
  .catch(err => {
    console.error('[LOGIN FAILED]', err);
    process.exit(1);
  });

// ── SHUTDOWN ─────────────────────────────────────────
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function shutdown() {
  console.log('[SHUTDOWN] closing...');
  try { client.destroy(); } catch {}
  try { server.close(); } catch {}
  process.exit(0);
}

module.exports = client;