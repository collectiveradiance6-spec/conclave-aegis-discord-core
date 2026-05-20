'use strict';

function createCommandEngine(client) {

  return {
    handle(message) {
      if (!message || message.author.bot) return;

      const prefix = '!';
      if (!message.content.startsWith(prefix)) return;

      const args = message.content.slice(prefix.length).trim().split(/\s+/);
      const cmdName = args.shift()?.toLowerCase();

      const cmd = client.commands.get(cmdName);
      if (!cmd) return;

      try {
        cmd.execute(message, args, client);
      } catch (err) {
        console.error('[COMMAND ERROR]', err);
      }
    }
  };
}

module.exports = { createCommandEngine };