// ═══════════════════════════════════════════════════════════════════════
// Conclave AEGIS — Core Runtime Bootstrap
// Multi-Guild Global Runtime / Discord v14
// ═══════════════════════════════════════════════════════════════════════
'use strict';

require('dotenv').config();

const http = require('http');

const {
  Client,
  GatewayIntentBits,
  Collection,
  Partials,
} = require('discord.js');

// ──────────────────────────────────────────────────────────────────────
// Core Handlers
// ──────────────────────────────────────────────────────────────────────
const commandHandler    = require('./handlers/commandHandler');
const eventHandler      = require('./handlers/eventHandler');
const interactionRouter = require('./handlers/interactionRouter');

const wsServer = require('./launchpad/wsServer');

// ──────────────────────────────────────────────────────────────────────
// Runtime Metadata
// ──────────────────────────────────────────────────────────────────────
const VERSION = 'AEGIS v14 GLOBAL';
const STARTED = Date.now();

// ──────────────────────────────────────────────────────────────────────
// Process Safety
// ──────────────────────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('[FATAL EXCEPTION]');
  console.error(err);
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

process.on('unhandledRejection', (reason) => {
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('[UNHANDLED REJECTION]');
  console.error(reason);
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

// ──────────────────────────────────────────────────────────────────────
// Environment Validation
// ──────────────────────────────────────────────────────────────────────
if (!process.env.DISCORD_BOT_TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN missing');
  process.exit(1);
}

// ──────────────────────────────────────────────────────────────────────
// Discord Client
// ──────────────────────────────────────────────────────────────────────
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

  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.User,
  ],
});

// ──────────────────────────────────────────────────────────────────────
// Runtime Containers
// ──────────────────────────────────────────────────────────────────────
client.commands = new Collection();

client.runtime = {
  version: VERSION,
  startedAt: STARTED,
};

client.handlers = {};
client.services = {};
client.cache = {};

// ──────────────────────────────────────────────────────────────────────
// Boot Sequence
// ──────────────────────────────────────────────────────────────────────
async function bootstrap() {

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🚀 Booting ${VERSION}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {

    // ── Commands ─────────────────────────────────
    commandHandler.load(client);

    // ── Events ───────────────────────────────────
    eventHandler.load(client);

    // ── Router ───────────────────────────────────
    client.on('interactionCreate', async (interaction) => {
      try {
        await interactionRouter.route(interaction, client);
      } catch (err) {
        console.error('[INTERACTION ROUTER ERROR]', err);
      }
    });

    console.log('✅ Core handlers initialized');

  } catch (err) {

    console.error('[BOOT FAILURE]', err);
    process.exit(1);
  }
}

// ──────────────────────────────────────────────────────────────────────
// HTTP Server
// ──────────────────────────────────────────────────────────────────────
const PORT = process.env.BOT_PORT || 3001;

const server = http.createServer((req, res) => {

  // ── Health Endpoint ───────────────────────────
  if (req.url === '/health') {

    res.writeHead(200, {
      'Content-Type': 'application/json',
    });

    return res.end(JSON.stringify({
      status: 'ok',
      bot: client.user?.tag || null,
      version: VERSION,
      uptime_seconds: Math.floor(process.uptime()),
      guilds: client.guilds?.cache?.size || 0,
      commands: client.commands?.size || 0,
      memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      timestamp: new Date().toISOString(),
    }));
  }

  // ── Root ──────────────────────────────────────
  if (req.url === '/') {

    res.writeHead(200, {
      'Content-Type': 'text/plain',
    });

    return res.end(`${VERSION} ONLINE`);
  }

  // ── 404 ───────────────────────────────────────
  res.writeHead(404);
  res.end('Not Found');
});

// ──────────────────────────────────────────────────────────────────────
// Render Stability
// ──────────────────────────────────────────────────────────────────────
server.keepAliveTimeout = 120000;
server.headersTimeout   = 120000;

// ──────────────────────────────────────────────────────────────────────
// WebSocket Runtime
// ──────────────────────────────────────────────────────────────────────
try {

  wsServer.attach(server, client);

} catch (err) {

  console.error('[WS ERROR]', err);
}

// ──────────────────────────────────────────────────────────────────────
// Ready Lifecycle
// ──────────────────────────────────────────────────────────────────────
client.once('clientReady', async () => {

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🟢 ${VERSION} ONLINE`);
  console.log(`🤖 Bot: ${client.user.tag}`);
  console.log(`🌐 Guilds: ${client.guilds.cache.size}`);
  console.log(`⚡ Commands: ${client.commands.size}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

// ──────────────────────────────────────────────────────────────────────
// Graceful Shutdown
// ──────────────────────────────────────────────────────────────────────
async function shutdown(signal = 'SIGTERM') {

  console.log(`\n[${signal}] shutting down...`);

  try {
    await client.destroy();
  } catch {}

  try {
    server.close();
  } catch {}

  process.exit(0);
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ──────────────────────────────────────────────────────────────────────
// Start Runtime
// ──────────────────────────────────────────────────────────────────────
(async () => {

  await bootstrap();

  server.listen(PORT, () => {
    console.log(`🌐 HTTP + WS listening on :${PORT}`);
  });

  try {

    await client.login(process.env.DISCORD_BOT_TOKEN);

  } catch (err) {

    console.error('[LOGIN FAILED]', err);
    process.exit(1);
  }

})();

// ──────────────────────────────────────────────────────────────────────

module.exports = client;