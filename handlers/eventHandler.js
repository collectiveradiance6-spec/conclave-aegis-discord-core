'use strict';

const fs = require('fs');
const path = require('path');

const EVENTS_DIR = path.join(__dirname, '..', 'events');

function load(client) {
  client.events = new Map();

  const files = fs.readdirSync(EVENTS_DIR).filter(f => f.endsWith('.js'));

  for (const file of files) {
    const filePath = path.join(EVENTS_DIR, file);

    try {
      const event = require(filePath);

      if (!event?.name || !event?.execute) {
        console.warn(`[EventHandler] Skipped invalid event: ${file}`);
        continue;
      }

      const wrappedExecute = async (...args) => {
        try {
          await event.execute(...args, client);
        } catch (err) {
          console.error(`[EVENT ERROR] ${event.name}:`, err);
        }
      };

      client.events.set(event.name, wrappedExecute);

      client.on(event.name, wrappedExecute);

      console.log(`[EventHandler] Loaded event: ${event.name}`);

    } catch (err) {
      console.error(`[EventHandler] Failed to load ${file}:`, err.message);
    }
  }
}

module.exports = { load };