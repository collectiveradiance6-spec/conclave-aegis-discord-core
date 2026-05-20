'use strict';

class Orchestrator {
  constructor() {
    this.services = new Map();
  }

  register(name, service) {
    this.services.set(name, service);
  }

  async start() {
    for (const [name, service] of this.services.entries()) {
      try {
        if (typeof service.start === 'function') {
          await service.start();
        }
        console.log(`[ORCH] ${name} started`);
      } catch (err) {
        console.error(`[ORCH] ${name} failed`, err);
      }
    }
  }

  async stop() {
    for (const [name, service] of this.services.entries()) {
      try {
        if (typeof service.stop === 'function') {
          await service.stop();
        }
        console.log(`[ORCH] ${name} stopped`);
      } catch (err) {
        console.error(`[ORCH] ${name} stop error`, err);
      }
    }
  }
}

module.exports = { Orchestrator };