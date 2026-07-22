# Glitch Behavioral Tracking Audit

Audit date: 2026-07-22

Reference: the supplied “Glitch Reports Code - Behavioral Events and Funnels LLM Integration Context” for Biomes title `42de534c-600f-4228-af9e-b69faef94cce`.

## Contract alignment

The runtime sender follows the documented single-event route:

- `POST /titles/42de534c-600f-4228-af9e-b69faef94cce/events`
- `game_install_id`, `step_key`, and `action_key` are always present.
- `step_label`, `step_description`, `event_label`, and `event_description` are sent at the top level.
- `previous_step_key` is sent when the player transitions between steps.
- Context is placed in `metadata`; raw player-authored control text is not collected.
- The Title Token remains in the server proxy. The shipped client does not use an admin JWT or the admin-only bulk route.

The event catalog enforces the documented limits: machine keys are normalized to at most 100 characters, labels to 255 characters, and descriptions to 2,000 characters.

## Coverage

Behavior tracking now covers four complementary sources:

1. Game lifecycle and onboarding: boot, Glitch sign-in, loading, name entry, character creation, wake-up, world entry, first movement, session visibility, and exit.
2. All 64 logical client behaviors published through `GardenHose`, including inventory, movement, building, gathering, quests, crafting, shops, social/photo actions, travel, combat, minigames, mail, world interactions, and tutorial practice.
3. All 46 live-mode mutation kinds have an explicit policy; 44 player-facing kinds emit telemetry. Attack, ability-cast, loot-roll, and environmental-damage telemetry is sampled to control volume, while every failure is retained. The two autonomous NPC and boss tick kinds are intentionally excluded because they are server automation rather than player behavior.
4. 20 persisted Harthmere state signals covering inventory, economy, dialogue, quests, missions, combat, leveling, class progression, building, gathering, guilds, quest economy, reputation, storage/mail recovery, trade/auction, multiplayer combat, food/stamina, companions, and companion quests.

The live-action manifest is typed as an exhaustive `Record<HarthmereLiveModeActionKind, ...>`. Adding a new server-supported action kind now fails type checking until its tracking policy and business-facing text are defined. GardenHose coverage uses the same exhaustive pattern.

## Human-readable definitions

The Glitch docs state that display text is canonical per `step_key` and `action_key`. The audit corrected the previous live-mutation behavior that reused `attempt`, `success`, and `fail` while sending operation-specific event labels. Those generic action keys now always resolve to stable labels and descriptions; operation-specific wording lives in the step fields.

Unknown future keys still receive deterministic humanized labels and descriptions, including acronym handling for AI, API, ID, NPC, NUX, PvP, UI, and XP.

## Dashboard funnels

`HARTHMERE_GLITCH_DASHBOARD_FUNNELS` defines admin-ready request bodies using ordered `step_key` objects with labels and descriptions, as required by `POST /behavioral-funnels`:

- New Player Onboarding
- First Quest Completion
- First Craft
- First Vendor Transaction
- Death and Recovery

These definitions are exposed through `window.__harthmereGlitchTelemetry.dashboardFunnels` for developer inspection. They are not created by the game client because the documented funnel-creation route requires an admin JWT.

## Guardrails

`harthmere_glitch_tracking_manifest.test.ts` verifies that:

- all GardenHose and persisted-state behaviors resolve non-empty human-readable labels;
- every live action kind has an explicit policy;
- only autonomous NPC/boss ticks are excluded from player behavior analytics;
- shared action labels remain canonical across steps; and
- every dashboard funnel contains at least two labeled `step_key` stages.
