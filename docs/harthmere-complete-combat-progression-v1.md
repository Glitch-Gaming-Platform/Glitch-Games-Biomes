# Harthmere Complete Combat, Progression, Ability, Skill, Equipment, Loot, PvP, and Death Rules v1

This package adds the missing shared rules layer around the earlier combat v1 engine.

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
node scripts/harthmere/test-harthmere-complete-progression-catalogs-v1.cjs .
node scripts/harthmere/test-harthmere-complete-abilities-equipment-v1.cjs .
node scripts/harthmere/test-harthmere-complete-level-skill-loot-v1.cjs .
node scripts/harthmere/test-harthmere-complete-server-pvp-death-v1.cjs .
node scripts/harthmere/test-harthmere-complete-runtime-integration-v1.cjs .
```

The Harthmere suite is patched idempotently to include the new tests when the suite file exists.

Important integration note:

This is the full shared deterministic rules layer. The next production step is to make every live attack, ability cast, reward, loot drop, equipment change, death, revive, and PvP result call this module from the real authoritative runtime/server path instead of trusting UI/local-dev state.
