# Harthmere Combat Implementation Review v1

## Current implementation found

The current project already has a large local-dev combat layer in `LocalDevHarthmereCombat.tsx`, a separate multiplayer combat UI layer, a death UI/system layer, a leveling/scaling layer, class/skill/ability support, NPC AI support, and a server authority contract file.

Implemented or partially implemented today:

- Player and NPC combat stats: HP, attack points, defense, armor, magic resistance, accuracy, evasion, crit, attack range, aggro range, leash range, faction, behavior, combat state.
- Basic/heavy/spark attacks and NPC basic attacks.
- Hit results including miss, dodge, parry, block, normal hit, critical hit, glancing hit, crushing hit, immune, evade.
- Damage reduction with diminishing returns.
- Level damage and hit modifiers through the leveling system.
- NPC death state, corpse timer, respawn timer, combat status lookup.
- Player downed state, revive, release spirit, respawn, and temporary protection.
- Reputation/legal consequences for attacking or killing guards, merchants, civilians, children, protected animals, and threats.
- Realtime NPC counterattacks and ambient Wilds threat attacks.
- PvP flag UI/mode, party members, ready check, pull timer, contribution counters, and hotkey attacks.
- NPC behavior/AI profiles, route/social/economy/crime reactions, and third-party AI adapter scaffolding.

## Main gap

The implementation is spread across React/local-storage/local-dev files. That makes it hard to prove server authority and hard to reuse the same combat pipeline for NPCs, players, bosses, PvP, raids, party contribution, death, respawn, rewards, and anti-exploit validation.

## Added in this patch

This patch adds `src/shared/harthmere/combat_system_v1.ts`, a pure combat rules engine that is independent of React and localStorage. It is designed to be the source-of-truth rules contract for future server implementation and runtime wiring.

It covers:

- Full attack pipeline.
- Core combat stats for players, NPCs, bosses, pets, summons, mounts, and training dummies.
- Server-authoritative request validation and client spoof rejection.
- PvP legality, safe-zone, spawn-protection, cooldown, resource, range, line-of-sight, and facing checks.
- Hit result resolution.
- Damage calculation using attack points, ability multiplier, variance, crit, level difference, damage type, defense/resistance, block, resist, and absorb.
- Downed/dead death records.
- Revive and respawn validation.
- Temporary respawn protection.
- Contribution that includes damage, healing, shielding, objectives, revives, crowd control, interrupts, tanking, and support.
- Reward suppression for AFK, low-level griefing, repeated kills, harmless targets, and out-of-range inactive participants.
- PvP flags and combat relationship states.
- Crowd-control diminishing returns.
- NPC leash/evade rules.
- Required combat feedback and edge-case registry.

## Tests added

- `scripts/harthmere/test-harthmere-combat-system-core-v1.cjs`
- `scripts/harthmere/test-harthmere-combat-system-integration-v1.cjs`

The suite now references both tests.

## Still recommended after this patch

1. Wire runtime calls in `LocalDevHarthmereCombat.tsx` to call `resolveHarthmereCombatAction` directly instead of duplicating pipeline logic.
2. Move persistent mutations from localStorage into real server/API transactions.
3. Add browser/live tests that prove line-of-sight, range, collision, and forward-arc attacks use the shared engine.
4. Add boss encounter fixtures with phases, telegraphs, enrage timers, lockouts, wipe reset, contribution-based loot, and death recap.
5. Add PvP fixtures for duels, arena, battleground, criminal/bounty targets, spawn camping, safe-zone abuse, and repeated-kill suppression.

