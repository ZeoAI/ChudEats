const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ModalBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { config } = require('../config');
const { recordPurchase, syncBuyerRoles } = require('../services/roles');
const { COLORS, bannerFiles, communityEmbed } = require('../ui/embeds');
const {
  clip,
  hasManageGuild,
  isStaff,
  makeId,
  parseUserId,
  safeName,
} = require('../utils');

const IDS = {
  category: 'ticket:category',
  formPrefix: 'ticket:form:',
  claimPrefix: 'ticket:claim:',
  addPrefix: 'ticket:add:',
  closePrefix: 'ticket:close:',
  closeConfirmPrefix: 'ticket:close-confirm:',
  closeCancelPrefix: 'ticket:close-cancel:',
  reopenPrefix: 'ticket:reopen:',
  addSubmitPrefix: 'ticket:add-submit:',
};

const CATEGORY_OPTIONS = [
  { value: 'order', label: 'Food order', description: 'Place an order or ask about a deal' },
  { value: 'billing', label: 'Billing and payment', description: 'Payment, balance, or refund questions' },
  { value: 'support', label: 'Account support', description: 'Help with your account or access' },
  { value: 'other', label: 'Something else', description: 'Anything that does not fit above' },
];

function categoryLabel(id) {
  return CATEGORY_OPTIONS.find((item) => item.value === id)?.label || 'General support';
}

function ticketPanelEmbed(guild) {
  return communityEmbed({
    title: 'Support desk',
    description: 'Choose a category below and fill out the short form. Your ticket opens in a private channel for you and the chefs.',
    footer: `${config.botName} | Support`,
    timestamp: false,
    guild,
    section: 'Support',
    image: true,
  })
    .addFields(
      { name: 'For orders', value: 'Include the store and exact total.', inline: true },
      { name: 'Keep private', value: 'Never send passwords or full card details.', inline: true },
    );
}

function ticketPanelComponents() {
  return [new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(IDS.category)
      .setPlaceholder('Choose a ticket category')
      .addOptions(CATEGORY_OPTIONS),
  )];
}

function ticketForm(category) {
  const modal = new ModalBuilder()
    .setCustomId(`${IDS.formPrefix}${category}`)
    .setTitle(`${categoryLabel(category)} ticket`)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('ticket:store')
          .setLabel('Store or service')
          .setPlaceholder('Example: Panda Express, Harkins, or account support')
          .setMaxLength(80)
          .setRequired(true)
          .setStyle(TextInputStyle.Short),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('ticket:price')
          .setLabel('Order price or amount')
          .setPlaceholder('Example: $24.50, or N/A if this is not an order')
          .setMaxLength(40)
          .setRequired(true)
          .setStyle(TextInputStyle.Short),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('ticket:details')
          .setLabel('What do you need help with?')
          .setPlaceholder('Include the order, issue, and the outcome you want.')
          .setMaxLength(1000)
          .setRequired(true)
          .setStyle(TextInputStyle.Paragraph),
      ),
    );
  return modal;
}

function ticketEmbed(ticket, guild) {
  return communityEmbed({
    title: `Ticket ${ticket.id}`,
    description: `${categoryLabel(ticket.category)}. A chef will pick this up shortly.`,
    footer: `${guild.name} | Keep passwords and full payment details out of Discord`,
    timestamp: new Date(ticket.createdAt),
    guild,
    section: 'Support',
  })
    .addFields(
      { name: 'Requester', value: `<@${ticket.userId}>`, inline: true },
      { name: 'Store or service', value: clip(ticket.store, 200), inline: true },
      { name: 'Price or amount', value: clip(ticket.price, 80), inline: true },
      { name: 'Details', value: clip(ticket.details, 1024), inline: false },
      { name: 'Claimed by', value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'Waiting for a staff member', inline: true },
    );
}

function openControls(ticketId) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${IDS.claimPrefix}${ticketId}`).setLabel('Claim ticket').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`${IDS.addPrefix}${ticketId}`).setLabel('Add member').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${IDS.closePrefix}${ticketId}`).setLabel('Close ticket').setStyle(ButtonStyle.Danger),
  )];
}

function closedControls(ticketId) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${IDS.reopenPrefix}${ticketId}`).setLabel('Reopen ticket').setStyle(ButtonStyle.Secondary),
  )];
}

function findTicket(store, ticketId) {
  return store.state.tickets[ticketId] || null;
}

function canManageTicket(interaction, guildConfig) {
  return isStaff(interaction, guildConfig.tickets.staffRoleIds || guildConfig.tickets.staffRoleId) || hasManageGuild(interaction);
}

async function setup(interaction, store) {
  if (!hasManageGuild(interaction)) {
    return interaction.reply({ content: 'You need Manage Server to configure tickets.', ephemeral: true });
  }
  const panelChannel = interaction.options.getChannel('panel_channel', true);
  const category = interaction.options.getChannel('category', true);
  const selectedStaffRole = interaction.options.getRole('staff_role');
  const transcriptChannel = interaction.options.getChannel('transcript_channel');
  if (selectedStaffRole && (selectedStaffRole.id === interaction.guild.id || selectedStaffRole.managed)) {
    return interaction.reply({ content: 'Choose a normal staff role. The @everyone and integration-managed roles cannot secure tickets.', ephemeral: true });
  }
  const configuredStaffRoleIds = [...new Set([
    ...config.roles.chefs,
    ...(selectedStaffRole ? [selectedStaffRole.id] : []),
  ])];
  const staffRoles = (await Promise.all(configuredStaffRoleIds.map((id) => interaction.guild.roles.fetch(id).catch(() => null))))
    .filter((role) => role && !role.managed);
  if (!staffRoles.length) {
    return interaction.reply({ content: 'I could not find either configured chef role in this server. Check the role IDs and run setup again.', ephemeral: true });
  }
  const staffRoleIds = staffRoles.map((role) => role.id);
  store.updateGuild(interaction.guildId, {
    tickets: {
      ...store.getGuild(interaction.guildId).tickets,
      enabled: true,
      panelChannelId: panelChannel.id,
      categoryId: category.id,
      staffRoleId: staffRoleIds[0],
      staffRoleIds,
      transcriptChannelId: transcriptChannel?.id || null,
    },
  });

  const panel = await panelChannel.send({ embeds: [ticketPanelEmbed(interaction.guild)], components: ticketPanelComponents(), files: bannerFiles() });
  return interaction.reply({ content: `Ticket intake is live in ${panelChannel}. Panel message: ${panel.url}`, ephemeral: true });
}

async function chooseCategory(interaction, store) {
  const guildConfig = store.getGuild(interaction.guildId);
  if (!guildConfig.tickets.enabled) {
    return interaction.reply({ content: 'Tickets have not been configured by the server team yet.', ephemeral: true });
  }
  const existing = store.getOpenTicketForUser(interaction.guildId, interaction.user.id);
  if (existing) {
    const existingChannel = await interaction.guild.channels.fetch(existing.channelId).catch(() => null);
    if (!existingChannel) {
      existing.status = 'closed';
      existing.closedAt = Date.now();
      existing.closedBy = interaction.client.user.id;
      store.save();
    } else {
      return interaction.reply({ content: `You already have an open ticket: <#${existing.channelId}>`, ephemeral: true });
    }
  }
  const category = interaction.values[0];
  return interaction.showModal(ticketForm(category));
}

async function createTicket(interaction, store, category) {
  await interaction.deferReply({ ephemeral: true });
  const guildConfig = store.getGuild(interaction.guildId);
  if (!guildConfig.tickets.enabled) return interaction.editReply({ content: 'Tickets are not configured yet.' });
  const existing = store.getOpenTicketForUser(interaction.guildId, interaction.user.id);
  if (existing) return interaction.editReply({ content: `You already have an open ticket: <#${existing.channelId}>` });

  const parent = await interaction.guild.channels.fetch(guildConfig.tickets.categoryId).catch(() => null);
  const staffRoleIds = guildConfig.tickets.staffRoleIds || [guildConfig.tickets.staffRoleId];
  const staffRoles = (await Promise.all(staffRoleIds.map((id) => interaction.guild.roles.fetch(id).catch(() => null))))
    .filter((role) => role && !role.managed);
  if (!parent || parent.type !== ChannelType.GuildCategory || !staffRoles.length) {
    return interaction.editReply({ content: 'The ticket category or staff role is missing. Ask an administrator to run `/ticket setup` again.' });
  }

  const values = {
    store: interaction.fields.getTextInputValue('ticket:store').trim(),
    price: interaction.fields.getTextInputValue('ticket:price').trim(),
    details: interaction.fields.getTextInputValue('ticket:details').trim(),
  };
  const price = values.price.replace(/\s+/g, ' ');
  if (!/^(?:n\/?a|not applicable|\$?\d{1,6}(?:,\d{3})*(?:\.\d{1,2})?)$/i.test(price)) {
    return interaction.editReply({ content: 'Enter a price such as `$24.50`, or `N/A` if this is not an order.' });
  }
  values.price = price;
  const id = `TKT-${makeId().toUpperCase()}`;
  const channel = await interaction.guild.channels.create({
    name: `ticket-${safeName(interaction.user.username)}-${id.slice(-5).toLowerCase()}`,
    type: ChannelType.GuildText,
    parent: parent.id,
    topic: `${categoryLabel(category)} | ${id} | ${interaction.user.tag}`,
    permissionOverwrites: [
      { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: interaction.user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles],
      },
      ...staffRoles.map((role) => ({
        id: role.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles],
      })),
    ],
    reason: `Support ticket ${id} opened by ${interaction.user.tag}`,
  });

  const ticket = {
    id,
    guildId: interaction.guildId,
    channelId: channel.id,
    userId: interaction.user.id,
    category,
    ...values,
    status: 'open',
    claimedBy: null,
    createdAt: Date.now(),
    closedAt: null,
    closedBy: null,
  };
  store.state.tickets[id] = ticket;
  store.save();

  await channel.send({
    content: `<@${interaction.user.id}> ${staffRoles.map((role) => `<@&${role.id}>`).join(' ')}`,
    embeds: [ticketEmbed(ticket, interaction.guild)],
    components: openControls(id),
    allowedMentions: { users: [interaction.user.id], roles: staffRoles.map((role) => role.id) },
  });
  return interaction.editReply({ content: `Your private ticket is ready: ${channel}` });
}

async function addMember(interaction, store, ticket, member) {
  const guildConfig = store.getGuild(interaction.guildId);
  if (!canManageTicket(interaction, guildConfig)) {
    return interaction.reply({ content: 'Only the support team can add members to a ticket.', ephemeral: true });
  }
  if (!member) return interaction.reply({ content: 'That member is not in this server.', ephemeral: true });
  const channel = await interaction.guild.channels.fetch(ticket.channelId).catch(() => null);
  if (!channel) return interaction.reply({ content: 'The ticket channel no longer exists.', ephemeral: true });
  await channel.permissionOverwrites.edit(member.id, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
    AttachFiles: true,
  }, { reason: `Added to ${ticket.id} by ${interaction.user.tag}` });
  await channel.send({ content: `<@${member.id}> was added to this ticket by <@${interaction.user.id}>.`, allowedMentions: { users: [member.id, interaction.user.id] } });
  return interaction.reply({ content: `${member.user.tag} can now access this ticket.`, ephemeral: true });
}

async function showAddModal(interaction, ticket, store) {
  const guildConfig = store.getGuild(interaction.guildId);
  if (!canManageTicket(interaction, guildConfig)) {
    return interaction.reply({ content: 'Only the support team can add members to a ticket.', ephemeral: true });
  }
  const modal = new ModalBuilder()
    .setCustomId(`${IDS.addSubmitPrefix}${ticket.id}`)
    .setTitle('Add a member to this ticket')
    .addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('ticket:add-member')
        .setLabel('User ID or @mention')
        .setPlaceholder('Paste a Discord user ID or mention')
        .setMinLength(2)
        .setMaxLength(30)
        .setRequired(true)
        .setStyle(TextInputStyle.Short),
    ));
  return interaction.showModal(modal);
}

async function buildTranscript(channel, ticket) {
  const messages = [];
  let before;
  for (let page = 0; page < 5; page += 1) {
    const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
    if (!batch?.size) break;
    messages.push(...batch.values());
    if (batch.size < 100) break;
    before = batch.last().id;
  }
  messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const lines = [
    `${ticket.id} transcript`,
    `Guild: ${channel.guild.name} (${channel.guild.id})`,
    `Requester: ${ticket.userId}`,
    `Created: ${new Date(ticket.createdAt).toISOString()}`,
    '',
  ];
  for (const message of messages) {
    const attachments = [...message.attachments.values()].map((item) => item.url).join(' ');
    lines.push(`[${new Date(message.createdTimestamp).toISOString()}] ${message.author.tag}: ${message.content || ''}${attachments ? ` ${attachments}` : ''}`.trim());
  }
  return lines.join('\n');
}

async function recordCompletedOrder(interaction, store, ticket) {
  if (ticket.category !== 'order') return null;
  const purchaseCount = recordPurchase(store, interaction.guildId, ticket.userId);
  const member = await interaction.guild.members.fetch(ticket.userId).catch(() => null);
  if (member) {
    await syncBuyerRoles(member, purchaseCount).catch((error) => {
      console.error('[roles] could not sync buyer roles after purchase', error.message);
    });
  }
  return purchaseCount;
}

async function closeRecord(interaction, store, ticket) {
  if (!ticket || ticket.status !== 'open') return { ok: false, reason: 'This ticket is already closed.' };
  const guildConfig = store.getGuild(interaction.guildId);
  const allowed = ticket.userId === interaction.user.id || canManageTicket(interaction, guildConfig);
  if (!allowed) return { ok: false, reason: 'Only the requester or support team can close this ticket.' };
  const channel = await interaction.guild.channels.fetch(ticket.channelId).catch(() => null);
  if (!channel) {
    ticket.status = 'closed';
    ticket.closedAt = Date.now();
    ticket.closedBy = interaction.user.id;
    store.save();
    const purchaseCount = await recordCompletedOrder(interaction, store, ticket);
    return {
      ok: true,
      reason: purchaseCount ? `The channel was already deleted; ticket record closed. Purchase #${purchaseCount} recorded.` : 'The channel was already deleted; ticket record closed.',
    };
  }

  const transcript = await buildTranscript(channel, ticket);
  ticket.status = 'closed';
  ticket.closedAt = Date.now();
  ticket.closedBy = interaction.user.id;
  store.save();
  const purchaseCount = await recordCompletedOrder(interaction, store, ticket);

  await channel.permissionOverwrites.edit(ticket.userId, { SendMessages: false }, { reason: `Ticket ${ticket.id} closed` }).catch(() => null);
  await channel.setName(`closed-${safeName(ticket.id.toLowerCase())}`).catch(() => null);
  await channel.send({
    embeds: [communityEmbed({
      title: 'Ticket closed',
      description: `Closed by <@${interaction.user.id}>. The channel is read-only for the requester now.`,
      color: COLORS.neutral,
      footer: `${config.botName} | Staff can reopen this ticket`,
      guild: interaction.guild,
      section: 'Support',
    })],
    components: closedControls(ticket.id),
    allowedMentions: { users: [interaction.user.id] },
  });

  if (guildConfig.tickets.transcriptChannelId) {
    const transcriptChannel = await interaction.guild.channels.fetch(guildConfig.tickets.transcriptChannelId).catch(() => null);
    if (transcriptChannel?.isTextBased()) {
      await transcriptChannel.send({
        content: `Transcript for **${ticket.id}** | requester <@${ticket.userId}> | closed by <@${interaction.user.id}>`,
        files: [new AttachmentBuilder(Buffer.from(transcript, 'utf8'), { name: `${ticket.id.toLowerCase()}-transcript.txt` })],
        allowedMentions: { users: [ticket.userId, interaction.user.id] },
      }).catch(() => null);
    }
  }
  return {
    ok: true,
    reason: purchaseCount ? `Ticket closed and transcript saved. Purchase #${purchaseCount} recorded.` : 'Ticket closed and transcript saved.',
  };
}

async function reopenRecord(interaction, store, ticket) {
  if (!ticket || ticket.status !== 'closed') return { ok: false, reason: 'This ticket is not closed.' };
  const guildConfig = store.getGuild(interaction.guildId);
  if (!canManageTicket(interaction, guildConfig)) return { ok: false, reason: 'Only the support team can reopen tickets.' };
  const channel = await interaction.guild.channels.fetch(ticket.channelId).catch(() => null);
  if (!channel) return { ok: false, reason: 'The ticket channel no longer exists.' };
  await channel.permissionOverwrites.edit(ticket.userId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }, { reason: `Ticket ${ticket.id} reopened` });
  await channel.setName(`ticket-${safeName(ticket.id.toLowerCase())}`).catch(() => null);
  ticket.status = 'open';
  ticket.closedAt = null;
  ticket.closedBy = null;
  store.save();
  await channel.send({ content: `Ticket reopened by <@${interaction.user.id}>.`, allowedMentions: { users: [interaction.user.id] } });
  return { ok: true, reason: 'Ticket reopened.' };
}

async function handleCommand(interaction, store) {
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'setup') return setup(interaction, store);
  const ticket = store.getTicketByChannel(interaction.channelId);
  if (!ticket || ticket.guildId !== interaction.guildId) return interaction.reply({ content: 'This channel is not an active ticket.', ephemeral: true });
  if (subcommand === 'add') return addMember(interaction, store, ticket, interaction.options.getMember('member'));
  if (subcommand === 'close') {
    await interaction.deferReply({ ephemeral: true });
    const result = await closeRecord(interaction, store, ticket);
    return interaction.editReply({ content: result.reason });
  }
  if (subcommand === 'reopen') {
    await interaction.deferReply({ ephemeral: true });
    const result = await reopenRecord(interaction, store, ticket);
    return interaction.editReply({ content: result.reason });
  }
  return null;
}

async function handleComponent(interaction, store) {
  if (interaction.isStringSelectMenu() && interaction.customId === IDS.category) return chooseCategory(interaction, store);

  if (interaction.isModalSubmit() && interaction.customId.startsWith(IDS.formPrefix)) {
    const category = interaction.customId.slice(IDS.formPrefix.length);
    return createTicket(interaction, store, category);
  }

  if (!interaction.isButton()) return null;
  const customId = interaction.customId;
  const prefixes = [IDS.claimPrefix, IDS.addPrefix, IDS.closeConfirmPrefix, IDS.closeCancelPrefix, IDS.closePrefix, IDS.reopenPrefix];
  if (!prefixes.some((prefix) => customId.startsWith(prefix))) return null;
  const prefix = prefixes.find((item) => customId.startsWith(item));
  const ticket = findTicket(store, customId.slice(prefix.length));
  if (!ticket || ticket.guildId !== interaction.guildId) return interaction.reply({ content: 'That ticket record is no longer available.', ephemeral: true });

  if (prefix === IDS.claimPrefix) {
    const guildConfig = store.getGuild(interaction.guildId);
    if (!canManageTicket(interaction, guildConfig)) return interaction.reply({ content: 'Only the support team can claim tickets.', ephemeral: true });
    if (ticket.status !== 'open') return interaction.reply({ content: 'Closed tickets cannot be claimed.', ephemeral: true });
    ticket.claimedBy = interaction.user.id;
    store.save();
    await interaction.reply({ content: `You claimed ${ticket.id}.`, ephemeral: true });
    const ticketMessage = await interaction.channel.messages.fetch(interaction.message.id).catch(() => null);
    if (ticketMessage) {
      const embed = ticketEmbed(ticket, interaction.guild);
      await ticketMessage.edit({ embeds: [embed], components: openControls(ticket.id) }).catch(() => null);
    }
    return interaction.channel.send({ content: `<@${interaction.user.id}> is now handling this ticket.`, allowedMentions: { users: [interaction.user.id] } });
  }
  if (prefix === IDS.addPrefix) return showAddModal(interaction, ticket, store);
  if (prefix === IDS.closePrefix) {
    const guildConfig = store.getGuild(interaction.guildId);
    const allowed = ticket.userId === interaction.user.id || canManageTicket(interaction, guildConfig);
    if (!allowed) return interaction.reply({ content: 'Only the requester or support team can close this ticket.', ephemeral: true });
    return interaction.reply({
      content: 'Close this ticket and create a transcript?',
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${IDS.closeConfirmPrefix}${ticket.id}`).setLabel('Confirm close').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`${IDS.closeCancelPrefix}${ticket.id}`).setLabel('Keep open').setStyle(ButtonStyle.Secondary),
      )],
      ephemeral: true,
    });
  }
  if (prefix === IDS.closeCancelPrefix) return interaction.update({ content: 'Ticket kept open.', components: [] });
  if (prefix === IDS.closeConfirmPrefix) {
    await interaction.deferUpdate();
    const result = await closeRecord(interaction, store, ticket);
    return interaction.followUp({ content: result.reason, ephemeral: true });
  }
  if (prefix === IDS.reopenPrefix) {
    await interaction.deferUpdate();
    const result = await reopenRecord(interaction, store, ticket);
    return interaction.followUp({ content: result.reason, ephemeral: true });
  }
  return null;
}

async function handleModal(interaction, store) {
  if (!interaction.isModalSubmit() || !interaction.customId.startsWith(IDS.addSubmitPrefix)) return null;
  const ticket = findTicket(store, interaction.customId.slice(IDS.addSubmitPrefix.length));
  if (!ticket || ticket.guildId !== interaction.guildId) return interaction.reply({ content: 'That ticket record is no longer available.', ephemeral: true });
  const userId = parseUserId(interaction.fields.getTextInputValue('ticket:add-member'));
  if (!userId) return interaction.reply({ content: 'Use a valid Discord user ID or @mention.', ephemeral: true });
  const member = await interaction.guild.members.fetch(userId).catch(() => null);
  return addMember(interaction, store, ticket, member);
}

module.exports = { handleCommand, handleComponent, handleModal, IDS };
