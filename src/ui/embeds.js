const fs = require('node:fs');
const { EmbedBuilder } = require('discord.js');
const { config } = require('../config');

const COLORS = Object.freeze({
  brand: config.color,
  success: 0x16a34a,
  warning: 0xd97706,
  neutral: 0x475569,
  danger: 0xdc2626,
});

function communityEmbed({
  title,
  description,
  color = COLORS.brand,
  footer = config.botName,
  timestamp = true,
  guild,
  section,
  thumbnail = true,
  image = false,
} = {}) {
  const embed = new EmbedBuilder().setColor(color);
  const iconUrl = guild?.iconURL?.({ extension: 'png', size: 64 }) || undefined;
  const authorName = section ? `${config.botName} / ${section}` : config.botName;
  embed.setAuthor({ name: authorName, ...(iconUrl ? { iconURL: iconUrl } : {}) });
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (thumbnail && iconUrl) embed.setThumbnail(iconUrl);
  if (image && config.bannerUrl) embed.setImage(config.bannerUrl);
  if (image && !config.bannerUrl && fs.existsSync(config.bannerPath)) embed.setImage('attachment://chud-eats-banner.png');
  if (footer) embed.setFooter({ text: footer, ...(iconUrl ? { iconURL: iconUrl } : {}) });
  if (timestamp) embed.setTimestamp(timestamp === true ? new Date() : timestamp);
  return embed;
}

function bannerFiles() {
  if (config.bannerUrl || !fs.existsSync(config.bannerPath)) return [];
  return [{ attachment: config.bannerPath, name: 'chud-eats-banner.png' }];
}

module.exports = { COLORS, bannerFiles, communityEmbed };
