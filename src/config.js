const path = require('node:path');
const dotenv = require('dotenv');
const { ROLE_IDS } = require('./constants/roles');

dotenv.config();

function optionalString(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function parseColor(value, fallback) {
  const normalized = String(optionalString(value, fallback)).replace(/^#/, '');
  return /^[0-9a-f]{6}$/i.test(normalized) ? parseInt(normalized, 16) : fallback;
}

function optionalUrl(value) {
  const candidate = optionalString(value);
  try {
    const url = new URL(candidate);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

const config = {
  token: optionalString(process.env.DISCORD_TOKEN),
  clientId: optionalString(process.env.DISCORD_CLIENT_ID),
  guildId: optionalString(process.env.DISCORD_GUILD_ID),
  dataFile: path.resolve(process.env.DATA_FILE || path.join(process.cwd(), 'data', 'bot.json')),
  botName: optionalString(process.env.BOT_NAME, 'Chud Eats'),
  color: parseColor(process.env.BOT_COLOR, 0xe11d48),
  bannerUrl: optionalUrl(process.env.BRAND_BANNER_URL),
  bannerPath: path.resolve(process.env.BRAND_BANNER_PATH || path.join(process.cwd(), 'assets', 'chud-eats-banner.png')),
  roles: ROLE_IDS,
};

function assertRuntimeConfig() {
  const missing = [];
  if (!config.token) missing.push('DISCORD_TOKEN');
  if (!config.clientId) missing.push('DISCORD_CLIENT_ID');
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

module.exports = { config, assertRuntimeConfig };
