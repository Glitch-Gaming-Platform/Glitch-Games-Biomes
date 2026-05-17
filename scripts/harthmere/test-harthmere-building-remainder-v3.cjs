#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = process.argv[2] || process.cwd();
const modulePath = path.join(root, 'src/client/components/challenges/LocalDevHarthmereRemainderSystems.ts');
const source = fs.readFileSync(modulePath, 'utf8');
function loadModule() {
  const names = [];
  const transformed = source
    .replace(/^export const ([A-Za-z0-9_]+) =/gm, (_, name) => { names.push(name); return `const ${name} =`; })
    .replace(/^export function ([A-Za-z0-9_]+)\(/gm, (_, name) => { names.push(name); return `function ${name}(`; });
  const sandbox = { module: { exports: {} }, exports: {}, console, Date, Math, JSON, Number, String, Array, Object, Set, Map };
  vm.runInNewContext(transformed + `\nmodule.exports = { ${Array.from(new Set(names)).join(', ')} };`, sandbox, { filename: modulePath });
  return sandbox.module.exports;
}
const m = loadModule();
let ok = true;
function check(label, condition) {
  if (condition) console.log(`OK ${label}`);
  else { ok = false; console.error(`FAIL ${label}`); }
}

let state = m.createHarthmereRemainderScenarioFixture();
const blueprint = { id: 'small_cottage', maxSlope: 12 };
let placement = m.validateHarthmereDynamicBuildingPlacement({
  plot: state.plots.cottage_plot,
  blueprint,
  placement: { x: 0, z: 0, slope: 3, foundationSupported: true, entranceAccessible: true, pathToEntrance: true },
  playerId: 'alice',
});
check('valid dynamic building placement passes', placement.ok === true);
placement = m.validateHarthmereDynamicBuildingPlacement({
  plot: state.plots.cottage_plot,
  blueprint,
  placement: { x: 99, z: 99, slope: 40, foundationSupported: false, floating: true, blocksRoad: true, entranceAccessible: false, pathToEntrance: false, trapsPlayers: true },
  playerId: 'alice',
});
check('invalid dynamic building placement returns multiple physical blockers', placement.ok === false && placement.evidence.includes('outside_plot_bounds') && placement.evidence.includes('unsupported_foundation') && placement.evidence.includes('blocks_navigation') && placement.evidence.includes('traps_players'));

state = m.createHarthmereRemainderScenarioFixture();
let purchase = m.purchaseHarthmerePlotAtomic(state, { playerId: 'alice', plotId: 'cottage_plot', blueprint, placement: { x: 0, z: 0, slope: 0, foundationSupported: true, entranceAccessible: true, pathToEntrance: true }, transactionId: 'tx_buy_1' });
check('plot purchase locks, charges, assigns owner, and creates deed/property', purchase.ok && state.players.alice.gold === 1750 && state.properties.property_cottage_plot.deedId === 'deed_property_cottage_plot');
let doubleBuy = m.purchaseHarthmerePlotAtomic(state, { playerId: 'bob', plotId: 'cottage_plot', blueprint, placement: { x: 0, z: 0, slope: 0, foundationSupported: true, entranceAccessible: true, pathToEntrance: true }, transactionId: 'tx_buy_2' });
check('double-buy plot race is rejected', doubleBuy.ok === false && doubleBuy.code === 'plot_unavailable');

let lease = m.createHarthmereLeaseRecord(state, { propertyId: 'property_cottage_plot', tenantId: 'bob', rentGold: 50, durationMs: 1000 });
check('rental lease charges rent and creates access record', lease.ok && state.players.bob.gold === 1950);
let leaseWarning = m.advanceHarthmereLeaseLifecycle(state, lease.lease.id, state.now + 500);
check('lease lifecycle sends warning before expiration', leaseWarning.ok && leaseWarning.stage === 'warning');
let leaseExpired = m.advanceHarthmereLeaseLifecycle(state, lease.lease.id, state.now + 2000);
check('lease expiration pauses access without deleting stored items', leaseExpired.ok && leaseExpired.stage === 'expired_paused' && leaseExpired.lease.storedItemsRecoveryRequired);

state.properties.property_cottage_plot.storageItems = ['old_chest'];
let sale = m.listHarthmerePropertyForSale(state, { propertyId: 'property_cottage_plot', sellerId: 'alice', askingGold: 500 });
check('property sale listing uses escrow and tax', sale.ok && sale.listing.escrowed && sale.listing.taxGold > 0);
let saleBuy = m.buyHarthmerePropertySaleAtomic(state, { listingId: sale.listing.id, buyerId: 'bob' });
check('property sale transfers owner atomically', saleBuy.ok && state.properties.property_cottage_plot.ownerId === 'bob');
check('property sale creates storage recovery for old owner', Object.values(state.recovery).some((row) => row.reason === 'sale_transfer' && row.ownerId === 'alice'));

const property = state.properties.property_cottage_plot;
m.setHarthmerePropertyPermissions(property, 'friend', ['enter', 'use_crafting']);
check('granular permission role allows configured action', m.canHarthmerePropertyRoleDo(property, 'friend', 'use_crafting') === true);
check('granular permission role rejects unconfigured action', m.canHarthmerePropertyRoleDo(property, 'friend', 'demolish') === false);
property.doorState = 'friend_only';
check('door/lock system allows friend-only access for friend', m.resolveHarthmereDoorInteraction(property, { role: 'friend' }).ok === true);
check('door/lock system rejects wrong role', m.resolveHarthmereDoorInteraction(property, { role: 'customer' }).ok === false);

check('decoration placement rejects blocked exits', m.placeHarthmereDecoration(property, { id: 'huge_statue', blocksExit: true }).ok === false);
check('decoration placement accepts safe furniture', m.placeHarthmereDecoration(property, { id: 'chair', x: 1, z: 1 }).ok === true);
check('interior entry requires safe spawn/exit and tracks occupant', m.enterHarthmerePropertyInterior(property, 'bob').ok === true && property.interior.occupants.includes('bob'));

property.shopStorage = { iron_sword: 1 };
property.shopOpen = true;
let shopListing = m.createHarthmereShopListingAtomic(state, { propertyId: property.id, sellerId: 'bob', itemId: 'iron_sword', quantity: 1, priceGold: 100 });
check('shop listing escrows item from shop storage', shopListing.ok && property.shopStorage.iron_sword === 0);
let shopPurchase = m.buyHarthmereShopItemAtomic(state, { listingId: shopListing.listing.id, buyerId: 'alice' });
check('shop purchase transfers gold and item, closes listing', shopPurchase.ok && shopListing.listing.status === 'sold' && state.players.alice.inventory.slots.some((slot) => slot.itemId === 'iron_sword'));

let worker = m.assignHarthmereNpcWorker(property, { id: 'builder_npc', laborPerHour: 10, requiresPay: true, payReserved: true });
check('NPC worker assignment requires reserved pay and stores worker', worker.ok && property.workers.length === 1);
let project = { id: 'barn_project', requiredMaterials: { wood_plank: 10 }, materialsContributed: {}, requiredLabor: 20, laborContributed: 0, stage: 'foundation' };
let advanced = m.advanceHarthmereConstructionTimer(project, { workers: property.workers, hours: 2, materials: { wood_plank: 10 }, nextStage: 'frame' });
check('construction timer advances from NPC labor and material contribution', advanced.materialsComplete && advanced.laborComplete && project.stage === 'frame');

property.interior.occupants = ['alice', 'bob'];
let safeDamage = m.applyHarthmereBuildingDamageScenario(property, { damage: 999, damageType: 'player', safeZone: true, siegeAllowed: false });
check('safe-zone building ignores unauthorized player damage', safeDamage.ok && safeDamage.ignored === true);
let damage = m.applyHarthmereBuildingDamageScenario(property, { damage: 2000, damageType: 'siege', siegeAllowed: true });
check('destroyed building disables services and evacuates occupants', damage.ok && property.destroyed && property.servicesEnabled === false && property.evacuation.evacuated.length === 2 && property.interior.occupants.length === 0);

property.condition = 40;
property.hp = 400;
property.maxHp = 1000;
let repair = m.repairHarthmereBuildingPartial(property, { targetCondition: 70, fullRepairDelta: 60, materialsRequired: { wood_plank: 10, iron_nail: 10 }, materialsAvailable: { wood_plank: 10, iron_nail: 10 }, underAttack: false });
check('partial repair consumes proportional materials and refunds overcontribution', repair.ok && property.condition === 70 && repair.consumed.wood_plank === 5 && repair.refunded.wood_plank === 5);
let blockedRepair = m.repairHarthmereBuildingPartial(property, { targetCondition: 100, materialsRequired: { wood_plank: 1 }, materialsAvailable: { wood_plank: 1 }, underAttack: true, combatRepairAllowed: false });
check('combat repair is blocked unless explicitly allowed', blockedRepair.ok === false && blockedRepair.code === 'repair_blocked');
let siegeLock = m.repairHarthmereBuildingPartial(property, { targetCondition: 100, materialsRequired: { wood_plank: 1 }, materialsAvailable: { wood_plank: 1 }, recentSiegeHitAt: 900, now: 1000 });
check('recent siege hit creates repair lockout', siegeLock.ok === false && siegeLock.code === 'repair_lockout');

property.taxesDueAt = state.now - 29 * 24 * 60 * 60 * 1000;
let upkeep = m.advanceHarthmerePropertyUpkeep(state, property.id, state.now);
check('upkeep lifecycle reaches reclaimable stage with services disabled', upkeep.ok && upkeep.stage === 'reclaimable' && property.reclaimable && property.servicesEnabled === false);
property.storageItems = ['bed', 'trophy'];
let reclaim = m.reclaimHarthmerePropertyWithRecovery(state, property.id);
check('reclaim moves stored items to recovery instead of deleting', reclaim.ok && reclaim.recovery.itemIds.length === 2 && property.storageItems.length === 0);

let projectResult = m.contributeHarthmereGuildTownProjectScenario(state, { projectId: 'repair_bridge', ownerType: 'town', requiredMaterials: { wood_plank: 5 }, requiredLabor: 3, playerId: 'alice', materials: { wood_plank: 5 }, labor: 3 });
check('guild/town project tracks material and labor contribution to completion', projectResult.ok && projectResult.project.complete);

property.hp = 1000;
property.maxHp = 1000;
let siegeClosed = m.resolveHarthmereSiegeAttack(property, { attackerType: 'player', pvpEnabled: true, safeZone: false, siegeAllowed: true, vulnerabilityWindowOpen: false, damage: 100 });
check('siege attack respects vulnerability windows', siegeClosed.ok === false && siegeClosed.code === 'vulnerability_closed');
let siegeOpen = m.resolveHarthmereSiegeAttack(property, { attackerType: 'player', pvpEnabled: true, safeZone: false, siegeAllowed: true, vulnerabilityWindowOpen: true, damage: 100 });
check('siege attack damages building during vulnerability window', siegeOpen.ok && property.hp === 900);

property.ownerId = 'bob';
state.players.bob.gold = 500;
let tax = m.payHarthmerePropertyTaxes(state, { propertyId: property.id, playerId: 'bob', taxGold: 50, now: state.now });
check('tax payment refreshes upkeep lifecycle and services', tax.ok && property.servicesEnabled === true && property.reclaimable === false && state.players.bob.gold === 450);

if (!ok) process.exit(1);
console.log('RESULT: PASS');
