const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');
const { config } = require('../config');
const { DEAL_CATEGORIES, getCategory } = require('../data/deals');
const { bannerFiles, communityEmbed } = require('../ui/embeds');
const { clip, hasManageGuild } = require('../utils');

const CATEGORY_SELECT_ID = 'deals:category';

function categoryOptions() {
  return DEAL_CATEGORIES.map((category) => ({
    value: category.id,
    label: category.label,
    description: `${category.items.length} listed spots`,
  }));
}

function panelEmbed(guild) {
  return communityEmbed({
    title: 'Deals board',
    description: 'Pick a category to browse the current restaurant and movie directory.',
    footer: `${config.botName} | Deals change by location`,
    timestamp: false,
    guild,
    section: 'Deals',
    image: true,
  })
    .addFields(
      { name: 'Food', value: 'Asian, pizza, quick eats, snacks, and drinks.', inline: true },
      { name: 'Movies', value: 'Movie offers and seasonal event deals.', inline: true },
    );
}

function panelComponents() {
  return [new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(CATEGORY_SELECT_ID)
      .setPlaceholder('Browse a deal category')
      .addOptions(categoryOptions()),
  )];
}

function categoryEmbed(category, guild) {
  const lines = category.items.map((item) => `- **${clip(item.name, 80)}**: ${clip(item.offer, 160)}`);
  const chunks = [];
  let current = '';
  for (const line of lines) {
    if ((current + line).length > 950) {
      chunks.push(current);
      current = '';
    }
    current += `${current ? '\n' : ''}${line}`;
  }
  if (current) chunks.push(current);
  const embed = communityEmbed({
    title: category.label,
    description: category.description,
    footer: `${config.botName} | Confirm the final price before purchase`,
    guild,
    section: 'Deals directory',
  });
  chunks.forEach((value, index) => embed.addFields({ name: index ? 'More spots' : 'Listed spots', value }));
  return embed;
}

function overviewEmbed(customItems, guild) {
  const embed = communityEmbed({
    title: 'Deals at a glance',
    description: 'Select a category to see the full list.',
    footer: `${config.botName} | Deals change by location`,
    guild,
    section: 'Deals directory',
  });
  for (const base of DEAL_CATEGORIES) {
    const category = getCategory(base.id, customItems);
    const names = category.items.map((item) => item.name).join(', ');
    embed.addFields({ name: category.label, value: clip(names, 1024) });
  }
  return embed;
}

async function list(interaction, store) {
  const guildConfig = store.getGuild(interaction.guildId);
  const categoryId = interaction.options.getString('category');
  const embed = categoryId
    ? categoryEmbed(getCategory(categoryId, guildConfig.deals.customItems), interaction.guild)
    : overviewEmbed(guildConfig.deals.customItems, interaction.guild);
  return interaction.reply({ embeds: [embed] });
}

async function panel(interaction, store) {
  if (!hasManageGuild(interaction)) return interaction.reply({ content: 'You need Manage Server to publish the deals panel.', ephemeral: true });
  const channel = interaction.options.getChannel('channel', true);
  store.updateGuild(interaction.guildId, { deals: { ...store.getGuild(interaction.guildId).deals, panelChannelId: channel.id } });
  const message = await channel.send({ embeds: [panelEmbed(interaction.guild)], components: panelComponents(), files: bannerFiles() });
  return interaction.reply({ content: `Deals browser is live in ${channel}. Panel message: ${message.url}`, ephemeral: true });
}

async function add(interaction, store) {
  if (!hasManageGuild(interaction)) return interaction.reply({ content: 'You need Manage Server to update the deals list.', ephemeral: true });
  const categoryId = interaction.options.getString('category', true);
  const category = getCategory(categoryId, store.getGuild(interaction.guildId).deals.customItems);
  if (!category) return interaction.reply({ content: 'That deal category does not exist.', ephemeral: true });
  const customItems = store.getGuild(interaction.guildId).deals.customItems;
  if (!Array.isArray(customItems[categoryId])) customItems[categoryId] = [];
  customItems[categoryId].push({
    name: interaction.options.getString('store', true).trim(),
    offer: interaction.options.getString('offer', true).trim(),
  });
  store.updateGuild(interaction.guildId, { deals: { ...store.getGuild(interaction.guildId).deals, customItems } });
  return interaction.reply({ content: `Added **${customItems[categoryId].at(-1).name}** to ${category.label}.`, ephemeral: true });
}

async function handleCommand(interaction, store) {
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'list') return list(interaction, store);
  if (subcommand === 'panel') return panel(interaction, store);
  if (subcommand === 'add') return add(interaction, store);
  return null;
}

async function handleComponent(interaction, store) {
  if (!interaction.isStringSelectMenu() || interaction.customId !== CATEGORY_SELECT_ID) return null;
  const guildConfig = store.getGuild(interaction.guildId);
  const category = getCategory(interaction.values[0], guildConfig.deals.customItems);
  if (!category) return interaction.reply({ content: 'That category is no longer available.', ephemeral: true });
  return interaction.reply({ embeds: [categoryEmbed(category, interaction.guild)], ephemeral: true });
}

module.exports = { handleCommand, handleComponent, CATEGORY_SELECT_ID };
