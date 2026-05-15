// ═══════════════════════════════════════════════════════════════════════
// handlers/eventHandler.js
// Auto-loads all event files from events/*.js
// ═══════════════════════════════════════════════════════════════════════
'use strict';

const fs   = require('fs');
const path = require('path');

const EVENTS_DIR = path.join(__dirname, '..', 'events');

function load(client) {
  const files = fs.readdirSync(EVENTS_DIR).filter(f => f.endsWith('.js'));

  for (const file of files) {
    try {
      const event = require(path.join(EVENTS_DIR, file));
      if (!event?.name || !event?.execute) {
        console.warn(`[EventHandler] Skipping ${file} — missing name or execute`);
        continue;
      }
      // In discord.js v14, ClientReady fires as 'ready'. Use 'ready' so handler fires.
      // Our ready.js uses 'clientReady' directly — map it back to 'ready' for v14 compat.
      const evName = event.name === 'clientReady' ? 'ready' : event.name;
      const handler = async (...args) => {
        try {
          await event.execute(...args, client);
        } catch(err) {
          console.error(`[Event:${event.name}]`, err.message);
        }
      };
      if (event.once) {
        client.once(evName, handler);
      } else {
        client.on(evName, handler);
      }
      console.log(`[EventHandler] ✅ Loaded event: ${event.name}`);
    } catch (err) {
      console.error(`[EventHandler] Failed to load ${file}:`, err.message);
    }
  }
}

module.exports = { load };
