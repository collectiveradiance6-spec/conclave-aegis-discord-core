'use strict';

const logger = require('../core/logger');
const { createContext } = require('./contextFactory');

async function execute(client, interaction, command) {
  const ctx = await createContext(client, interaction);

  try {
    await command.execute(interaction, ctx);

    logger.success(
      'COMMAND',
      `${command.data?.name || 'unknown'} executed`,
      {
        guildId: ctx.guildId,
        userId: ctx.userId,
      }
    );
  } catch (err) {
    logger.error('COMMAND', err.message);

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({
        content: '❌ Command execution failed.',
        ephemeral: true,
      }).catch(() => {});
    } else {
      await interaction.reply({
        content: '❌ Command execution failed.',
        ephemeral: true,
      }).catch(() => {});
    }
  }
}

module.exports = {
  execute,
};