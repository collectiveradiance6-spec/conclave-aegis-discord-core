'use strict';

const guildConfig = require('../state/guildConfig');

async function createContext(client, interaction) {
  const guildId = interaction.guildId || null;

  const config = guildId
    ? await guildConfig.get(guildId)
    : {};

  return {
    client,
    interaction,
    guildId,
    userId: interaction.user?.id || null,
    config,
    createdAt: Date.now(),
  };
}

module.exports = {
  createContext,
};