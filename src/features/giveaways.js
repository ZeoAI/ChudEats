const crypto = require('node:crypto');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { config } = require('../config');
const { formatDuration, hasManageGuild, makeId, parseDuration } = require('../utils');
const { COLORS, bannerFiles, communityEmbed } = require('../ui/embeds');

const ENTER_PREFIX = 'giveaway:enter:';
const timers = new Map();

function enterRow(id, disabled = false) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${ENTER_PREFIX}${id}`)
      .setLabel(disabled ? 'Giveaway ended' : 'Enter giveaway')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
  )];
}

function giveawayEmbed(giveaway, guild) {
  const active = giveaway.status === 'active';
  const description = active
    ? [
      'Enter below for a chance to win.',
      '',
      `Ends <t:${Math.floor(giveaway.endsAt / 1000)}:R>.`,
    ].join('\n')
    : [
      'This giveaway is closed.',
      giveaway.winners?.length ? `Winner${giveaway.winners.length === 1 ? '' : 's'}: ${giveaway.winners.map((id) => `<@${id}>`).join(', ')}` : 'No eligible entries.',
    ].join('\n');
  return communityEmbed({
    title: `${active ? 'Giveaway' : 'Giveaway ended'}: ${giveaway.prize}`,
    description,
    color: active ? COLORS.brand : COLORS.neutral,
    footer: `${config.botName} | ${giveaway.id}`,
    timestamp: new Date(giveaway.createdAt),
    guild,
    section: 'Giveaways',
    image: active,
  })
    .addFields(
      { name: 'Hosted by', value: `<@${giveaway.hostId}>`, inline: true },
      { name: 'Entries', value: String(giveaway.entries.length), inline: true },
      { name: 'Winners', value: String(giveaway.winnerCount), inline: true },
      ...(active ? [{ name: 'Requirement', value: giveaway.requiredRoleId ? `<@&${giveaway.requiredRoleId}>` : 'None', inline: true }] : []),
    );
}

function pickWinners(entries, amount, excluded = []) {
  const available = entries.filter((id) => !excluded.includes(id));
  const winners = [];
  while (available.length && winners.length < amount) {
    const index = crypto.randomInt(0, available.length);
    winners.push(available.splice(index, 1)[0]);
  }
  return winners;
}

async function fetchGiveawayMessage(client, giveaway) {
  const guild = client.guilds.cache.get(giveaway.guildId) || await client.guilds.fetch(giveaway.guildId).catch(() => null);
  if (!guild) return { guild: null, channel: null, message: null };
  const channel = await guild.channels.fetch(giveaway.channelId).catch(() => null);
  const message = channel?.isTextBased() ? await channel.messages.fetch(giveaway.messageId).catch(() => null) : null;
  return { guild, channel, message };
}

async function finishGiveaway(client, store, giveawayId) {
  const giveaway = store.state.giveaways[giveawayId];
  if (!giveaway || giveaway.status !== 'active') return { ok: false, reason: 'That giveaway is already finished or does not exist.' };
  giveaway.status = 'ended';
  giveaway.endedAt = Date.now();
  giveaway.winners = pickWinners(giveaway.entries, giveaway.winnerCount);
  store.save();

  const { channel, message, guild } = await fetchGiveawayMessage(client, giveaway);
  if (message) await message.edit({ embeds: [giveawayEmbed(giveaway, guild)], components: enterRow(giveaway.id, true), files: bannerFiles() }).catch(() => null);
  if (channel?.isTextBased()) {
    const content = giveaway.winners.length
      ? `Congratulations ${giveaway.winners.map((id) => `<@${id}>`).join(', ')}. You won **${giveaway.prize}**!`
      : `No eligible entries were received for **${giveaway.prize}**.`;
    await channel.send({
      embeds: [communityEmbed({
        title: giveaway.winners.length ? 'Giveaway winner' : 'Giveaway closed',
        description: content,
        color: giveaway.winners.length ? COLORS.success : COLORS.neutral,
        footer: `${config.botName} | ${giveaway.id}`,
        guild,
        section: 'Giveaways',
      })],
      allowedMentions: { users: giveaway.winners },
    }).catch(() => null);
  }
  timers.delete(giveawayId);
  return { ok: true, reason: giveaway.winners.length ? `Giveaway ended. Winner${giveaway.winners.length === 1 ? '' : 's'}: ${giveaway.winners.map((id) => `<@${id}>`).join(', ')}` : 'Giveaway ended with no eligible entries.' };
}

function scheduleGiveaway(client, store, giveawayId) {
  const giveaway = store.state.giveaways[giveawayId];
  if (!giveaway || giveaway.status !== 'active') return;
  if (timers.has(giveawayId)) clearTimeout(timers.get(giveawayId));
  const delay = giveaway.endsAt - Date.now();
  if (delay <= 0) {
    finishGiveaway(client, store, giveawayId).catch((error) => console.error('[giveaway] finish failed', error));
    return;
  }
  const maxDelay = 2_000_000_000;
  timers.set(giveawayId, setTimeout(() => {
    timers.delete(giveawayId);
    scheduleGiveaway(client, store, giveawayId);
  }, Math.min(delay, maxDelay)));
}

async function start(interaction, store, client) {
  if (!hasManageGuild(interaction)) return interaction.reply({ content: 'You need Manage Server to start a giveaway.', ephemeral: true });
  const duration = parseDuration(interaction.options.getString('duration', true));
  if (!duration) return interaction.reply({ content: 'Use a duration between 10 seconds and 30 days, such as `30m`, `2h`, or `3d`.', ephemeral: true });
  const channel = interaction.options.getChannel('channel') || interaction.channel;
  if (!channel?.isTextBased()) return interaction.reply({ content: 'That channel cannot host a giveaway.', ephemeral: true });
  const prize = interaction.options.getString('prize', true).trim();
  const winnerCount = interaction.options.getInteger('winners', true);
  const requiredRole = interaction.options.getRole('required_role');
  const giveaway = {
    id: `GW-${makeId().toUpperCase()}`,
    guildId: interaction.guildId,
    channelId: channel.id,
    messageId: null,
    hostId: interaction.user.id,
    prize,
    winnerCount,
    requiredRoleId: requiredRole?.id || null,
    entries: [],
    winners: [],
    status: 'active',
    createdAt: Date.now(),
    endsAt: Date.now() + duration,
    endedAt: null,
  };
  await interaction.deferReply({ ephemeral: true });
  const message = await channel.send({ embeds: [giveawayEmbed(giveaway, interaction.guild)], components: enterRow(giveaway.id), files: bannerFiles() });
  giveaway.messageId = message.id;
  store.state.giveaways[giveaway.id] = giveaway;
  store.save();
  scheduleGiveaway(client, store, giveaway.id);
  return interaction.editReply({ content: `Giveaway ${giveaway.id} is live in ${channel} for ${formatDuration(duration)}.` });
}

async function end(interaction, store, client) {
  if (!hasManageGuild(interaction)) return interaction.reply({ content: 'You need Manage Server to end a giveaway.', ephemeral: true });
  const id = interaction.options.getString('id', true).toUpperCase();
  const giveaway = store.state.giveaways[id];
  if (!giveaway || giveaway.guildId !== interaction.guildId) {
    return interaction.reply({ content: 'That giveaway is not in this server or does not exist.', ephemeral: true });
  }
  await interaction.deferReply({ ephemeral: true });
  const result = await finishGiveaway(client, store, id);
  return interaction.editReply({ content: result.reason });
}

async function reroll(interaction, store, client) {
  if (!hasManageGuild(interaction)) return interaction.reply({ content: 'You need Manage Server to reroll a giveaway.', ephemeral: true });
  const id = interaction.options.getString('id', true).toUpperCase();
  const giveaway = store.state.giveaways[id];
  if (!giveaway || giveaway.guildId !== interaction.guildId || giveaway.status !== 'ended') return interaction.reply({ content: 'That giveaway is not finished in this server or does not exist.', ephemeral: true });
  const excluded = [...(giveaway.winners || []), ...(giveaway.rerolledWinners || [])];
  const winner = pickWinners(giveaway.entries, 1, excluded)[0];
  if (!winner) return interaction.reply({ content: 'There are no unused eligible entries left to reroll.', ephemeral: true });
  if (!Array.isArray(giveaway.rerolledWinners)) giveaway.rerolledWinners = [];
  giveaway.rerolledWinners.push(winner);
  store.save();
  const { channel } = await fetchGiveawayMessage(client, giveaway);
  if (channel?.isTextBased()) await channel.send({ content: `A reroll for **${giveaway.prize}** selected <@${winner}>.`, allowedMentions: { users: [winner] } });
  return interaction.reply({ content: `Rerolled winner: <@${winner}>`, ephemeral: true });
}

async function list(interaction, store) {
  const active = Object.values(store.state.giveaways).filter((item) => item.guildId === interaction.guildId && item.status === 'active');
  if (!active.length) return interaction.reply({ content: 'There are no active giveaways right now.', ephemeral: true });
  const embed = communityEmbed({
    title: 'Active giveaways',
    footer: `${config.botName} | Giveaways`,
    guild: interaction.guild,
    section: 'Giveaways',
  });
  for (const giveaway of active.slice(0, 25)) {
    embed.addFields({ name: `${giveaway.id} | ${giveaway.prize}`, value: `${giveaway.entries.length} entries | ends <t:${Math.floor(giveaway.endsAt / 1000)}:R> | <#${giveaway.channelId}>` });
  }
  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function enter(interaction, store) {
  const giveawayId = interaction.customId.slice(ENTER_PREFIX.length);
  const giveaway = store.state.giveaways[giveawayId];
  if (!giveaway || giveaway.guildId !== interaction.guildId || giveaway.status !== 'active') return interaction.reply({ content: 'This giveaway has ended.', ephemeral: true });
  if (interaction.user.bot) return interaction.reply({ content: 'Bots cannot enter giveaways.', ephemeral: true });
  if (giveaway.endsAt <= Date.now()) return interaction.reply({ content: 'This giveaway is ending now. Please wait for the winner announcement.', ephemeral: true });
  if (giveaway.requiredRoleId && !interaction.member.roles.cache.has(giveaway.requiredRoleId)) {
    return interaction.reply({ content: `You need <@&${giveaway.requiredRoleId}> to enter this giveaway.`, ephemeral: true });
  }
  if (giveaway.entries.includes(interaction.user.id)) return interaction.reply({ content: 'You are already entered. One entry per member.', ephemeral: true });
  giveaway.entries.push(interaction.user.id);
  store.save();
  const message = await interaction.channel.messages.fetch(giveaway.messageId).catch(() => null);
  if (message) await message.edit({ embeds: [giveawayEmbed(giveaway, interaction.guild)], components: enterRow(giveaway.id), files: bannerFiles() }).catch(() => null);
  return interaction.reply({ content: 'You are in. Good luck.', ephemeral: true });
}

async function handleCommand(interaction, store, client) {
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'start') return start(interaction, store, client);
  if (subcommand === 'end') return end(interaction, store, client);
  if (subcommand === 'reroll') return reroll(interaction, store, client);
  if (subcommand === 'list') return list(interaction, store);
  return null;
}

async function handleComponent(interaction, store) {
  if (!interaction.isButton() || !interaction.customId.startsWith(ENTER_PREFIX)) return null;
  return enter(interaction, store);
}

function restoreTimers(client, store) {
  for (const giveaway of Object.values(store.state.giveaways)) {
    if (giveaway.status === 'active') scheduleGiveaway(client, store, giveaway.id);
  }
}

module.exports = { handleCommand, handleComponent, restoreTimers, finishGiveaway };
