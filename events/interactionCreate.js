'use strict';

const router = require('../runtime/interactionRouter');

module.exports = async (interaction, client) => {
  try {
    await router.handle(interaction, client);
  } catch (err) {
    console.error('[InteractionRouter Error]', err);

    if (interaction?.isRepliable?.()) {
      try {
        await interaction.reply({
          content: '⚠️ Interaction error occurred.',
          flags: 64,
        });
      } catch {}
    }
  }
};