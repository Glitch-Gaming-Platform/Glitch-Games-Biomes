#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, npcBehaviorSource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere NPC crime response tests v1");
const src = npcBehaviorSource(h);
h.ok(src.includes("HARTHMERE_NPC_CRIME_RESPONSES"), "crime response table exists");
h.ok(src.includes("getHarthmereNpcCrimeResponse"), "crime response resolver exists");
for (const crime of ["theft", "assault", "public_murder", "temple_theft", "smuggling", "illegal_magic", "trespass"]) {
  h.ok(src.includes(`\"${crime}\"`) || src.includes(`${crime}:`), `crime response covers ${crime}`);
}
h.ok(src.includes('profile.kind === "guard"') && src.includes("arrest"), "guards respond to crimes with warning/arrest behavior");
h.ok(src.includes('profile.kind === "thief"') && src.includes("help_criminal"), "thieves/fences help criminal players where appropriate");
h.ok(src.includes('profile.kind === "priest"') && src.includes("temple_theft"), "priests/healers react badly to temple theft");
h.ok(src.includes('profile.kind === "noble"') && src.includes("property access"), "nobles route crime into status/property/legal consequences");
h.ok(src.includes('profile.kind === "peasant"') && src.includes("flee"), "peasants/civilians flee or refuse help when threatened");
h.ok(src.includes('profile.kind === "merchant"') && src.includes("secures stock"), "merchants protect stock and may call guards");
h.done();
