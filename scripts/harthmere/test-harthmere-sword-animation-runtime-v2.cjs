#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { makeReporter } = require("./harthmere-town-rule-test-utils-v1.cjs");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const report = makeReporter("Harthmere sword animation runtime tests v2", root);

function readRequired(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) throw new Error(`Missing ${rel}`);
  return fs.readFileSync(full, "utf8");
}

function sliceBetween(src, startNeedle, endNeedle) {
  const start = src.indexOf(startNeedle);
  if (start < 0) return "";
  const end = endNeedle ? src.indexOf(endNeedle, start + startNeedle.length) : -1;
  return src.slice(start, end < 0 ? src.length : end);
}

function countMatches(src, re) {
  return [...src.matchAll(re)].length;
}

function checkSection(label, src, re, detail) {
  report.check(label, re.test(src), detail);
}

const multiplayerPath = "src/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem.tsx";
const combatPath = "src/client/components/challenges/LocalDevHarthmereCombat.tsx";
const hudPath = "src/client/components/challenges/HarthmereUnifiedHUD.tsx";
const playerAnimationsPath = "src/client/game/util/player_animations.ts";
const playerMeshPath = "src/client/game/resources/player_mesh.ts";
const npcPath = "src/client/game/resources/npcs.ts";
const rendererPath = "src/client/game/renderers/local_dev/harthmere_assets.ts";
const equipmentManifestPath = "src/shared/game/medieval/harthmereEquipmentAnimationManifest.generated.ts";

const multiplayer = readRequired(multiplayerPath);
const combat = readRequired(combatPath);
const hud = readRequired(hudPath);
const playerAnimations = readRequired(playerAnimationsPath);
const playerMesh = readRequired(playerMeshPath);
const npcs = readRequired(npcPath);
const renderer = readRequired(rendererPath);
const equipmentManifest = readRequired(equipmentManifestPath);

const keyedAttack = sliceBetween(multiplayer, "export function performHarthmereKeyedAttack", "export function simulateHarthmereAllySupport");
const toggleWeapon = sliceBetween(multiplayer, "export function toggleHarthmereWeaponDrawn", "export function setHarthmerePvpFlag");
const visualEmitter = sliceBetween(multiplayer, "function emitHarthmereWeaponVisualState", "function event()");
const swordRenderer = sliceBetween(renderer, "private ensureHarthmerePlayerSword", "private registerCombatLife");
const swordVisualInstall = sliceBetween(renderer, "private installHarthmerePlayerSwordVisuals", "private debugHarthmereSwordRendererEvent");
const swordUpdate = sliceBetween(renderer, "private updateHarthmerePlayerSwordVisual", "private registerCombatLife");
const combatEffectHandler = sliceBetween(renderer, "private readonly onCombatEffect", "private faceCombatActorToward");
const bestCombatClip = sliceBetween(renderer, "function bestCombatClip", "function normalizedCombatText");
const debugBridge = sliceBetween(renderer, "private installDebugBridge", "private readonly onCombatEffect");
const manualSwing = sliceBetween(renderer, "private startHarthmerePlayerSwordManualSwing", "private updateHarthmerePlayerSwordVisual");

// 1. Draw / sheath / attack event contract.
checkSection(
  "weapon visual event carries action, drawn, attack, itemId, and timestamp",
  visualEmitter,
  /new\s+CustomEvent\(\s*["']biomes:harthmere-player-sword-visual["'][\s\S]{0,900}action[\s\S]{0,120}drawn[\s\S]{0,120}attack[\s\S]{0,180}itemId[\s\S]{0,120}at\s*:/,
  "The renderer needs a complete state payload for deterministic sword animation tests."
);
checkSection("toggle weapon emits draw true", toggleWeapon, /emitHarthmereWeaponVisualState\(\s*["']draw["']\s*,\s*true\s*\)/, "Draw toggle must drive the visual event.");
checkSection("toggle weapon emits sheathe false", toggleWeapon, /emitHarthmereWeaponVisualState\(\s*["']sheathe["']\s*,\s*false\s*\)/, "Sheathe toggle must drive the visual event.");
checkSection("first physical B/N press draws sword and returns before damage", keyedAttack, /attack\s*!==\s*["']spark["']\s*&&\s*!state\.weaponDrawn[\s\S]{0,900}emitHarthmereWeaponVisualState\(\s*["']draw["']\s*,\s*true\s*,\s*attack\s*\)[\s\S]{0,160}return\s*;/, "First sheathed physical key press should draw, not invisibly damage.");
checkSection("draw transition has its own cooldown gate", keyedAttack, /setCooldown\([\s\S]{0,160}["']draw["']\s*,\s*0\.35\s*\)/, "Draw transition should not be spammable.");
report.check("draw branch does not emit attack animation before returning", /Weapon Not Drawn[\s\S]{0,500}emitHarthmereWeaponVisualState\(\s*["']draw["']\s*,\s*true\s*,\s*attack\s*\)[\s\S]{0,120}return\s*;/.test(keyedAttack) && !/Weapon Not Drawn[\s\S]{0,500}emitAttackAnimation\(attack\)/.test(keyedAttack), "Drawing should be a draw animation, not an attack emote.");
checkSection("drawn physical attack emits player body attack event", keyedAttack, /emitAttackAnimation\(attack\)/, "B/N attack must still drive the player body animation bridge.");
checkSection("drawn physical attack emits visible sword attack event", keyedAttack, /emitHarthmereWeaponVisualState\(\s*["']attack["']\s*,\s*true\s*,\s*attack\s*\)/, "B/N attack must drive the sword visual, not just damage.");
checkSection("drawn physical attack resolves forward arc after visual attack event", keyedAttack, /emitHarthmereWeaponVisualState\(\s*["']attack["']\s*,\s*true\s*,\s*attack\s*\)[\s\S]{0,260}performHarthmereForwardArcAttack\(attack\)/, "Sword visual should be emitted before/with damage arc resolution.");

// 2. Clip selection and mixer behavior.
checkSection("sword clip constants map draw/sheathe/basic/heavy/idle to generated clip names", renderer, /HARTHMERE_PLAYER_SWORD_CLIPS\s*=\s*\{[\s\S]{0,500}draw\s*:\s*["']Draw_24["'][\s\S]{0,120}sheathe\s*:\s*["']Sheathe_24["'][\s\S]{0,120}basic\s*:\s*["']BasicSlash_24["'][\s\S]{0,120}heavy\s*:\s*["']HeavySlash_24["'][\s\S]{0,120}idle\s*:\s*["']IdleDrawn_24["']/, "Sword clip constants must match generated equipment clips.");
checkSection("renderer loads real animated sword GLTF from equipment animation manifest", swordRenderer, /getHarthmereEquipmentAnimation\(id\)[\s\S]{0,400}gltfLoader\.loadAsync\(entry\.assetUrl\)/, "Runtime should load the generated animated sword asset, not only the static prop.");
checkSection("renderer registers every GLTF sword clip with AnimationMixer", swordRenderer, /new\s+THREE\.AnimationMixer\(mount\)[\s\S]{0,420}for\s*\(const\s+clip\s+of\s+gltf\.animations\)[\s\S]{0,240}clipAction\(clip\)/, "Every imported sword clip should be available by name.");
checkSection("Draw_24 and Sheathe_24 play as one-shot non-idle clips", swordRenderer, /clampWhenFinished\s*=\s*!isIdle[\s\S]{0,220}setLoop\(isIdle\s*\?\s*THREE\.LoopRepeat\s*:\s*THREE\.LoopOnce/, "Draw/sheath/attack clips should not loop forever.");
checkSection("finished draw/sheath/attack returns to IdleDrawn_24 while drawn", swordRenderer, /addEventListener\(\s*["']finished["'][\s\S]{0,260}harthmerePlayerSwordState\.drawn[\s\S]{0,260}HARTHMERE_PLAYER_SWORD_CLIPS\.idle/, "After one-shot sword animation, drawn sword should settle into IdleDrawn_24.");
checkSection("basic attack selects BasicSlash_24", swordRenderer, /state\.attack\s*===\s*["']heavy["'][\s\S]{0,160}HARTHMERE_PLAYER_SWORD_CLIPS\.basic/, "Non-heavy attack should select BasicSlash_24.");
checkSection("heavy attack selects HeavySlash_24", swordRenderer, /state\.attack\s*===\s*["']heavy["'][\s\S]{0,120}HARTHMERE_PLAYER_SWORD_CLIPS\.heavy/, "Heavy attack should select HeavySlash_24.");
report.check(
  "heavy/basic clip ternary is not malformed or double-nested",
  !/state\.attack\s*===\s*["']heavy["']\s*\?\s*HARTHMERE_PLAYER_SWORD_CLIPS\.heavy\s*\?/.test(swordRenderer),
  "Do not accidentally nest a second ternary after HARTHMERE_PLAYER_SWORD_CLIPS.heavy."
);
checkSection("renderer records the active sword clip for tests/debugging", swordRenderer, /harthmerePlayerSwordActiveClip\s*=\s*name[\s\S]{0,260}renderer\.player_sword\.clip/, "Tests need active clip observability.");
checkSection("manual fallback swing starts for BasicSlash_24 and HeavySlash_24", swordRenderer, /name\s*===\s*["']BasicSlash_24["'][\s\S]{0,160}startHarthmerePlayerSwordManualSwing\(\s*["']basic["']\s*\)[\s\S]{0,240}name\s*===\s*["']HeavySlash_24["'][\s\S]{0,160}startHarthmerePlayerSwordManualSwing\(\s*["']heavy["']\s*\)/, "Fallback/procedural sword still needs visible slash motion.");

// 3. Attachment and visual transform correctness.
checkSection("runtime actors expose hand/hip/back anchors", renderer, /harthmere-anchor-right-hand[\s\S]{0,240}harthmere-anchor-left-hand[\s\S]{0,240}harthmere-anchor-hip[\s\S]{0,240}harthmere-anchor-back/, "Player/NPC attachment anchors must exist.");
report.check(
  "sword visual uses real hand and sheathe anchors, not only approximate world offsets",
  /right-hand|rightHand|harthmere-anchor-right-hand/.test(swordRenderer) && /hip|back|sheathe|harthmere-anchor-hip|harthmere-anchor-back/.test(swordRenderer) && !/Approximate hand and sheathed locations/i.test(swordRenderer),
  "Sword should be attached to hand when drawn and hip/back when sheathed. Current approximate world offsets are not enough for final sword animation correctness."
);
checkSection("sword transform follows bodyForward before generic forward", swordUpdate, /const\s+forward\s*=\s*runtime\?\.bodyForward\s*\?\?\s*runtime\?\.forward/, "Visual sword direction must use the same bodyForward as melee damage.");
checkSection("sword yaw is derived from normalized facing vector", swordUpdate, /Math\.atan2\(nx\s*,\s*nz\)/, "Sword yaw should track normalized facing direction.");
checkSection("manual swing samples the current hand anchor every frame", manualSwing + swordUpdate, /currentHandPosition[\s\S]{0,320}handAnchor\.getWorldPosition[\s\S]{0,360}sword\.position\.copy\(currentHandPosition\)[\s\S]{0,520}harthmereWeaponHandTrackingV10/, "Weapon must follow the animated hand/arm during the swipe instead of using a stale start transform.");
checkSection("manual swing restores to the current hand anchor when done", manualSwing, /if\s*\(t\s*>=\s*1\)[\s\S]{0,420}currentHandPosition[\s\S]{0,240}sword\.position\.copy\(currentHandPosition\)[\s\S]{0,420}manual_swing_done/, "Sword should end attached to the current hand anchor, not at a drifted world transform.");


// 4. Timing, impact metadata, cooldown, and repeated attacks.
checkSection("basic and heavy sword swings use different visual durations", swordVisualInstall + manualSwing, /attack\s*===\s*["']heavy["']\s*\?\s*520\s*:\s*340/.test(swordVisualInstall + manualSwing) ? /attack\s*===\s*["']heavy["']\s*\?\s*520\s*:\s*340/ : /attack\s*===\s*["']heavy["']\s*\?\s*520\s*:\s*360/, "Heavy swing should last longer than basic swing.");
checkSection("basic/heavy cooldowns gate repeated attacks", keyedAttack, /cooldownSeconds\s*=\s*attack\s*===\s*["']heavy["']\s*\?\s*2\.8[\s\S]{0,120}:\s*1\.4[\s\S]{0,240}setCooldown\(state\s*,\s*attack\s*,\s*cooldownSeconds\)/, "B/B/B and N spam should be blocked or delayed by cooldown.");
checkSection("cooldown failure exits before new visual attack event", keyedAttack, /!cooldownReady\(state\s*,\s*attack\)[\s\S]{0,220}On Cooldown[\s\S]{0,160}return\s*;[\s\S]{0,260}let\s+forwardArcHitCount|!cooldownReady\(state\s*,\s*attack\)[\s\S]{0,300}return\s*;[\s\S]{0,500}if\s*\(attack\s*===\s*["']spark["']\)/, "Cooldown branch must return before emitAttackAnimation/forward arc.");
report.check(
  "sword attack event exposes timing metadata for windup / impact / recovery tests",
  /windupMs|impactMs|impactAt|recoveryMs|hitFrame|impactFrame/.test(visualEmitter) || /windupMs|impactMs|impactAt|recoveryMs|hitFrame|impactFrame/.test(keyedAttack),
  "Add timing metadata so tests can verify damage is applied near the slash impact frame, not arbitrarily early."
);

// 5. Blocking/parry behavior.
checkSection("combat model has block/parry/absorb results", combat, /result\s*===\s*["']block["'][\s\S]{0,160}result\s*===\s*["']parry["']|result\s*===\s*["']parry["'][\s\S]{0,160}result\s*===\s*["']block["']|absorb/, "Combat resolver should distinguish block/parry/absorb from normal hit.");
report.check(
  "renderer routes block/parry/absorb to block pulse, not generic hit",
  /result\s*===\s*["']block["']|result\s*===\s*["']parry["']|result\s*===\s*["']absorb["']/.test(combatEffectHandler) && /targetKind[\s\S]{0,600}["']block["']/.test(combatEffectHandler),
  "Target block/parry/absorb should play Block/ShieldBlock, not only HitReact."
);
report.check(
  "bestCombatClip has explicit block fallback before evade fallback",
  /kind\s*===\s*["']block["'][\s\S]{0,260}ShieldBlock[\s\S]{0,120}Block/.test(bestCombatClip) || /kind\s*===\s*["']block["'][\s\S]{0,260}Block[\s\S]{0,120}ShieldBlock/.test(bestCombatClip),
  "bestCombatClip(kind='block') must prefer ShieldBlock/Block."
);
checkSection("asset coverage includes Block and ShieldBlock animation names", readRequired("harthmere-animation-actions.csv"), /Block[\s\S]*ShieldBlock|ShieldBlock[\s\S]*Block/, "Generated catalog should include block clips.");

// 6. Movement while sword is drawn.
checkSection("player body animation still has walk/run/jump aliases", playerAnimations + playerMesh, /walk|Walking/i, "Walking must continue while sword is drawn.");
checkSection("player body animation still has run alias", playerAnimations + playerMesh, /run|Running/i, "Running must continue while sword is drawn.");
checkSection("player body animation still has jump alias", playerAnimations + playerMesh, /jump/i, "Jumping must continue while sword is drawn.");
report.check(
  "armed movement blending is explicitly handled or tested",
  /armedWalk|armedRun|IdleDrawn|weaponDrawn[\s\S]{0,300}(walk|run|jump)|drawn[\s\S]{0,300}(walk|run|jump)/i.test(playerAnimations + playerMesh + renderer),
  "Need explicit coverage that drawn sword does not break walking/running/jumping poses."
);

// 7. NPC sword animation behavior.
checkSection("NPCs expose right/left hand, hip, and back anchors for weapons", npcs, /harthmere-anchor-right-hand[\s\S]{0,240}harthmere-anchor-left-hand[\s\S]{0,240}harthmere-anchor-hip[\s\S]{0,240}harthmere-anchor-back/, "NPCs need weapon attachment anchors.");
checkSection("NPC/runtime actors carry equipment metadata including weapons", renderer + npcs, /appearance\.equipment|equipment\.mainHand|equipment\.main_hand|mainHand/, "NPC combat actors should know what weapon they are using.");
checkSection("NPC attack pulses prefer attack/heavy/swing clips", bestCombatClip, /kind\s*===\s*["']attack["'][\s\S]{0,500}Attack[\s\S]{0,120}HeavyAttack[\s\S]{0,120}Thrusting/, "NPC sword attacks should resolve to attack clips.");
report.check(
  "renderer faces NPC attackers toward targets before attack pulse",
  combatEffectHandler.indexOf("faceCombatActorToward(attacker") >= 0 &&
    combatEffectHandler.indexOf("startCombatPulse(attacker") > combatEffectHandler.indexOf("faceCombatActorToward(attacker"),
  "NPC attack animation must face the victim before the clip starts."
);
report.check("NPC hit/death pulses can interrupt attack pulses", /kind\s*===\s*["']death["'][\s\S]{0,240}Death/.test(bestCombatClip) && /targetKind[\s\S]{0,260}["']death["']/.test(combatEffectHandler), "Death should be routed to a death animation, not another attack.");

// 8. Sword variants.
const swordVariantIds = ["sword_1handed", "Sword", "Sword_Golden", "sword_2handed"];
for (const id of swordVariantIds) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const entryRe = new RegExp(`"id"\\s*:\\s*"${escaped}"[\\s\\S]{0,900}"assetUrl"[\\s\\S]{0,900}"Draw_24"[\\s\\S]{0,120}"Sheathe_24"[\\s\\S]{0,120}"BasicSlash_24"[\\s\\S]{0,120}"HeavySlash_24"[\\s\\S]{0,120}"IdleDrawn_24"`);
  report.check(`sword variant ${id} has draw/sheath/basic/heavy/idle generated clips`, entryRe.test(equipmentManifest), `Missing complete generated clip entry for ${id}`);
}
checkSection("runtime fallback order includes all player sword variants", renderer, /HARTHMERE_PLAYER_SWORD_EQUIPMENT_IDS\s*=\s*\[[\s\S]{0,260}sword_1handed[\s\S]{0,260}Sword[\s\S]{0,260}Sword_Golden[\s\S]{0,260}sword_2handed/, "Runtime should try every supported sword variant before falling back.");

// 9. Live visual regression/debug contract. Static test requires the hooks so the live test can inspect real sword behavior.
report.check(
  "renderer debug bridge exposes sword debug snapshot for live tests",
  /sword(State|Debug|Visual|Snapshot)|playerSword/.test(debugBridge) && /harthmerePlayerSwordActiveClip|harthmerePlayerSwordState|harthmerePlayerSwordDrawAmount/.test(debugBridge),
  "Expose __harthmereRendererDebug.swordState() with drawn/action/attack/activeClip/drawAmount/position/rotation/usingGltf so live tests can verify actual visuals."
);
report.check(
  "renderer debug log is available for clip, manual swing, and state assertions",
  /__harthmereRendererDebugLog/.test(debugBridge) && /renderer\.player_sword\.clip/.test(renderer) && /renderer\.player_sword\.state/.test(renderer),
  "Live tests need renderer debug logs for clip/state transitions."
);

// 10. Guard against accidental duplicate attack emits.
report.check(
  "physical attack branch emits one visible sword attack event",
  countMatches(sliceBetween(keyedAttack, "} else {", "const cooldownSeconds"), /emitHarthmereWeaponVisualState\(\s*["']attack["']\s*,\s*true\s*,\s*attack\s*\)/g) === 1,
  "Do not emit duplicate sword attack visual events from the physical branch."
);

report.finish();
