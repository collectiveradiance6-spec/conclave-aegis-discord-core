// ═══════════════════════════════════════════════════════════════════════
// CONCLAVE AEGIS — index.js
// Enterprise Bootstrap · v13.0 SOVEREIGN PLATFORM EDITION
// Slim entry point — all logic delegated to handlers + services
// ═══════════════════════════════════════════════════════════════════════
'use strict';
require('dotenv').config();

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const commandHandler = require('./handlers/commandHandler');
const eventHandler   = require('./handlers/eventHandler');
const wsServer       = require('./launchpad/wsServer');
const http           = require('http');

// ── Validate critical env ────────────────────────────────────────────
if (!process.env.DISCORD_BOT_TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN missing. Exiting.');
  process.exit(1);
}

// ── Discord client ───────────────────────────────────────────────────
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
  rest: { timeout: 15000 },
  allowedMentions: { parse: ['users', 'roles'], repliedUser: false },
});

// Attach command collection
client.commands = new Collection();

// ── Load all handlers ────────────────────────────────────────────────
commandHandler.load(client);
eventHandler.load(client);

// ── HTTP health server + WebSocket launchpad ─────────────────────────
const PORT = parseInt(process.env.BOT_PORT || '3001');
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      guilds:  client.guilds?.cache?.size || 0,
      uptime:  Math.floor(process.uptime()),
      version: '13.0',
      ts:      new Date().toISOString(),
    }));
  } else if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('CONCLAVE AEGIS v13.0 — SOVEREIGN PLATFORM EDITION');
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// Attach WebSocket to same HTTP server
wsServer.attach(server, client);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ AEGIS HTTP + WS listening on :${PORT}`);
});

// ── Login ────────────────────────────────────────────────────────────
client.login(process.env.DISCORD_BOT_TOKEN)
  .then(() => console.log(`🟢 AEGIS logged in as ${client.user?.tag}`))
  .catch(err => { console.error('❌ Login failed:', err.message); process.exit(1); });

// ── Graceful shutdown ────────────────────────────────────────────────
const shutdown = (sig) => {
  console.log(`\n[AEGIS] ${sig} received — shutting down gracefully`);
  client.destroy();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException',  err => console.error('[UNCAUGHT]', err.message));
process.on('unhandledRejection', err => console.error('[UNHANDLED]', err?.message || err));

module.exports = client;
