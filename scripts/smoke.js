const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildCommands } = require('../src/commands');
const { DEAL_CATEGORIES } = require('../src/data/deals');
const { Store } = require('../src/services/store');
const { ROLE_IDS } = require('../src/constants/roles');
const { recordPurchase, getPurchaseCount } = require('../src/services/roles');
const { bannerFiles, communityEmbed } = require('../src/ui/embeds');
const { config } = require('../src/config');
const { parseDuration } = require('../src/utils');

const commands = buildCommands().map((command) => command.toJSON());
assert.deepEqual(commands.map((command) => command.name), ['help', 'verify', 'ticket', 'deals', 'giveaway']);
assert.ok(commands.every((command) => command.description && command.options));
assert.ok(DEAL_CATEGORIES.every((category) => category.items.length > 0));
assert.equal(ROLE_IDS.verified, '1535613937167638588');
assert.deepEqual(ROLE_IDS.chefs, ['1526743183994650755', '1526743182581170346']);
assert.equal(ROLE_IDS.buyer, '1553672090182230076');
assert.equal(ROLE_IDS.repeatBuyer, '1553669098133651528');
assert.equal(parseDuration('2h'), 7_200_000);
assert.equal(parseDuration('2 seconds'), null);
const brandedEmbed = communityEmbed({
  title: 'Test panel',
  description: 'Test description',
  section: 'Deals',
  guild: { iconURL: () => 'https://cdn.example.test/icon.png' },
  timestamp: false,
});
const brandedJson = brandedEmbed.toJSON();
assert.equal(brandedJson.author.name, `${config.botName} / Deals`);
assert.equal(brandedJson.thumbnail.url, 'https://cdn.example.test/icon.png');
assert.equal(brandedJson.footer.icon_url, 'https://cdn.example.test/icon.png');
const panelEmbed = communityEmbed({ title: 'Panel', section: 'Deals', image: true, timestamp: false });
assert.equal(panelEmbed.toJSON().image.url, config.bannerUrl ? config.bannerUrl : 'attachment://chud-eats-banner.png');
assert.equal(bannerFiles().length, config.bannerUrl ? 0 : 1);

const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rage-labs-')), 'bot.json');
const store = new Store(file);
store.updateGuild('guild', { verification: { enabled: true, roleId: 'role' } });
assert.equal(recordPurchase(store, 'guild', 'member'), 1);
assert.equal(recordPurchase(store, 'guild', 'member'), 2);
assert.equal(getPurchaseCount(store, 'guild', 'member'), 2);
const reloaded = new Store(file);
assert.equal(reloaded.getGuild('guild').verification.roleId, 'role');
fs.rmSync(path.dirname(file), { recursive: true, force: true });

console.log(`Smoke checks passed: ${commands.length} commands, ${DEAL_CATEGORIES.length} deal categories.`);
