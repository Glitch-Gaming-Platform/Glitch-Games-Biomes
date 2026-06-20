# Harthmere Complete Combat, Progression, Ability, Skill, Equipment, Loot, PvP, and Death Rules

> **Hitting creatures / rendering / spawns / respawn:** how every living thing
> (muckers, hexes, animals, quest & escort creatures, town humans) is rendered on
> its real ECS entity so it is hittable and non-flickering, randomly spread
> across the world, and respawns 30–60 min after death, is documented in
> [`HARTHMERE_LIVE_CREATURE_ECS_RENDER.md`](./HARTHMERE_LIVE_CREATURE_ECS_RENDER.md).

This document describes the shared deterministic rules layer for Harthmere combat,
progression, abilities, equipment, loot, PvP, and death.

It implements:

- 12 MMO classes with roles, attributes, weapon/armor access, resources, starting abilities, specializations, quests, world interactions, and NPC reaction rules.
- 95 skills across combat, weapon, armor, magic, profession, gathering, crafting, social, exploration, survival, movement, stealth, and leadership categories.
- 51 abilities with class/skill/level requirements, resource costs, cooldowns, cast times, ranges, target types, line-of-sight rules, effects, PvP modifiers, interrupt rules, safe-zone policy, tooltips, upgrades, and server validation.
- Weapon, shield, armor, caster, engineering, and summoning equipment definitions with durability, level/class requirements, binding/trade rules, stats, repair costs, and animation-family metadata.
- XP, level-up, rested/anti-farming hooks, skill progression validation, and reward suppression for trivial, AFK, grey, repeated, and client-only actions.
- Personal loot tables with level scaling, contribution eligibility, boss-wipe suppression, overflow recovery, hardcore PvP protection, and anti-farming rules.
- NPC combat profiles for wolves, bandits, guards, necromancers, bosses, and civilians.
- PvP contribution, group/raid eligibility, repeated-kill suppression, low-level grief suppression, win-trading suppression, and raid-kick-after-contribution protection.
- Death penalty rules for PvE, boss, PvP, duel, hardcore PvP, ally revive, and unfair/server-issue deaths.
- Server-authoritative request validation against client-owned hit/damage/kill/xp/loot claims and stale entity versions.
- A broad edge-case registry matching the rules/guides.

Standalone tests:

```bash
node scripts/harthmere/test-harthmere-complete-progression-catalogs.cjs .
node scripts/harthmere/test-harthmere-complete-abilities-equipment.cjs .
node scripts/harthmere/test-harthmere-complete-level-skill-loot.cjs .
node scripts/harthmere/test-harthmere-complete-server-pvp-death.cjs .
node scripts/harthmere/test-harthmere-complete-runtime-integration.cjs .
```

The Harthmere suite includes these tests as part of the shared rules validation set.

Important integration note:

This is the full shared deterministic rules layer. The next production step is to make every live attack, ability cast, reward, loot drop, equipment change, death, revive, and PvP result call this module from the real authoritative runtime/server path instead of trusting UI/local-dev state.
