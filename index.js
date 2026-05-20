'use strict';
require('dotenv').config();

const http = require('http');
const { Client, GatewayIntentBits, Collection } = require('discord.js');

const commandHandler = require('./handlers/commandHandler');
const eventHandler   = require('./handlers/eventHandler');
const wsServer       = require('./launchpad/wsServer');

// ── Safety hooks ─────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[FATAL]', err);
});

process.on('unhandledRejection', (err) => {
  console.error('[PROMISE ERROR]', err);
});

// ── ENV CHECK ────────────────────────────────────────
if (!process.env.DISCORD_BOT_TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN missing');
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

// ── HANDLERS ─────────────────────────────────────────
try {
  commandHandler.load(client);
  eventHandler.load(client);
} catch (err) {
  console.error('[BOOT ERROR] handlers failed', err);
  process.exit(1);
}

// ── HTTP SERVER ──────────────────────────────────────
const PORT = process.env.BOT_PORT || 3001;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      guilds: client.guilds?.cache?.size || 0,
      ts: new Date().toISOString(),
    }));
    return;
  }

  res.writeHead(404);
  res.end();
});

// ── WS ATTACH ────────────────────────────────────────
try {
  wsServer.attach(server, client);
} catch (err) {
  console.error('[WS ERROR]', err);
}

// ── START SERVER ─────────────────────────────────────
server.listen(PORT, () => {
  console.log(`HTTP + WS running on ${PORT}`);
});

// ── READY ────────────────────────────────────────────
client.once('ready', () => {
  console.log(`READY: ${client.user.tag}`);
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