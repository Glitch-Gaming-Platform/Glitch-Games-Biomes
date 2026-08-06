# Harthmere Native ECS Combat

This document defines the implemented combat authority for Harthmere. It is
based on the original Biomes ECS flow restored from the May 16, 2026 snapshot:

`SelectedItem -> cursor ray/AABB -> UpdateNpcHealthEvent -> ECS Health -> Anima -> UpdatePlayerHealthEvent -> ECS Health/HUD`

LocalStorage combat, browser NPC AI, and Redis combat snapshots are retained
only for the explicitly enabled legacy diagnostic runtime. They are not a
fallback authority while `NEXT_PUBLIC_BIOMES_NATIVE_ECS_AUTHORITY` is enabled.

## One-authority contract

| Concern                                | Authority                                 | Projection/consumer                           |
| -------------------------------------- | ----------------------------------------- | --------------------------------------------- |
| Player and NPC position/hitbox         | ECS `Position` + `Size`                   | renderer and cursor                           |
| Selected weapon                        | ECS `Inventory.selected` + `SelectedItem` | client animation and server damage validation |
| Clothing/armor                         | ECS `Wearing`                             | avatar renderer and server mitigation         |
| Player and NPC health                  | ECS `Health`                              | HUD, death, Anima, drops                      |
| NPC behavior                           | exact `/npcs/types` Bikkie behavior       | Anima chase/attack/meander                    |
| Retaliation participants and targets   | Anima + ECS combat/damage state           | public `NpcCombatState`, renderer             |
| Combat level, XP, cooldown, boss kills | ECS `TriggerState`                        | server handlers and vitals HUD                |
| Drops and kill triggers                | native NPC death transaction              | grab bags and trigger server                  |
| Hit feedback                           | confirmed ECS health change               | BiomesUI/Harthmere HUD status indicator       |
| Mana and spell cost                    | ECS `TriggerState` vitals root            | server attack validation and HUD              |

No label regex is allowed to decide the behavior, damageability, drops, or
quest kill identity of a native Harthmere NPC. Labels remain presentation only.

## Exact NPC types

`harthmere_native_combat.ts` derives deterministic NPC type IDs for every
authored family and publishes valid `/npcs/types` biscuits. Muckers, Hexers,
livestock, sentinels, and the Muck-Scarred Helix no longer share `dMucker`.

- Hostile Muck creatures use proximity aggro and native chase attacks.
- Road Muckwad Patch creatures are retaliation-only so Road Ahead cannot kill a
  new player during the collect/throw lesson.
- Livestock is attackable but retaliation-only.
- Robot sentinels remain non-attackable.
- Every exact type owns its health, attack cadence, reach, movement, drops, XP,
  and `npcKilled` identity.

Native rendering uses ECS `Position` directly. Snapshot-only grounding, browser
route motion, and browser navigation are disabled in native mode because moving
only the mesh creates a visible body and an authoritative hitbox in different
locations.

## Multiplayer retaliation and NPC opponents

Damage evidence, not proximity alone, opens retaliation. For 30 seconds after a
real hit, the directly attacked creature and its eligible authored responders
select from the alive combat participants in a bounded 18-metre vicinity. The
direct attacker is first; group responder rank distributes a pack across nearby
players, and a solo creature rotates every six seconds. Threat still orders the
list, and a taunt-sized threat value prevents rotation away from its owner.

Safe zones still prevent proactive aggro. After a real hit opens the bounded
encounter, however, every alive non-peace player inside the 18-metre vicinity is
an eligible participant even on protected or clean terrain; otherwise the fight
collapses back onto the opener and reproduces the multiplayer defect. An NPC is
eligible only when it opened the encounter or its public combat state shows it
is actively attacking that creature. That permits player-owned combat escorts
to participate without making civilians, quest NPCs, unrelated animals, or
nearby monsters valid collateral targets.

NPC attacks use the same health authorities as player combat:

- a player target receives `UpdatePlayerHealthEvent`;
- an NPC/escort target receives `UpdateNpcHealthEvent`;
- Logic verifies the attacking NPC's current Anima melee or ranged receipt,
  derives the authoritative damage, and rejects stale, mismatched, or replayed
  receipts;
- NPC-caused kills do not publish player kill credit, XP, or quest attribution.

Jobs-board escorts use `defend_leader` by default. They never start a proximity
fight, but can defend themselves and their player. Explicitly authored
`noncombatant` and unkillable story assignments retain those protections.

## Weapons, armor, levels, and validation

The server ignores client-supplied damage for exact Harthmere NPCs and migrated
Harthmere PvP actors. It derives the result from the attacker's ECS-selected
item and validates:

1. selected-item ownership;
2. combat-capable item category/stats;
3. required level;
4. item-specific melee, heavy, spell, or ranged reach to the target AABB;
5. server cooldown stored in `TriggerState`;
6. target health and attacker health;
7. durability consumption in the accepted-hit transaction.
8. native mana availability and same-transaction mana debit for spells.

Incoming NPC and PvP damage is recomputed on the server. Worn exact item IDs
provide armor, defense, and deterministic evasion reduction. Accepted hits wear
armor durability; rejected or out-of-range events do not.

The original Road Ahead Muckwad keeps exact snapshot ID `4603863378554668`.
It is a placeable/throwable voxel item, not a weapon, so selecting or throwing
it cannot damage or aggro an NPC.

Protected sentinels and dead attackers are rejected again in the server event
handler. Client targeting remains a usability filter, never the security or
combat-authority boundary.

## Death, drops, progression, and quests

An accepted lethal hit clamps ECS health to zero and completes the following in
one logic event transaction:

- native NPC death/corpse handling;
- native drop-table materialization;
- `npcKilled` publication with the exact NPC type ID;
- native XP/level update;
- boss-kill counter update;
- fixed-seed respawn scheduling where applicable.

The hard-boss helper quest materializes the exact native Muck-Scarred Helix only
after a server-owned active quest is found. A per-actor/per-quest Redis baseline
prevents corpse expiry from respawning the same defeated encounter for repeated
XP. Quest completion reads the native boss-kill count and records the exact boss
entity ID.

## One-time migration

`POST /api/harthmere/native_combat_sync` is an idempotent migration, not a new
runtime authority. It reads the existing server Redis save and writes once to
ECS:

- character level/current XP into `TriggerState`;
- legacy main-hand equipment into native inventory/selection;
- clothing and defensive off-hand equipment into native `Wearing` slots.

After migration version 1 is recorded, combat and the HUD read ECS only. The
endpoint never continuously mirrors Redis damage, inventory, health, or level.

## Required verification matrix

Automated tests must cover:

- unarmed, dagger/sword, heavy, ranged, spell/noncombat selection;
- forged client damage, level gates, cooldown replay, range, and durability;
- dead attackers and server-enforced non-attackable sentinels;
- armor/defense/evasion and armor durability;
- moving and stationary exact NPC types;
- hostile, retaliation-only livestock/tutorial creatures, and sentinels;
- two nearby players sharing retaliation, deterministic pack distribution, and
  solo target rotation;
- combat escorts defending their player and receiving receipt-authorized melee
  and ranged NPC damage exactly once;
- player-versus-NPC and migrated Harthmere player-versus-player damage;
- lethal hit, zero clamp, XP, boss credit, exact drops, and respawn scheduling;
- exact Muckwad ID and inability to attack while it is selected;
- migration idempotency and distinct visible wearable slots;
- HUD health/progression from ECS and confirmation-based pending feedback.

The React 418/423 errors in the July 20 capture originated in the Glitch host
bundle (`www.glitch.fun/static/js/...`), not the embedded Biomes bundle. The
host play routes now replace their SEO SSR shell with an explicit client root;
their browser-only viewport, media, input, payment, and iframe state is no
longer incorrectly hydrated against server markup.

Before any explicitly authorized deployment, run:

```bash
NODE_OPTIONS=--max-old-space-size=8192 yarn tsc --noEmit --pretty false
MOCHA_TEST=1 TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' \
  node_modules/.bin/mocha \
  src/shared/harthmere/test/harthmere_native_combat.test.ts \
  src/shared/harthmere/test/harthmere_native_bikkie_items.test.ts \
  src/server/logic/test/harthmere_npc_hit.test.ts \
  src/pages/api/harthmere/test/native_combat_api_helpers.test.ts \
  src/server/harthmere/test/live_mode_robot_energy_scheduler.test.ts
```

Live validation requires an explicitly authorized deployment. The canary should
test Road Ahead Muckwad collection/throwing first, then sword and bow hits,
retaliation, armor, death/drop/XP, the Muck-Scarred Helix, multiplayer visibility,
and HUD update latency while watching sync/Anima logs. Do not use Redis/local
combat state as a fallback if a canary fails; diagnose the native event chain.
