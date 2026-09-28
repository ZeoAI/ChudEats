const {
  SlashCommandBuilder,
  ChannelType,
} = require('discord.js');

function buildCommands() {
  return [
    new SlashCommandBuilder()
      .setName('help')
      .setDescription('Open the Chud Eats command guide'),

    new SlashCommandBuilder()
      .setName('verify')
      .setDescription('Configure and use the member verification gate')
      .addSubcommand((subcommand) => subcommand
        .setName('setup')
        .setDescription('Publish a secure verification panel')
        .addChannelOption((option) => option
          .setName('channel')
          .setDescription('Channel where members will verify')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true))
        .addRoleOption((option) => option
          .setName('role')
          .setDescription('Optional override; defaults to the configured verified role'))
        .addChannelOption((option) => option
          .setName('log_channel')
          .setDescription('Optional private channel for verification logs')
          .addChannelTypes(ChannelType.GuildText))
        .addIntegerOption((option) => option
          .setName('min_account_age')
          .setDescription('Minimum account age in days (0 disables the check)')
          .setMinValue(0)
          .setMaxValue(365)
          .setRequired(false))
        .addBooleanOption((option) => option
          .setName('require_avatar')
          .setDescription('Require a profile avatar before verification')))
      .addSubcommand((subcommand) => subcommand
        .setName('status')
        .setDescription('View the current verification configuration'))
      .addSubcommand((subcommand) => subcommand
        .setName('reset')
        .setDescription('Remove verification from a member')
        .addUserOption((option) => option
          .setName('member')
          .setDescription('Member whose verification should be reset')
          .setRequired(true))),

    new SlashCommandBuilder()
      .setName('ticket')
      .setDescription('Open and manage private support tickets')
      .addSubcommand((subcommand) => subcommand
        .setName('setup')
        .setDescription('Publish the ticket intake panel')
        .addChannelOption((option) => option
          .setName('panel_channel')
          .setDescription('Channel where the panel will be posted')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true))
        .addChannelOption((option) => option
          .setName('category')
          .setDescription('Category that will contain private tickets')
          .addChannelTypes(ChannelType.GuildCategory)
          .setRequired(true))
        .addRoleOption((option) => option
          .setName('staff_role')
          .setDescription('Optional extra staff role; both configured chef roles are included automatically'))
        .addChannelOption((option) => option
          .setName('transcript_channel')
          .setDescription('Optional channel for close transcripts')
          .addChannelTypes(ChannelType.GuildText)))
      .addSubcommand((subcommand) => subcommand
        .setName('close')
        .setDescription('Close the ticket in the current channel'))
      .addSubcommand((subcommand) => subcommand
        .setName('reopen')
        .setDescription('Reopen a closed ticket in the current channel'))
      .addSubcommand((subcommand) => subcommand
        .setName('add')
        .setDescription('Give another member access to this ticket')
        .addUserOption((option) => option
          .setName('member')
          .setDescription('Member to add')
          .setRequired(true))),

    new SlashCommandBuilder()
      .setName('deals')
      .setDescription('Browse the community food and entertainment deal list')
      .addSubcommand((subcommand) => subcommand
        .setName('list')
        .setDescription('Show a deal category')
        .addStringOption((option) => option
          .setName('category')
          .setDescription('Category to browse')
          .addChoices(
            { name: 'Asian and Pan-Asian', value: 'asian' },
            { name: 'Pizza', value: 'pizza' },
            { name: 'Snacks and Drinks', value: 'snacks' },
            { name: 'Fast Food and Quick Eats', value: 'fast-food' },
            { name: 'Movies', value: 'movies' },
          )))
      .addSubcommand((subcommand) => subcommand
        .setName('panel')
        .setDescription('Publish an interactive deals browser')
        .addChannelOption((option) => option
          .setName('channel')
          .setDescription('Channel where the deals browser will be posted')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)))
      .addSubcommand((subcommand) => subcommand
        .setName('add')
        .setDescription('Add a custom store or offer to a category')
        .addStringOption((option) => option
          .setName('category')
          .setDescription('Category for the new item')
          .setRequired(true)
          .addChoices(
            { name: 'Asian and Pan-Asian', value: 'asian' },
            { name: 'Pizza', value: 'pizza' },
            { name: 'Snacks and Drinks', value: 'snacks' },
            { name: 'Fast Food and Quick Eats', value: 'fast-food' },
            { name: 'Movies', value: 'movies' },
          ))
        .addStringOption((option) => option
          .setName('store')
          .setDescription('Store or venue name')
          .setMaxLength(80)
          .setRequired(true))
        .addStringOption((option) => option
          .setName('offer')
          .setDescription('Short description of the deal')
          .setMaxLength(180)
          .setRequired(true))),

    new SlashCommandBuilder()
      .setName('giveaway')
      .setDescription('Run fair, persistent community giveaways')
      .addSubcommand((subcommand) => subcommand
        .setName('start')
        .setDescription('Start a new giveaway')
        .addStringOption((option) => option
          .setName('duration')
          .setDescription('How long it runs, for example 30m, 2h, or 3d')
          .setRequired(true))
        .addStringOption((option) => option
          .setName('prize')
          .setDescription('What the winner receives')
          .setMaxLength(200)
          .setRequired(true))
        .addIntegerOption((option) => option
          .setName('winners')
          .setDescription('Number of winners')
          .setMinValue(1)
          .setMaxValue(20)
          .setRequired(true))
        .addChannelOption((option) => option
          .setName('channel')
          .setDescription('Channel for the giveaway (defaults to this channel)')
          .addChannelTypes(ChannelType.GuildText))
        .addRoleOption((option) => option
          .setName('required_role')
          .setDescription('Optional role required to enter')))
      .addSubcommand((subcommand) => subcommand
        .setName('end')
        .setDescription('End a giveaway immediately')
        .addStringOption((option) => option
          .setName('id')
          .setDescription('Giveaway ID shown on its embed')
          .setRequired(true)))
      .addSubcommand((subcommand) => subcommand
        .setName('reroll')
        .setDescription('Pick a fresh winner for a finished giveaway')
        .addStringOption((option) => option
          .setName('id')
          .setDescription('Giveaway ID shown on its embed')
          .setRequired(true)))
      .addSubcommand((subcommand) => subcommand
        .setName('list')
        .setDescription('List active giveaways')),
  ];
}

module.exports = { buildCommands };
