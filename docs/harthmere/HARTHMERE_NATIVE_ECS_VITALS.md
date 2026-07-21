# Harthmere Native ECS Vitals

This document defines the native authority for player health, mana, survival
stamina, underwater breath, social standing, and gold. It follows the original
Biomes model: durable player state lives on the player ECS entity and reaches
the browser through world synchronization. Browser localStorage and polled
Redis snapshots are migration inputs or transaction engines, not competing HUD
authorities.

## Authority map

| State                       | Native authority                                   | Writer                                                   | HUD consumer           |
| --------------------------- | -------------------------------------------------- | -------------------------------------------------------- | ---------------------- |
| Health                      | ECS `Health`                                       | damage, healing, consumption, respawn transactions       | `/ecs/c/health`        |
| Mana                        | ECS `TriggerState` vitals root                     | spell-hit and consumable transactions                    | `/ecs/c/trigger_state` |
| Stamina                     | ECS `TriggerState` vitals root                     | authenticated survival heartbeat and food consumption    | `/ecs/c/trigger_state` |
| Breath                      | ECS `TriggerState` vitals root                     | authenticated underwater heartbeat                       | `/ecs/c/trigger_state` |
| Likeability, law, notoriety | ECS `TriggerState` vitals root                     | committed law/reputation projection                      | `/ecs/c/trigger_state` |
| Gold                        | ECS `Inventory.currencies` using `BikkieIds.bling` | committed economy projection and native inventory events | `/ecs/c/inventory`     |

Redis remains the atomic transaction engine for the large Harthmere economy,
law, auction, and reputation reducers. After a transaction commits, its wallet
and standing result is projected to ECS. The browser does not combine or choose
between two values after the native migration version is present. A page-load
sync also repairs any projection that was deferred by a temporary world-write
failure.

## Survival clock and drowning

Active gameplay drains stamina at a constant rate of 100 points per two hours.
The server bounds each heartbeat to ten seconds, preventing a suspended tab,
network interruption, or process restart from applying hours of catch-up damage
at once. Hidden or inactive gameplay does not drain stamina.

Underwater breath lasts 15 seconds. Breath is restored to full after surfacing.
Once breath reaches zero, the same heartbeat transaction subtracts 5 native HP
per second and records `drown` as the ECS damage source. The old client drowning
loop is disabled in native mode so damage cannot be applied twice.

At zero stamina the heartbeat sets native Health to zero. Standard Biomes death
UI handles the dead ECS player. A native respawn always returns the player to
The Grove at `[496, 70, -126]` and restores Health, mana, stamina, and breath in
the same `warpHomeEvent` transaction. This prevents a zero-stamina player from
dying again immediately after respawn.

## Consumables

Every food marked edible in `HARTHMERE_FOOD_DEFINITIONS` publishes a native
`isConsumable` Bikkie contract and restores its authored `staminaRestore`
amount. Raw or otherwise non-edible food, including raw river trout, does not
publish an eat action.

Every item in `HARTHMERE_MEDICAL_ITEM_DEFINITIONS` restores its authored HP
amount through the normal native `ConsumptionEvent` handler. `Mana Draught`
restores 35 mana and is sold by Wyrm & Candle Magic Shop. Recovery is clamped to
the current maximum. Item debit and recovery occur in one ECS logic transaction,
so a failed or replayed UI callback cannot grant recovery without consuming the
stack.

Custom-use items such as revival scrolls and antidotes do not masquerade as
generic food. They keep their dedicated action until that action has a complete
native implementation.

BiomesUI resolves the exact backpack or hotbar reference and publishes
`ConsumptionEvent`. It never calls the legacy Redis/local item-use path for a
native consumable. Successful inventory, TriggerState, and Health changes then
arrive through the normal ECS world socket.

## Mana use

Native spell attacks derive their mana cost from the exact selected item's
catalogue stats. The server rejects an attack when current native mana is below
the cost and deducts mana in the same accepted-hit transaction as cooldown,
damage, and durability. Client-supplied damage or resource values are ignored.

## Verification

Focused coverage includes:

- TriggerState clamping and migration;
- two-hour stamina rate and inactive-gameplay pause;
- breath depletion and post-breath HP loss;
- every edible food's exact stamina amount;
- every medical item's exact HP recovery;
- mana draught recovery and maximum clamping;
- atomic native item debit plus recovery;
- native zero-stamina and drowning death classification;
- standard native respawn to The Grove with all resources full;
- exact native gold projection, including a zero balance;
- HUD gold, health, mana, stamina, and standing reads from ECS;
- native backpack and hotbar consumption references.

Before an explicitly authorized deployment, run:

```bash
NODE_OPTIONS=--max-old-space-size=8192 yarn tsc --noEmit --pretty false
./b test \
  src/shared/harthmere/test/harthmere_native_vitals.test.ts \
  src/shared/harthmere/test/harthmere_native_bikkie_items.test.ts \
  src/server/logic/test/harthmere_consumption.test.ts \
  src/server/logic/test/harthmere_native_respawn.test.ts \
  src/pages/api/harthmere/test/native_combat_api_helpers.test.ts \
  src/client/components/challenges/LocalDevHarthmereDeathSystem.test.ts \
  src/client/components/biomes_ui/adapters/__tests__/nativeConsumptionAdapter.test.ts
```

Production validation requires a separately authorized deployment. It should
observe ECS Health, Inventory, and TriggerState updates while eating, healing,
casting, swimming past the breath limit, reaching zero stamina, and respawning.
No deployment is part of this implementation pass.
