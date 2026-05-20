'use strict';

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const commandHandler = require('../../handlers/commandHandler');
const eventHandler = require('../../handlers/eventHandler');

function createDiscordGateway() {
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

  return {
    client,

    async start() {
      try {
        commandHandler.load(client);
        eventHandler.load(client);

        client.once('ready', () => {
          console.log(`[DISCORD] Ready as ${client.user.tag}`);
        });

        await client.login(process.env.DISCORD_BOT_TOKEN);
      } catch (err) {
        console.error('[DISCORD] startup failed', err);
        throw err;
      }
    },

    async stop() {
      try {
        client.destroy();
      } catch (err) {
        console.error('[DISCORD] shutdown error', err);
      }
    }
  };
}

module.exports = { createDiscordGateway };