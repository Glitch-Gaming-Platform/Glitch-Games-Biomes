#!/usr/bin/env node
console.log("== Harthmere attack variation live tests v13 ==");
console.log("This live probe expects the game to expose __harthmereRendererDebug.attackVariationAudit().");
console.log("Scenarios to validate live:");
console.log("- 4 non-repeating basic attacks");
console.log("- 4 non-repeating heavy attacks");
console.log("- 4 non-repeating magic casts");
console.log("- handedness/weapon side matches visible attack arm");
console.log("- locomotion + attack variation remains upper-body only");
process.exit(0);
