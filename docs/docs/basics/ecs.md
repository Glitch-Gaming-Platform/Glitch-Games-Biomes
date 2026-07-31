---
sidebar_position: 4
---

# Entity Component System (ECS)

[ECS](https://github.com/ill-inc/biomes-game/tree/main/src/shared/ecs), or [Entity Component System](https://en.wikipedia.org/wiki/Entity_component_system), is the system Biomes uses to store **dynamic** game state. ([Bikkie](./bikkie.md) stores static definitions.)

Biomes uses a custom, or "native," ECS rather than an off-the-shelf ECS framework. It is made from:

- Python schema definitions and code generation in `ecs/`.
- Generated and hand-written TypeScript entity, component, event, table, selector, and serialization code.
- TypeScript world, replica, filtering, and logic-server integration.
- Redis data structures and Lua scripts for the authoritative transaction path.

Start with the [native ECS architecture guide](./native-ecs.md), then use the detailed guides for [components and events](../ecs/components-and-events.md), [transactions and authority](../ecs/transactions-and-authority.md), [replication and storage](../ecs/replication-and-storage.md), [migrations and upgrades](../ecs/migrations-and-upgrades.md), and [testing](../ecs/testing.md).

## ECS schemas

ECS schemas are defined in Python in [`ecs/defs.py`](https://github.com/ill-inc/biomes-game/tree/main/ecs/defs.py).

These definitions are code-genned into TypeScript definitions that live in `src/shared/ecs/gen`.

A single Entity, such as a Player or NPC, is made up of many reusable components such as an Inventory or Position. Multiple different types of Entities will share different sets of components.

In addition to data definitions, we also define:

- ECS events that players (and privileged services) may send as events to the [logic server](./server-overview)
- Selectors to select groups of components at once

## Updating schemas

Run `./b gen:ecs` to update ECS definitions after updating a schema.

Do not edit `src/shared/ecs/gen` by hand. Treat component IDs and serialized field positions as persistent compatibility identifiers, and follow the [migration checklist](../ecs/migrations-and-upgrades.md) for deployed schema changes.
