// ============================================================
// src/managers/guildManager.js
// AEGIS v10 — Multi-Guild Config Manager
// ============================================================
// Drop this in src/managers/ and import wherever you need
// guild-specific settings (channels, roles, Nitrado targets).
// Configs are cached in memory and refreshed every 5 minutes.
// ============================================================

const { supabase } = require('../utils/supabaseClient'); // adjust path if needed

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

class GuildManager {
  constructor() {
    this._cache = new Map();   // guildId → { config, fetchedAt }
    this._pending = new Map(); // guildId → Promise (prevents thundering herd)
  }

  // ── Primary method ─────────────────────────────────────────
  // Returns the guild config object, or null if not found.
  async getConfig(guildId) {
    if (!guildId) return null;

    const cached = this._cache.get(guildId);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.config;
    }

    // Deduplicate concurrent fetches for same guild
    if (this._pending.has(guildId)) {
      return this._pending.get(guildId);
    }

    const promise = this._fetchConfig(guildId);
    this._pending.set(guildId, promise);

    try {
      const config = await promise;
      return config;
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
      console.error(`[GuildManager] Fetch error for guild ${guildId}:`, err);
      return null;
    }
  }

  // ── Force refresh a specific guild ─────────────────────────
  async refreshConfig(guildId) {
    this._cache.delete(guildId);
    return this.getConfig(guildId);
  }

  // ── Convenience: update a field in DB + bust cache ─────────
  async updateField(guildId, field, value) {
    const { error } = await supabase
      .from('guild_configs')
      .update({ [field]: value })
      .eq('guild_id', guildId);

    if (error) {
      console.error(`[GuildManager] Update failed for ${guildId}.${field}:`, error);
      return false;
    }

    this._cache.delete(guildId);
    return true;
  }

  // ── Get all guilds (for Nitrado monitor loop) ───────────────
  async getAllConfigs() {
    try {
      const { data, error } = await supabase
        .from('guild_configs')
        .select('*');

      if (error || !data) return [];

      // Refresh cache with fresh data
      for (const config of data) {
        this._cache.set(config.guild_id, { config, fetchedAt: Date.now() });
      }

      return data;
    } catch (err) {
      console.error('[GuildManager] getAllConfigs error:', err);
      return [];
    }
  }

  // ── Feature flag helpers ────────────────────────────────────
  async isEnabled(guildId, feature) {
    const config = await this.getConfig(guildId);
    if (!config) return false;
    return config[`${feature}_enabled`] === true;
  }

  // ── Theme helpers ───────────────────────────────────────────
  async getTheme(guildId) {
    const config = await this.getConfig(guildId);
    return config?.server_theme ?? 'dominion';
  }

  async getDisplayName(guildId) {
    const config = await this.getConfig(guildId);
    return config?.display_name ?? 'TheConclave';
  }
}

// Export as singleton
const guildManager = new GuildManager();
module.exports = guildManager;
