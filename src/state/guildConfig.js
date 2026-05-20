'use strict';

const { supabase } = require('../../services/supabase');
const store = require('./store');

const CACHE_PREFIX = 'guild_config:';

async function get(guildId) {
  const cached = store.get(CACHE_PREFIX + guildId);

  if (cached) return cached;

  const { data, error } = await supabase
    .from('aegis_guild_config')
    .select('*')
    .eq('guild_id', guildId)
    .single();

  if (error || !data) {
    return {};
  }

  store.set(CACHE_PREFIX + guildId, data);

  return data;
}

async function set(guildId, payload) {
  const { data, error } = await supabase
    .from('aegis_guild_config')
    .upsert({
      guild_id: guildId,
      ...payload,
    })
    .select()
    .single();

  if (error) throw error;

  store.set(CACHE_PREFIX + guildId, data);

  return data;
}

module.exports = {
  get,
  set,
};