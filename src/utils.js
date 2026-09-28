const crypto = require('node:crypto');
const { PermissionFlagsBits } = require('discord.js');

function makeId(prefix = '') {
  return `${prefix}${crypto.randomBytes(5).toString('hex')}`;
}

function safeName(value, fallback = 'member') {
  const cleaned = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return cleaned || fallback;
}

function clip(value, max = 1024) {
  const text = String(value ?? '').trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function parseDuration(value) {
  const match = String(value || '').trim().match(/^(\d+)\s*(s|m|h|d|w)$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 }[unit];
  const milliseconds = amount * multiplier;
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 10_000 || milliseconds > 30 * 86_400_000) return null;
  return milliseconds;
}

function formatDuration(milliseconds) {
  let remaining = Math.max(0, Math.round(milliseconds / 1000));
  const parts = [];
  const units = [['d', 86_400], ['h', 3_600], ['m', 60], ['s', 1]];
  for (const [label, size] of units) {
    if (remaining >= size || (label === 's' && parts.length === 0)) {
      const amount = Math.floor(remaining / size);
      remaining %= size;
      if (amount) parts.push(`${amount}${label}`);
    }
  }
  return parts.join(' ') || '0s';
}

function isStaff(interaction, roleId) {
  if (interaction.guild?.ownerId === interaction.user?.id) return true;
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  const roleIds = Array.isArray(roleId) ? roleId : [roleId];
  return roleIds.some((id) => Boolean(id && interaction.member?.roles?.cache?.has(id)));
}

function hasManageGuild(interaction) {
  return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild));
}

function memberMention(id) {
  return `<@${id}>`;
}

function parseUserId(value) {
  const match = String(value || '').match(/^(?:<@!?)?(\d{15,22})>?$/);
  return match ? match[1] : null;
}

module.exports = {
  makeId,
  safeName,
  clip,
  parseDuration,
  formatDuration,
  isStaff,
  hasManageGuild,
  memberMention,
  parseUserId,
};
