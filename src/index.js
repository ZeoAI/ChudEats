const {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
} = require('discord.js');
const { config, assertRuntimeConfig } = require('./config');
const { buildCommands } = require('./commands');
const { Store } = require('./services/store');
const verification = require('./features/verification');
const tickets = require('./features/tickets');
const deals = require('./features/deals');
const giveaways = require('./features/giveaways');
const help = require('./features/help');

const store = new Store(config.dataFile);
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages],
});

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(config.token);
  const body = buildCommands().map((command) => command.toJSON());
  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);
  await rest.put(route, { body });
  console.log(`[commands] registered ${body.length} slash commands${config.guildId ? ` in ${config.guildId}` : ''}`);
}

async function dispatchCommand(interaction) {
  switch (interaction.commandName) {
    case 'help': return help.handleCommand(interaction);
    case 'verify': return verification.handleCommand(interaction, store);
    case 'ticket': return tickets.handleCommand(interaction, store);
    case 'deals': return deals.handleCommand(interaction, store);
    case 'giveaway': return giveaways.handleCommand(interaction, store, client);
    default: return null;
  }
}

async function dispatchComponent(interaction) {
  if (interaction.isModalSubmit()) {
    const verificationResult = await verification.handleComponent(interaction, store);
    if (verificationResult) return verificationResult;
    const ticketFormResult = await tickets.handleComponent(interaction, store);
    if (ticketFormResult) return ticketFormResult;
    const ticketResult = await tickets.handleModal(interaction, store);
    if (ticketResult) return ticketResult;
    return null;
  }
  const results = [
    () => verification.handleComponent(interaction, store),
    () => tickets.handleComponent(interaction, store),
    () => deals.handleComponent(interaction, store),
    () => giveaways.handleComponent(interaction, store),
  ];
  for (const handle of results) {
    const result = await handle();
    if (result) return result;
  }
  return null;
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`[ready] ${readyClient.user.tag}`);
  try {
    await registerCommands();
  } catch (error) {
    console.error('[commands] registration failed', error);
  }
  giveaways.restoreTimers(client, store);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) await dispatchCommand(interaction);
    else if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) await dispatchComponent(interaction);
  } catch (error) {
    console.error('[interaction] failed', error);
    const payload = { content: 'Something went wrong while handling that action. Please try again or open a support ticket.', ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null);
    else await interaction.reply(payload).catch(() => null);
  }
});

client.on('error', (error) => console.error('[discord] client error', error));
process.on('unhandledRejection', (error) => console.error('[process] unhandled rejection', error));

async function main() {
  assertRuntimeConfig();
  await client.login(config.token);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[startup] failed', error.message);
    process.exitCode = 1;
  });
}

module.exports = { client, store, buildCommands };
