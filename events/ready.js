// events/ready.js
'use strict';
const { Events, ActivityType } = require('discord.js');
const guildManager = require('../managers/guildManager');
const { startMonitor } = require('../monitors/serverMonitor');
const wsServer     = require('../launchpad/wsServer');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`\n🟢 AEGIS Online — ${client.user.tag}`);
    console.log(`   Guilds: ${client.guilds.cache.size}`);
    console.log(`   Commands: ${client.commands.size}`);

    // Set presence
    client.user.setPresence({
      activities: [{ name: `${client.guilds.cache.size} servers | /help`, type: ActivityType.Watching }],
      status: 'online',
    });

    // Provision any guilds that joined while bot was offline
    for (const [guildId, guild] of client.guilds.cache) {
      const cfg = await guildManager.getConfig(guildId);
      if (!cfg) await guildManager.provision(guildId, guild.name);
    }

    // Start live server monitor
    startMonitor(client);

    // Broadcast ready to launchpad
    wsServer.broadcast({
      type: 'bot_ready',
      guilds: client.guilds.cache.size,
      tag: client.user.tag,
      ts: Date.now(),
    });

    // Refresh presence every 5 min
    setInterval(() => {
      client.user.setPresence({
        activities: [{ name: `${client.guilds.cache.size} servers | /help`, type: ActivityType.Watching }],
        status: 'online',
      });
    }, 5 * 60_000);
  },
};
