const { communityEmbed } = require('../ui/embeds');
const { config } = require('../config');

function helpEmbed(guild) {
  return communityEmbed({
    title: 'Command center',
    description: 'The short list of commands you will actually use.',
    footer: `${config.botName} | Help`,
    timestamp: false,
    guild,
    section: 'Commands',
  })
    .addFields(
      {
        name: 'Members',
        value: [
          '`/deals list` browse the directory',
          '`/giveaway list` see active giveaways',
          'Use the support panel to open a ticket',
        ].join('\n'),
      },
      {
        name: 'Setup',
        value: [
          '`/verify setup` publish the member check',
          '`/ticket setup` publish support intake',
          '`/deals panel` publish the deals board',
          '`/giveaway start` launch a giveaway',
        ].join('\n'),
      },
      {
        name: 'Staff',
        value: [
          '`/verify status` inspect the gate',
          '`/verify reset` reset a member',
          '`/giveaway end` or `/giveaway reroll` manage winners',
          '`/deals add` add a local offer',
        ].join('\n'),
      },
    );
}

async function handleCommand(interaction) {
  return interaction.reply({ embeds: [helpEmbed(interaction.guild)], ephemeral: true });
}

module.exports = { handleCommand };
