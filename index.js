'use strict';
require('dotenv').config();

const http = require('http');
const { Client, GatewayIntentBits, Collection } = require('discord.js');

const commandHandler = require('./handlers/commandHandler');
const eventHandler   = require('./handlers/eventHandler');
const wsServer       = require('./launchpad/wsServer');

const { createCommandEngine } = require('./runtime/commandEngine');

// ── Safety ─────────────────────────────
process.on('uncaughtException', console.error);
process.on('unhandledRejection', console.error);

// ── ENV ────────────────────────────────
if (!process.env.DISCORD_BOT_TOKEN) {
  console.error('Missing DISCORD_BOT_TOKEN');
  process.exit(1);
}

// ── CLIENT ─────────────────────────────
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

// ── COMMAND ENGINE ─────────────────────
const commandEngine = createCommandEngine(client);

// message routing
client.on('messageCreate', (msg) => {
  commandEngine.handle(msg);
});

// ── HANDLERS ───────────────────────────
commandHandler.load(client);
eventHandler.load(client);

// ── HTTP ───────────────────────────────
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.end(JSON.stringify({
      ok: true,
      guilds: client.guilds.cache.size,
      uptime: process.uptime(),
    }));
    return;
  }
  res.end('AEGIS ONLINE');
});

// ── WS ────────────────────────────────
wsServer.attach(server, client);

// ── START ─────────────────────────────
server.listen(process.env.BOT_PORT || 3001);

client.once('ready', () => {
  console.log(`🟢 READY: ${client.user.tag}`);
});

client.login(process.env.DISCORD_BOT_TOKEN);