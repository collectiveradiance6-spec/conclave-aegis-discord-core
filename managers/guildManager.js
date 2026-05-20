// ═══════════════════════════════════════════════════════════════════════
// managers/guildManager.js — AEGIS v14 GLOBAL EDITION
// Per-guild config with full game/topic support. Any game, any community.
// Adding a new server = zero code changes. Just run /setup-aegis.
// ═══════════════════════════════════════════════════════════════════════
'use strict';

const { createClient } = require('@supabase/supabase-js');

const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(
  process.env.SUPABASE_URL,
  SB_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${SB_KEY}` } },
  }
);

const CACHE_TTL = 5 * 60 * 1000;

const DEFAULT_CONFIG = {
  // ── Game / Topic ─────────────────────────────────────────────────
  game_name:               null,   // e.g. "ARK: Survival Ascended"
  game_topic:              null,   // e.g. "ARK survival, breeding, bosses"
  community_description:   null,   // Short description of what this community is
  community_rules:         null,   // Rules text (plain or markdown)
  server_rates:            null,   // Rate multipliers, caps, special settings
  custom_features:         null,   // Additional features/mods specific to this server
  staff_roster:            null,   // Staff names and roles
  payment_handle:          null,   // e.g. "$TheConclaveDominion" for CashApp

  // ── Branding ─────────────────────────────────────────────────────
  display_name:            null,
  server_icon_url:         null,
  server_theme:            'dominion',  // dominion | cyber | custom
  bot_prefix:              '/',

  // ── Core channels ─────────────────────────────────────────────────
  aegis_channel_id:         null,
  mod_log_channel_id:       null,
  announcement_channel_id:  null,
  welcome_channel_id:       null,
  ticket_log_channel_id:    null,
  economy_log_channel_id:   null,
  monitor_channel_id:       null,
  transcript_channel_id:    null,

  // ── Ticket category IDs (Discord category folders) ────────────────
  ticket_category_support:    null,
  ticket_category_starterkit: null,
  ticket_category_concoin:    null,
  ticket_category_claveshard: null,
  ticket_category_basewatch:  null,

  // ── Panel post channels ───────────────────────────────────────────
  panel_support_channel_id:    null,
  panel_starterkit_channel_id: null,
  panel_concoin_channel_id:    null,
  panel_claveshard_channel_id: null,
  panel_basewatch_channel_id:  null,

  // ── Ticket log channels ───────────────────────────────────────────
  ticket_log_support:    null,
  ticket_log_starterkit: null,
  ticket_log_concoin:    null,
  ticket_log_claveshard: null,
  ticket_log_basewatch:  null,

  // ── Roles ─────────────────────────────────────────────────────────
  admin_role_id:   null,
  mod_role_id:     null,
  helper_role_id:  null,
  member_role_id:  null,
  vip_role_id:     null,

  // ── Feature flags ─────────────────────────────────────────────────
  economy_enabled:  true,
  trivia_enabled:   true,
  automod_enabled:  true,
  tickets_enabled:  true,
  monitor_enabled:  false,
  ai_enabled:       true,
  giveaway_enabled: true,
  watchtower_enabled: false,

  // ── Server monitor ────────────────────────────────────────────────
  monitor_category_id:    null,
  monitor_alert_channel:  null,
  monitor_status_channel: null,
  monitor_nitrado_key:    null,

  // ── Economy settings ──────────────────────────────────────────────
  currency_name:        'ClaveShard',
  currency_emoji:       '💎',
  weekly_claim_amount:  3,
  trivia_reward_amount: 15000,

  // ── AI settings ───────────────────────────────────────────────────
  ai_persona:           'sovereign',
  ai_model_preference:  'anthropic',

  // ── Transcript / misc ─────────────────────────────────────────────
  transcript_channel:   null,

  // ── Setup ─────────────────────────────────────────────────────────
  setup_complete:  false,
  setup_by:        null,
  setup_at:        null,
  created_at:      null,
  updated_at:      null,
};

class GuildManager {
  constructor() {
    this._cache   = new Map();
    this._pending = new Map();
  }

  async getConfig(guildId) {
    if (!guildId) return null;
    const cached = this._cache.get(guildId);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.config;
    if (this._pending.has(guildId)) return this._pending.get(guildId);
    const p = this._fetchOrCreate(guildId).finally(() => this._pending.delete(guildId));
    this._pending.set(guildId, p);
    return p;
  }

  async _fetchOrCreate(guildId) {
    try {
      const { data, error } = await supabase
        .from('guild_configs')
        .select('*')
        .eq('guild_id', guildId)
        .single();
      if (error?.code === 'PGRST116') return this.provision(guildId, null);
      if (error) throw error;
      const config = { ...DEFAULT_CONFIG, ...data };
      this._cache.set(guildId, { config, fetchedAt: Date.now() });
      return config;
    } catch (err) {
      console.error(`[GuildManager] Fetch error for ${guildId}:`, err.message);
      return { ...DEFAULT_CONFIG, guild_id: guildId };
    }
  }

  async provision(guildId, guildName) {
    try {
      const { data, error } = await supabase
        .from('guild_configs')
        .upsert({
          guild_id:     guildId,
          display_name: guildName || guildId,
          setup_complete: false,
          created_at:   new Date().toISOString(),
          updated_at:   new Date().toISOString(),
          ...DEFAULT_CONFIG,
        }, { onConflict: 'guild_id' })
        .select()
        .maybeSingle();
      if (error) throw error;

      // maybeSingle may return null if row exists — re-fetch
      if (!data) {
        const { data: fetched } = await supabase
          .from('guild_configs').select('*').eq('guild_id', guildId).maybeSingle();
        if (fetched) {
          const config = { ...DEFAULT_CONFIG, ...fetched };
          this._cache.set(guildId, { config, fetchedAt: Date.now() });
          return config;
        }
        return { ...DEFAULT_CONFIG, guild_id: guildId };
      }

      const config = { ...DEFAULT_CONFIG, ...data };
      this._cache.set(guildId, { config, fetchedAt: Date.now() });
      console.log(`[GuildManager] ✅ Provisioned: ${guildId} (${guildName})`);
      return config;
    } catch (err) {
      console.error('[GuildManager] Provision error:', err.message);
      return { ...DEFAULT_CONFIG, guild_id: guildId };
    }
  }

  async saveSetup(guildId, setupData, setupById) {
    return this.update(guildId, {
      ...setupData,
      setup_complete: true,
      setup_by:       setupById,
      setup_at:       new Date().toISOString(),
    });
  }

  async update(guildId, patch) {
    try {
      const { data, error } = await supabase
        .from('guild_configs')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('guild_id', guildId)
        .select()
        .maybeSingle();
      if (error) throw error;
      const config = { ...DEFAULT_CONFIG, ...data };
      this._cache.set(guildId, { config, fetchedAt: Date.now() });
      return config;
    } catch (err) {
      console.error('[GuildManager] Update error:', err.message);
      return null;
    }
  }

  async updateField(guildId, field, value) {
    return this.update(guildId, { [field]: value });
  }

  async refreshConfig(guildId) {
    this._cache.delete(guildId);
    return this.getConfig(guildId);
  }

  async isEnabled(guildId, feature) {
    const c = await this.getConfig(guildId);
    return c?.[`${feature}_enabled`] === true;
  }

  async getChannel(guildId, key) {
    const c = await this.getConfig(guildId);
    return c?.[`${key}_channel_id`] || null;
  }

  async getRole(guildId, key) {
    const c = await this.getConfig(guildId);
    return c?.[`${key}_role_id`] || null;
  }

  async getAllConfigs() {
    try {
      const { data } = await supabase.from('guild_configs').select('*');
      for (const c of (data || [])) {
        this._cache.set(c.guild_id, { config: { ...DEFAULT_CONFIG, ...c }, fetchedAt: Date.now() });
      }
      return data || [];
    } catch { return []; }
  }

  async getStats() {
    try {
      const { data, count } = await supabase.from('guild_configs').select('setup_complete', { count: 'exact' });
      return {
        total:   count || 0,
        setup:   data?.filter(g => g.setup_complete).length || 0,
        pending: data?.filter(g => !g.setup_complete).length || 0,
      };
    } catch { return { total: 0, setup: 0, pending: 0 }; }
  }
}

module.exports = new GuildManager();
