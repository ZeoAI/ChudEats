const crypto = require('node:crypto');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { config } = require('../config');
const { getPurchaseCount, syncBuyerRoles } = require('../services/roles');
const { COLORS, bannerFiles, communityEmbed } = require('../ui/embeds');
const { hasManageGuild, memberMention } = require('../utils');

const IDS = {
  begin: 'verification:begin',
  enter: 'verification:enter',
  codeInput: 'verification:code',
};

function panelEmbed(guild) {
  return communityEmbed({
    title: 'Member check',
    description: 'Tap **Start verification** to unlock the server. You will receive a short code to enter once.',
    footer: `${config.botName} | Verification`,
    timestamp: false,
    guild,
    section: 'Verification',
    image: true,
  })
    .addFields(
      { name: 'Takes', value: 'About 30 seconds', inline: true },
      { name: 'Afterward', value: 'Your member role is added automatically', inline: true },
    );
}

function panelComponents() {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(IDS.begin)
      .setLabel('Start verification')
      .setStyle(ButtonStyle.Primary),
  )];
}

function challengeEmbed(code, expiresAt, guild) {
  return communityEmbed({
    title: 'Your verification code',
    description: [`Enter this code in the next step:`, '', `**${code}**`].join('\n'),
    color: COLORS.warning,
    footer: `${config.botName} | Codes expire after 10 minutes`,
    guild,
    section: 'Verification',
  })
    .addFields({ name: 'Expires', value: `<t:${Math.floor(expiresAt / 1000)}:R>`, inline: true })
    .addFields({ name: 'Attempts', value: '3', inline: true });
}

function statusEmbed(guild, guildConfig) {
  const verification = guildConfig.verification;
  return communityEmbed({
    title: 'Verification settings',
    color: verification.enabled ? COLORS.success : COLORS.neutral,
    footer: `${guild.name} | Verification`,
    guild,
    section: 'Verification',
  })
    .addFields(
      { name: 'Status', value: verification.enabled ? 'Enabled' : 'Not configured', inline: true },
      { name: 'Panel', value: verification.channelId ? `<#${verification.channelId}>` : 'Not set', inline: true },
      { name: 'Member role', value: verification.roleId ? `<@&${verification.roleId}>` : 'Not set', inline: true },
      { name: 'Account age gate', value: verification.minAccountAgeDays ? `${verification.minAccountAgeDays} days` : 'Disabled', inline: true },
      { name: 'Avatar gate', value: verification.requireAvatar ? 'Required' : 'Disabled', inline: true },
      { name: 'Log channel', value: verification.logChannelId ? `<#${verification.logChannelId}>` : 'Not set', inline: true },
    );
}

async function sendLog(guild, guildConfig, embed) {
  if (!guildConfig.verification.logChannelId) return;
  const channel = await guild.channels.fetch(guildConfig.verification.logChannelId).catch(() => null);
  if (channel?.isTextBased()) await channel.send({ embeds: [embed] }).catch(() => null);
}

async function setup(interaction, store) {
  if (!hasManageGuild(interaction)) {
    return interaction.reply({ content: 'You need Manage Server to configure verification.', ephemeral: true });
  }
  const channel = interaction.options.getChannel('channel', true);
  const selectedRole = interaction.options.getRole('role');
  const role = selectedRole || await interaction.guild.roles.fetch(config.roles.verified).catch(() => null);
  const logChannel = interaction.options.getChannel('log_channel');
  const minAccountAgeDays = interaction.options.getInteger('min_account_age') || 0;
  const requireAvatar = interaction.options.getBoolean('require_avatar') || false;

  if (!role || role.id === interaction.guild.id || role.managed || !role.editable) {
    return interaction.reply({
      content: 'I cannot grant that role. Move my bot role above it, then run setup again.',
      ephemeral: true,
    });
  }

  store.updateGuild(interaction.guildId, {
    verification: {
      ...store.getGuild(interaction.guildId).verification,
      enabled: true,
      channelId: channel.id,
      roleId: role.id,
      logChannelId: logChannel?.id || null,
      minAccountAgeDays,
      requireAvatar,
    },
  });

  const panel = await channel.send({ embeds: [panelEmbed(interaction.guild)], components: panelComponents(), files: bannerFiles() });
  return interaction.reply({
    content: `Verification is live in ${channel}. Panel message: ${panel.url}`,
    ephemeral: true,
  });
}

async function begin(interaction, store) {
  const guildConfig = store.getGuild(interaction.guildId);
  const verification = guildConfig.verification;
  if (!verification.enabled || !verification.roleId) {
    return interaction.reply({ content: 'Verification has not been configured by the server team yet.', ephemeral: true });
  }
  if (interaction.member.roles.cache.has(verification.roleId)) {
    return interaction.reply({ content: 'You are already verified.', ephemeral: true });
  }
  const accountAgeDays = (Date.now() - interaction.user.createdTimestamp) / 86_400_000;
  if (verification.minAccountAgeDays && accountAgeDays < verification.minAccountAgeDays) {
    return interaction.reply({
      content: `Your Discord account must be at least ${verification.minAccountAgeDays} days old to verify.`,
      ephemeral: true,
    });
  }
  if (verification.requireAvatar && !interaction.user.avatar) {
    return interaction.reply({ content: 'A profile avatar is required before you can verify here.', ephemeral: true });
  }

  const code = crypto.randomBytes(3).toString('hex').toUpperCase();
  const expiresAt = Date.now() + 10 * 60_000;
  store.state.verificationChallenges[`${interaction.guildId}:${interaction.user.id}`] = {
    code,
    expiresAt,
    attempts: 0,
  };
  store.save();

  return interaction.reply({
    embeds: [challengeEmbed(code, expiresAt, interaction.guild)],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(IDS.enter)
        .setLabel('Enter code')
        .setStyle(ButtonStyle.Success),
    )],
    ephemeral: true,
  });
}

async function showCodeModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('verification:submit')
    .setTitle('Complete verification')
    .addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId(IDS.codeInput)
        .setLabel('Verification code')
        .setPlaceholder('Enter the 6-character code')
        .setMinLength(6)
        .setMaxLength(6)
        .setRequired(true)
        .setStyle(TextInputStyle.Short),
    ));
  return interaction.showModal(modal);
}

async function submit(interaction, store) {
  const key = `${interaction.guildId}:${interaction.user.id}`;
  const challenge = store.state.verificationChallenges[key];
  if (!challenge || challenge.expiresAt < Date.now()) {
    delete store.state.verificationChallenges[key];
    store.save();
    return interaction.reply({ content: 'That verification check expired. Start a new one from the panel.', ephemeral: true });
  }
  const answer = interaction.fields.getTextInputValue(IDS.codeInput).trim().toUpperCase();
  if (answer !== challenge.code) {
    challenge.attempts += 1;
    const remaining = Math.max(0, 3 - challenge.attempts);
    if (remaining === 0) delete store.state.verificationChallenges[key];
    store.save();
    return interaction.reply({
      content: remaining ? `That code is not correct. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` : 'Too many incorrect attempts. Start a new check.',
      ephemeral: true,
    });
  }

  const guildConfig = store.getGuild(interaction.guildId);
  const role = await interaction.guild.roles.fetch(guildConfig.verification.roleId).catch(() => null);
  if (!role || !role.editable) {
    return interaction.reply({ content: 'The verification role is unavailable or higher than my bot role. Contact a moderator.', ephemeral: true });
  }
  await interaction.member.roles.add(role, 'Completed community verification');
  const purchaseCount = getPurchaseCount(store, interaction.guildId, interaction.user.id);
  await syncBuyerRoles(interaction.member, purchaseCount).catch((error) => {
    console.error('[roles] could not sync buyer roles after verification', error.message);
  });
  delete store.state.verificationChallenges[key];
  store.save();

  await interaction.reply({ content: 'You are verified. Welcome to the community.', ephemeral: true });
  await sendLog(interaction.guild, guildConfig, communityEmbed({
    title: 'Member verified',
    description: `${memberMention(interaction.user.id)} completed the member check.`,
    color: COLORS.success,
    footer: `${config.botName} | Verification log`,
    guild: interaction.guild,
    section: 'Verification',
  })
    .addFields(
      { name: 'Account created', value: `<t:${Math.floor(interaction.user.createdTimestamp / 1000)}:R>`, inline: true },
      { name: 'Member', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
      { name: 'Recorded purchases', value: String(purchaseCount), inline: true },
    ));
}

async function reset(interaction, store) {
  if (!hasManageGuild(interaction)) {
    return interaction.reply({ content: 'You need Manage Server to reset verification.', ephemeral: true });
  }
  const target = interaction.options.getMember('member');
  const guildConfig = store.getGuild(interaction.guildId);
  if (!target) return interaction.reply({ content: 'That member is no longer in this server.', ephemeral: true });
  if (guildConfig.verification.roleId && target.roles.cache.has(guildConfig.verification.roleId)) {
    await target.roles.remove(guildConfig.verification.roleId, `Verification reset by ${interaction.user.tag}`);
  }
  delete store.state.verificationChallenges[`${interaction.guildId}:${target.id}`];
  store.save();
  return interaction.reply({ content: `Verification reset for ${target.user.tag}.`, ephemeral: true });
}

async function handleCommand(interaction, store) {
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'setup') return setup(interaction, store);
  if (subcommand === 'status') return interaction.reply({ embeds: [statusEmbed(interaction.guild, store.getGuild(interaction.guildId))], ephemeral: true });
  if (subcommand === 'reset') return reset(interaction, store);
  return null;
}

async function handleComponent(interaction, store) {
  if (interaction.isButton() && interaction.customId === IDS.begin) return begin(interaction, store);
  if (interaction.isButton() && interaction.customId === IDS.enter) return showCodeModal(interaction);
  if (interaction.isModalSubmit() && interaction.customId === 'verification:submit') return submit(interaction, store);
  return null;
}

module.exports = { handleCommand, handleComponent, IDS };
