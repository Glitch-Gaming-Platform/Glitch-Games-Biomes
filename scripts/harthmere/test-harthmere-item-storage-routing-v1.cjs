#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, inventorySource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere item storage routing v1");
const src = inventorySource(h);
h.ok(src.includes("addItemByStorageRules"), "central storage routing exists");
h.ok(src.includes('category === "crafting_material"') && src.includes("materialStorage"), "materials route to material storage");
h.ok(src.includes('category === "quest_item"') && src.includes("questPouch"), "quest items route to quest pouch");
h.ok(src.includes('category === "key"') && src.includes("keyring"), "keys route to keyring");
h.ok(src.includes('useEffect: { type: "learn_spell"') && src.includes("learnSpell"), "spell scrolls teach spells into spellbook");
h.ok(src.includes("sellBlockReason") && src.includes("equipBackpackItem") && src.includes("useBackpackItem"), "sell/use/equip rules exist");
h.done();
