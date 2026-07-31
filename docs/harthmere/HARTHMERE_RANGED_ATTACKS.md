# Harthmere ranged attacks and offensive spells

Audited and implemented against the current source on July 30, 2026. This list distinguishes gameplay mechanics from the projectile graphics now available to the renderer.

## Status key

- **Live — distinct:** the current runtime resolves this as a genuinely ranged attack with its own basic mechanic and visual.
- **Live — Spark mechanics / distinct visual:** the named ability launches its own model, trail, motion, and impact performance, while damage and timing still use the shared `Spark` combat resolver.
- **Catalog only / visual ready:** the complete combat catalog defines the attack and its dedicated projectile is ready, but the current player class surface does not expose the mechanic.
- **AI intent / visual ready:** combat AI can select the intent and the projectile registry can render it when the execution event identifies the attack.
- **Extended-reach hit / visual ready:** the authority permits ranged reach and a specialized projectile is available, but the event must identify the attacker or ability to select it.

## Player attacks that deal damage at range

| Attack                      | Class/source                         |       Intended range | Damage/effect                                    | Current status                                                                                                                                                                                                      |
| --------------------------- | ------------------------------------ | -------------------: | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hunter Bow shot**         | Any player holding `hunter_bow`      |                   24 | Physical ranged hit; item stat `rangedAttack: 8` | **Live — distinct.** The real inventory id now maps to the bow equipment model and the combat log selects `hunter_bow_shot` (or `aimed_shot` for a heavy attack).                                                   |
| **Quick Shot**              | Ranger; bow or crossbow              |                   25 | Piercing single-target shot                      | **Catalog only / visual ready.** Thin, fast arrow with a compact white-blue wind streak.                                                                                                                            |
| **Aimed Shot**              | Ranger; bow or crossbow              |                   30 | High-damage piercing shot with a 1.5-second cast | **Catalog only / visual ready.** Oversized ornate arrow, heavy gold energy rings, and a thicker velocity trail.                                                                                                     |
| **Multi-Shot**              | Ranger; bow                          |         25-unit cone | Piercing cone attack                             | **Catalog only / visual ready.** Five individually posed arrows form a readable fan instead of one cloned silhouette.                                                                                               |
| **Spark / Spark Rank 1**    | Mage; wand, staff, or spell focus    |  24 live; 25 catalog | Arcane projectile-style hit                      | **Live — distinct.** White-purple electrical core, orbiting shards, jittering arcane flight, and spark impact.                                                                                                      |
| **Fireball**                | Mage                                 |                   30 | Fire hit plus burn                               | **Live — Spark mechanics / distinct visual.** Layered hot core, dark shell, flame voxels, ember trail, and fire-family impact.                                                                                      |
| **Meteor**                  | Mage ultimate                        |         35-unit area | Destructive falling fire attack                  | **Live — Spark mechanics / distinct visual.** Falls from above as a large lava-cracked asteroid with a long ember trail and oversized debris impact. Meteor is not present in the 51-entry complete combat catalog. |
| **Lightning Bolt**          | Mage; wand, staff, or spell focus    |                   28 | Lightning damage plus interrupt                  | **Catalog only / visual ready.** Jagged branching bolt with high-speed jitter and electric impact shards.                                                                                                           |
| **Holy Light — enemy mode** | Priest or Paladin                    |                   25 | Holy damage to an enemy; healing to an ally      | **Catalog only / visual ready.** Clean white-gold lance with halo and radiant impact rings.                                                                                                                         |
| **Smite**                   | Priest or Paladin                    | 20 catalog; 12 local | Holy single-target damage                        | **Live — Spark mechanics / distinct visual.** Radiant hammer/spear silhouette and layered holy impact.                                                                                                              |
| **Judgment**                | Paladin; sword, mace, or holy weapon |                   15 | Holy damage plus damage debuff                   | **Catalog only / visual ready.** A rune-bound blade/hammer-of-light performance. The smaller live class definition still treats Judgment as a social ability.                                                       |
| **Consecrate**              | Paladin                              |          8-unit area | Repeating holy area damage plus threat           | **Catalog only / visual ready.** Treated as a ground-targeted descending rune with a long-lived double-ring holy impact rather than a normal forward missile.                                                       |
| **Life Drain**              | Necromancer; staff or skull focus    | 20 catalog; 14 local | Channeled dark damage and self-healing           | **Live — Spark mechanics / distinct visual.** Double-helix dark projectile with impact motes directed back toward the caster; the local mechanic also heals 12.                                                     |
| **Entangling Roots**        | Druid                                | 25 catalog; 16 local | Root plus nature damage over time                | **Live — Spark mechanics / distinct visual.** Thorned root seed and radial root impact; distinct root/DoT mechanics remain catalog-only.                                                                            |
| **Mocking Verse**           | Bard; instrument or rapier           | 20 catalog; 14 local | Sonic damage plus accuracy debuff                | **Live — Spark mechanics / distinct visual.** Musical-note silhouette, oscillating flight, and multiple sound-wave impact rings.                                                                                    |
| **Curse of Weakness**       | Necromancer                          | 25 catalog; 16 local | Intended attack-power debuff                     | **Live — Spark mechanics / distinct visual.** Rotating broken curse rune and shadow trail; the local class switch still deals Spark damage rather than only applying the catalog debuff.                            |

## Hostile ranged effects that do not directly deal damage

| Effect                | Class/source | Range | Intended result                               | Current status                                                                                                                                    |
| --------------------- | ------------ | ----: | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hunter's Mark**     | Ranger       |    35 | Reduces target evasion / marks a focus target | The local class action now launches a dedicated eye/arrowhead mark visual to the selected target. Its authored evasion debuff is not yet applied. |
| **Polymorph**         | Mage         |    25 | Crowd-control transformation                  | **Catalog only / visual ready.** Wool/cloud core, tiny face, and teal transformation rune.                                                        |
| **Curse of Weakness** | Necromancer  |    25 | Reduces attack power                          | Distinct visual is live; authored control-only behavior is not.                                                                                   |
| **Fear**              | Necromancer  |    20 | Fear crowd control                            | **Catalog only / visual ready.** Horned skull silhouette with dark aura and smoke-like trail.                                                     |
| **Charm**             | Bard or Mage |    20 | Charm crowd control                           | **Catalog only / visual ready.** Heart-shaped core with pink orbit and swaying arcane flight.                                                     |

## Enemy and NPC ranged attacks

| Attack                       | User                                       |   Range | Current status                                                                                                                                                                                                                                                  |
| ---------------------------- | ------------------------------------------ | ------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bandit Hedge Archer shot** | Native ECS bandit archer                   |      12 | **Live — native Anima presentation.** The canonical combat profile carries `bandit_archer_shot`; the client launches the dirty, broken-feather arrow from the authoritative Anima attack emote.                                                                 |
| **Hex Fireball**             | Native ECS Hex / Hexer                     | 4.25–12 | **Live — native Anima attack.** Standard Hexes cast the existing authored Fireball from a fixed aim point, resolve hit or miss after flight, and wait 20 seconds before casting again. Their original 3-unit melee attack remains active inside Fireball range. |
| **Hex boss Fireball**        | Native ECS Hex bosses                      |    5–18 | **Live — native Anima attack.** Every Hex boss has Fireball on a 20-second cooldown plus a second ranged attack, with independent cooldowns and a shared 2.75-second ranged cadence.                                                                            |
| **Hex boss secondary**       | Muck-Scarred Helix / Thaedryn              |    4–18 | **Live — native Anima attack.** Muck-Scarred Helix uses `hex_bolt`; Thaedryn uses `thaedryn_resonance`. Both retain their existing melee attacks.                                                                                                               |
| **Thaedryn boss attack**     | Thaedryn the Bellbound                     |       8 | **Live — native Anima presentation.** Thaedryn's combat profile carries `thaedryn_resonance`, producing the bell fragment, orbiting shards, resonance rings, and boss-scale impact.                                                                             |
| **Ranged Shot**              | Third-party combat AI archer intent        |    4–28 | **AI intent / visual ready.** Generic ornate arrow with a distinct resolver id.                                                                                                                                                                                 |
| **Fireball**                 | Third-party combat AI caster intent        |    3–30 | **AI intent / visual ready.** Uses the same Fireball performance library entry.                                                                                                                                                                                 |
| **Root**                     | Third-party combat AI archer/caster intent |    3–22 | **AI intent / visual ready.** Aliases to the Entangling Roots projectile.                                                                                                                                                                                       |

## Generated projectile performance library

The game now ships 24 clean-room Blender-authored, animated GLBs under `public/assets/harthmere/glb/projectiles/`, 24 preview renders under `public/assets/harthmere/projectile_previews/`, and the editable master scene `src/galois/data/projectiles/harthmere_premium_projectiles.blend`. The rejected v1 generator and Blender master were deleted rather than repaired.

Each runtime projectile is a short animated performance:

- Launch flash at the weapon or caster origin.
- Readable Blender-authored core silhouette with a baked flight-loop animation.
- Lightweight instanced voxel trail whose cadence and drift reflect physical, fire, lightning, holy, dark, nature, sonic, arcane, hex, or boss identity.
- Characteristic motion such as lightning jitter, sonic oscillation, arcane/dark weave, boss corkscrew, falling Meteor, and ground-targeted Consecrate.
- Family-specific impact rings, shards, roots, sparks, smoke-colored debris, holy rays, and boss resonance waves.
- Capped dynamic projectile and impact lights for repeated-attack performance.

The GLB library totals about 0.83 MiB. The largest asset is Multi-Shot at 124,912 bytes and 11,444 triangles; the integrity test enforces a 12,000-triangle per-projectile ceiling.

## Native authority wiring

- **Native ECS player contact:** `handleAttackInteraction` emits a projectile presentation event only after the normal ECS interaction path has confirmed a valid attacked entity. The equipped native item id is reverse-mapped to its Harthmere semantic id, which selects the exact bow, crossbow, or dart projectile and supplies the contacted entity position as the visual target.
- **Anima NPC attacks:** each canonical Harthmere native NPC combat profile can carry a `projectileVisualId`. The NPC renderer launches that visual when it observes the authoritative `attack1` emote time and resolves the current native combat target position. Damage, aggro, range, and strike timing remain owned by the existing Anima/native combat path.
- **Hex ranged resolution:** Anima stores the ability id, projectile id, fixed aim point, cast time, impact time, and per-ability cooldowns in serialized NPC state. A moving target can therefore evade before impact. Hits publish optional ranged metadata through the existing native `UpdatePlayerHealthEvent`; misses publish no damage event. Native logic independently validates the authored ability, cast state, range, impact point, timing, and replay key before changing player health.
- **Gaia boundary:** projectile flights and impacts are transient presentation and none of the current 24 attacks authoritatively edits terrain. `HARTHMERE_TERRAIN_MUTATING_PROJECTILE_VISUAL_IDS` is therefore explicitly empty. Gaia should only be added when an attack gains a real server-authoritative terrain mutation.

## Ranged and magic equipment graphics

The renderer can select physical ranged equipment including `Arrow`, `Arrow_Golden`, bow/crossbow arrow bundles, `bow`, `bow_withString`, wooden/golden bows, one- and two-handed crossbows, darts, and quivers. The real Harthmere inventory item `hunter_bow` now maps to the bow visual.

Magic equipment includes `staff`, `wand`, closed/open spellbooks, four numbered book pairs, `Scroll`, crystal/star/snowflake focus props, and `smokebomb`. Their animation vocabulary includes equip, aim/draw, release, reload, nock, cast, channel, open/read, cast-from-book, throw, and burst clips.

## Remaining gameplay gaps

1. **Seven named spells still share Spark's numerical combat mechanics.** Their visuals are distinct, but Fireball, Meteor, Smite, Life Drain, Curse of Weakness, Mocking Verse, and Entangling Roots still call the Spark damage resolver.
2. **Live-mode ability range is flattened.** Abilities loaded from `HARTHMERE_ABILITY_DEFINITIONS` still use the common voxel interaction reach instead of all authored 15–35 unit ranges.
3. **The complete Ranger shot set is not on the smaller live class surface.** Quick Shot, Aimed Shot, and Multi-Shot have ready assets and resolver ids, but Rangers currently start with Basic Strike, Hunter's Mark, and Track Beast.
4. **Older systems still split `spark_rank_1` and `spark`.** The visual registry aliases both to one asset, but gameplay data would benefit from a canonical id.
5. **Legacy generic enemy events still use fallback resolution.** Native Harthmere NPCs now carry exact projectile ids through their combat profiles, but third-party events that emit only `Basic Attack` and omit attacker identity cannot select a specialized graphic.

## Source map

- Projectile registry: `src/shared/harthmere/projectile_visual_manifest.ts`.
- Projectile flight, trails, lights, and impacts: `src/client/game/renderers/local_dev/harthmere_projectiles.ts`.
- Combat-event and custom-event renderer wiring: `src/client/game/renderers/local_dev/harthmere_assets.ts`.
- Blender generator: `scripts/harthmere/generate_harthmere_premium_projectiles.py`.
- Review sheet builder: `scripts/harthmere/build-harthmere-premium-projectile-contact-sheet.py`.
- GLB and wiring integrity test: `scripts/harthmere/test-harthmere-premium-projectile-assets.cjs`.
- Current player combat bridge: `src/client/components/challenges/LocalDevHarthmereCombat.tsx`.
- Named class ability bridge: `src/client/components/challenges/LocalDevHarthmereClassSkillSystem.tsx`.
- Complete Ranger and spell catalog: `src/shared/harthmere/complete_combat_progression.ts`.
- Native ranged/spell classification, projectile identity, and enemy reach: `src/shared/harthmere/harthmere_native_combat.ts`.
- Native ECS confirmed-contact presentation bridge: `src/client/game/interact/helpers.ts`.
- Anima attack-emote presentation bridge: `src/client/game/resources/npcs.ts`.
- Live-mode range authority: `src/shared/harthmere/live_mode_backend.ts`.
- AI ranged intents: `src/shared/harthmere/third_party_combat_ai.ts`.
