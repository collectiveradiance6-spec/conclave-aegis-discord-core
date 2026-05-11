// ============================================================
// src/managers/guildManager.js
// AEGIS v12.1 — Multi-Guild Config Manager
// ============================================================

const { createClient } = require('@supabase/supabase-js');

// Create own Supabase client — no dependency on knowledge_db path
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

class GuildManager {
  constructor() {
    this._cache   = new Map(); // guildId → { config, fetchedAt }
    this._pending = new Map(); // guildId → Promise
  }

  // ── Primary method ──────────────────────────────────────────
  async getConfig(guildId) {
    if (!guildId) return null;

    const cached = this._cache.get(guildId);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.config;
    }

    if (this._pending.has(guildId)) {
      return this._pending.get(guildId);
    }

    const promise = this._fetchConfig(guildId);
    this._pending.set(guildId, promise);

    try {
      return await promise;
    } finally {
      this._pending.delete(guildId);
    }
  }

  // ── Fetch from Supabase ─────────────────────────────────────
  async _fetchConfig(guildId) {
    try {
      const { data, error } = await supabase
        .from('guild_configs')
        .select('*')
        .eq('guild_id', guildId)
        .single();

      if (error || !data) {
        console.warn(`[GuildManager] No config found for guild ${guildId}`);
        return null;
      }

      this._cache.set(guildId, { config: data, fetchedAt: Date.now() });
      return data;
    } catch (err) {
      console.error(`[GuildManager] Fetch error for guild ${guildId}:`, err.message);
      return null;
    }
  }

  // ── Force refresh ───────────────────────────────────────────
  async refreshConfig(guildId) {
    this._cache.delete(guildId);
    return this.getConfig(guildId);
  }

  // ── Update a field in DB + bust cache ──────────────────────
  async updateField(guildId, field, value) {
    try {
      const { error } = await supabase
        .from('guild_configs')
        .update({ [field]: value })
        .eq('guild_id', guildId);

      if (error) {
        console.error(`[GuildManager] Update failed for ${guildId}.${field}:`, error.message);
        return false;
      }

      this._cache.delete(guildId);
      return true;
    } catch (err) {
      console.error(`[GuildManager] Update error:`, err.message);
      return false;
    }
  }

  // ── Get all guilds (for Nitrado monitor) ────────────────────
  async getAllConfigs() {
    try {
      const { data, error } = await supabase
        .from('guild_configs')
        .select('*');

      if (error || !data) return [];

      for (const config of data) {
        this._cache.set(config.guild_id, { config, fetchedAt: Date.now() });
      }

      return data;
    } catch (err) {
      console.error('[GuildManager] getAllConfigs error:', err.message);
      return [];
    }
  }

  // ── Feature flag helpers ────────────────────────────────────
  async isEnabled(guildId, feature) {
    const config = await this.getConfig(guildId);
    if (!config) return false;
    return config[`${feature}_enabled`] === true;
  }

  async getTheme(guildId) {
    const config = await this.getConfig(guildId);
    return config?.server_theme ?? 'dominion';
  }

  async getDisplayName(guildId) {
    const config = await this.getConfig(guildId);
    return config?.display_name ?? 'TheConclave';
  }
}

const guildManager = new GuildManager();
module.exports = guildManager;
