const { REST, Routes } = require('discord.js');
const { config, assertRuntimeConfig } = require('./config');
const { buildCommands } = require('./commands');

async function main() {
  assertRuntimeConfig();
  const rest = new REST({ version: '10' }).setToken(config.token);
  const body = buildCommands().map((command) => command.toJSON());
  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);
  await rest.put(route, { body });
  console.log(`Registered ${body.length} commands ${config.guildId ? `in guild ${config.guildId}` : 'globally'}.`);
}

main().catch((error) => {
  console.error('[deploy] failed', error);
  process.exitCode = 1;
});
