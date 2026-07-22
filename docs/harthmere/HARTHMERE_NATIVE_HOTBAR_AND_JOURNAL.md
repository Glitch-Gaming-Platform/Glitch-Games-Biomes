# Native hotbar, quest journal, containers, and vitals

This document records the frontend-to-native-ECS contracts restored after the
July 22, 2026 production audit. The implementation intentionally reuses the
May 16 snapshot's existing action scripts and ECS events instead of creating a
parallel React/Redis gameplay authority.

## Hotbar action contract

A native hotbar slot contains the real ECS inventory stack. Selecting an item
updates `/hotbar/index` and publishes `InventoryChangeSelectionEvent`. Activating
the selected slot then pulses the shared `primary_hold` input. `InteractScript`
reads the selected Bikkie action and routes it to the original implementation:

- blocks/placeables: native terrain or placeable placement;
- weapons and unarmed items: native attack/destroy delegation;
- tools: destroy, till, plant, water, fertilize, fish, reveal, shape, or dye;
- magic: wand, Bikkie wand, placer/nega/despawn wand, shaper, and clipboard;
- consumables/home items: the original one-second press-and-hold channel;
- cameras and other authored actions: their existing item spec.

React must not reproduce those effects. It provides selection, input, pending
feedback, and labels only. This keeps permissions, reach, durability, damage,
inventory debit, terrain edits, and quest triggers in their native handlers.

Throw is a separate action. The visible `Throw 1` control publishes one
`InventoryThrowEvent` with `count: 1n`. Omitting the count would eject an entire
stack. A Muckwad can therefore be placed with its authored primary action or
intentionally thrown as one recoverable world drop. Native items never use the
custom live-mode/Redis drop mutation.

Local-only compatibility items are a temporary exception: food/medicine use
their existing live mutation, weapons use the compatibility combat action, and
tools invoke the same globally selected F interaction. Any item with a native
Bikkie identity always takes the native path.

## Quest journal contract

The journal shows native quests whose state is `in_progress`, plus completed
history. `available` offers remain at their NPC, board, beacon, or offer UI and
`locked` quests remain hidden. Only an active quest can be selected as main.

When a quest is projected by both native ECS and a Bible/Grove compatibility
adapter, the projections are deduplicated with
`HARTHMERE_NATIVE_QUEST_ID_MANIFEST`; the native trigger-tree projection wins.
Title matching is deliberately not used because unrelated quests can share
display text.

## Targeting and Road Ahead containers

A direct terrain hit terminates generic proximity fallbacks. A procedural
object may still be selected only when it is at approximately the same depth,
inside the facing cone, near the player's vertical level, on screen, and not
terrain-occluded. This prevents a crate or NPC behind an aimed Muckwad voxel
from displaying an unrelated F action.

Road Ahead's Clothing Crate and Billy's Toolbag remain private native
`container_inventory` entities. The stock container UI lists their exact Bikkie
contents, disables Take All while transfers are pending, waits for the exact
native quest trigger update between sequential reward items, and reports the
names/counts received. Empty private containers do not reseed.

## Vitals transport contract

The server scheduler advances stamina, breath, drowning damage, and death in
native ECS. The HUD subscribes to synchronized `health`, `trigger_state`, and
`inventory` components. Browser heartbeat requests are read-only diagnostics;
they no longer repeat the terrain scan or contend with the scheduler's player
edit. Underwater terrain lookups are coalesced briefly by exact head block.

## Focused verification

The implementation has focused coverage for:

- synthetic input composition and release;
- authored weapon/tool/magic/consumable action labels and hold durations;
- exact one-item native hotbar throws;
- world F-action priority and programmatic tool invocation;
- available/locked quest exclusion and native projection deduplication;
- close-facing and vertical object-target rejection;
- underwater lookup coalescing;
- signed WebSocket URL redaction.

Run TypeScript and focused regression checks before deployment. A deployment is
not part of this workflow and must be explicitly authorized.
