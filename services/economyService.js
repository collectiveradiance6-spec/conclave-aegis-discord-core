'use strict';

const { supabase } = require('./supabase');

async function getWallet(userId, guildId) {
  const { data, error } = await supabase
    .from('aegis_wallets')
    .select('*')
    .eq('user_id', userId)
    .eq('guild_id', guildId)
    .single();

  if (error) return null;

  return data;
}

module.exports = {
  getWallet,
};