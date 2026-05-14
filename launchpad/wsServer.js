// ═══════════════════════════════════════════════════════════════════════
// launchpad/wsServer.js
// WebSocket server — real-time feed for launchpad dashboard
// Broadcasts: guild events, command usage, economy activity, AI usage
// ═══════════════════════════════════════════════════════════════════════
'use strict';

const { WebSocketServer } = require('ws');

let wss   = null;
let _client = null;
const clients = new Set();

// ── Attach to existing HTTP server ────────────────────────────────────
function attach(httpServer, discordClient) {
  _client = discordClient;
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    console.log(`[WS] Client connected from ${ip}. Total: ${clients.size+1}`);
    clients.add(ws);

    // Send current state on connect
    ws.send(JSON.stringify({
      type: 'hello',
      guilds:   _client?.guilds?.cache?.size || 0,
      commands: _client?.commands?.size       || 0,
      uptime:   Math.floor(process.uptime()),
      ts:       Date.now(),
    }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        handleClientMessage(ws, msg);
      } catch {}
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[WS] Client disconnected. Total: ${clients.size}`);
    });

    ws.on('error', () => clients.delete(ws));
  });

  // Heartbeat — ping all clients every 30s
  setInterval(() => {
    broadcast({ type: 'heartbeat', uptime: Math.floor(process.uptime()), guilds: _client?.guilds?.cache?.size || 0, ts: Date.now() });
  }, 30_000);

  console.log('[WS] WebSocket server attached to HTTP server at /ws');
}

// ── Handle incoming messages from dashboard ──────────────────────────
function handleClientMessage(ws, msg) {
  switch (msg.type) {
    case 'ping':
      ws.send(JSON.stringify({ type:'pong', ts:Date.now() }));
      break;
    case 'stats':
      ws.send(JSON.stringify({
        type: 'stats',
        guilds:   _client?.guilds?.cache?.size || 0,
        users:    _client?.guilds?.cache?.reduce((s,g)=>s+g.memberCount,0) || 0,
        commands: _client?.commands?.size || 0,
        uptime:   Math.floor(process.uptime()),
        ts:       Date.now(),
      }));
      break;
    case 'guild_list':
      const guildList = _client?.guilds?.cache?.map(g=>({ id:g.id, name:g.name, memberCount:g.memberCount, icon:g.iconURL({size:32}) })) || [];
      ws.send(JSON.stringify({ type:'guild_list', guilds:guildList, ts:Date.now() }));
      break;
    default:
      ws.send(JSON.stringify({ type:'error', message:'Unknown message type', ts:Date.now() }));
  }
}

// ── Broadcast to all connected dashboard clients ─────────────────────
function broadcast(payload) {
  if (!wss || clients.size === 0) return;
  const data = JSON.stringify(payload);
  for (const ws of clients) {
    try {
      if (ws.readyState === 1 /* OPEN */) ws.send(data);
    } catch { clients.delete(ws); }
  }
}

// ── Event helpers (called from commands/events) ───────────────────────
const emitCommand  = (name, guildId, userId) => broadcast({ type:'command_used', name, guildId, userId, ts:Date.now() });
const emitEconomy  = (action, amount, guildId) => broadcast({ type:'economy_action', action, amount, guildId, ts:Date.now() });
const emitAI       = (engine, model) => broadcast({ type:'ai_used', engine, model, ts:Date.now() });
const emitMod      = (action, guildId) => broadcast({ type:'mod_action', action, guildId, ts:Date.now() });

module.exports = { attach, broadcast, emitCommand, emitEconomy, emitAI, emitMod };
