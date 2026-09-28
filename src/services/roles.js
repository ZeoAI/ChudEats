const { ROLE_IDS } = require('../constants/roles');

function purchaseKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

function getPurchaseCount(store, guildId, userId) {
  return Number(store.state.purchaseCounts[purchaseKey(guildId, userId)] || 0);
}

function recordPurchase(store, guildId, userId) {
  const key = purchaseKey(guildId, userId);
  const count = getPurchaseCount(store, guildId, userId) + 1;
  store.state.purchaseCounts[key] = count;
  store.save();
  return count;
}

async function addRoleIfPossible(member, roleId, reason) {
  if (!roleId || member.roles.cache.has(roleId)) return false;
  const role = await member.guild.roles.fetch(roleId).catch(() => null);
  if (!role || role.managed || !role.editable) return false;
  await member.roles.add(role, reason);
  return true;
}

async function syncBuyerRoles(member, purchaseCount) {
  const added = [];
  if (purchaseCount >= 1 && await addRoleIfPossible(member, ROLE_IDS.buyer, 'Completed a purchase')) {
    added.push(ROLE_IDS.buyer);
  }
  if (purchaseCount >= 3 && await addRoleIfPossible(member, ROLE_IDS.repeatBuyer, 'Completed three purchases')) {
    added.push(ROLE_IDS.repeatBuyer);
  }
  return added;
}

module.exports = {
  getPurchaseCount,
  recordPurchase,
  syncBuyerRoles,
};
