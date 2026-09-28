const fs = require('node:fs');
const path = require('node:path');
const { ROLE_IDS } = require('../constants/roles');

const DEFAULT_GUILD = {
  verification: {
    enabled: false,
    channelId: null,
    roleId: ROLE_IDS.verified,
    logChannelId: null,
    minAccountAgeDays: 0,
    requireAvatar: false,
  },
  tickets: {
    enabled: false,
    panelChannelId: null,
    categoryId: null,
    staffRoleId: ROLE_IDS.chefs[0],
    staffRoleIds: [...ROLE_IDS.chefs],
    transcriptChannelId: null,
  },
  deals: {
    panelChannelId: null,
    customItems: {},
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeGuild(value) {
  const guild = value && typeof value === 'object' ? value : {};
  const storedTickets = guild.tickets && typeof guild.tickets === 'object' ? guild.tickets : {};
  const storedStaffRoleIds = Array.isArray(storedTickets.staffRoleIds) && storedTickets.staffRoleIds.length
    ? storedTickets.staffRoleIds
    : [storedTickets.staffRoleId, ...DEFAULT_GUILD.tickets.staffRoleIds].filter(Boolean);
  return {
    ...clone(DEFAULT_GUILD),
    ...guild,
    verification: {
      ...clone(DEFAULT_GUILD.verification),
      ...(guild.verification || {}),
      roleId: guild.verification?.roleId || DEFAULT_GUILD.verification.roleId,
    },
    tickets: {
      ...clone(DEFAULT_GUILD.tickets),
      ...(guild.tickets || {}),
      staffRoleId: storedTickets.staffRoleId || DEFAULT_GUILD.tickets.staffRoleId,
      staffRoleIds: [...new Set(storedStaffRoleIds)],
    },
    deals: { ...clone(DEFAULT_GUILD.deals), ...(guild.deals || {}) },
  };
}

class Store {
  constructor(file) {
    this.file = file;
    this.state = {
      version: 1,
      guilds: {},
      tickets: {},
      giveaways: {},
      verificationChallenges: {},
      purchaseCounts: {},
    };
    this.load();
  }

  load() {
    try {
      if (!fs.existsSync(this.file)) return;
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (!parsed || typeof parsed !== 'object') return;
      this.state = {
        ...this.state,
        ...parsed,
        guilds: parsed.guilds && typeof parsed.guilds === 'object' ? parsed.guilds : {},
        tickets: parsed.tickets && typeof parsed.tickets === 'object' ? parsed.tickets : {},
        giveaways: parsed.giveaways && typeof parsed.giveaways === 'object' ? parsed.giveaways : {},
        verificationChallenges: parsed.verificationChallenges && typeof parsed.verificationChallenges === 'object'
          ? parsed.verificationChallenges
          : {},
        purchaseCounts: parsed.purchaseCounts && typeof parsed.purchaseCounts === 'object' ? parsed.purchaseCounts : {},
      };
    } catch (error) {
      throw new Error(`Could not read bot state at ${this.file}: ${error.message}`);
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, `${JSON.stringify(this.state, null, 2)}\n`, 'utf8');
  }

  getGuild(guildId) {
    if (!this.state.guilds[guildId]) this.state.guilds[guildId] = clone(DEFAULT_GUILD);
    this.state.guilds[guildId] = mergeGuild(this.state.guilds[guildId]);
    return this.state.guilds[guildId];
  }

  updateGuild(guildId, patch) {
    const guild = this.getGuild(guildId);
    this.state.guilds[guildId] = mergeGuild({ ...guild, ...patch });
    this.save();
    return this.state.guilds[guildId];
  }

  getOpenTicketForUser(guildId, userId) {
    return Object.values(this.state.tickets).find(
      (ticket) => ticket.guildId === guildId && ticket.userId === userId && ticket.status === 'open',
    );
  }

  getTicketByChannel(channelId) {
    return Object.values(this.state.tickets).find((ticket) => ticket.channelId === channelId);
  }
}

module.exports = { Store, DEFAULT_GUILD };
