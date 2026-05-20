'use strict';

const interactionRouter = require('../handlers/interactionRouter');

module.exports = {
  name: 'interactionCreate',

  async execute(interaction, client) {
    try {
      return await interactionRouter.route(interaction, client);
    } catch (err) {
      console.error('[interactionCreate ERROR]', err);

      if (!interaction.replied) {
        await interaction.reply({
          content: '⚠️ Interaction system error.',
          flags: 64,
        }).catch(() => {});
      }
    }
  },
};