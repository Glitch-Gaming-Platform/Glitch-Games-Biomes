# Harthmere `F` Interaction Authority

This document defines the local implementation contract for every world `F`
interaction. It follows the original Biomes snapshot rule: behavior comes from
native ECS capabilities; labels and quest metadata add presentation and
consequences, but do not replace the capability.

No production deployment was performed as part of this implementation.

## Resolution order

The cursor/proximity target is resolved to one role in this order:

1. Native container or priced-container inventory.
2. Native plant harvest.
3. Native GrabBag pickup.
4. Native shop/mailbox.
5. Native crafting or cooking station.
6. Native door.
7. Native readable/sign.
8. Native outfit stand.
9. Native media, photo frame, or minigame.
10. Living NPC, robot, player, group, or build interaction.
11. Explicit authored fallback interaction.
12. Inspect-only fallback.

`quest_giver` is supplemental metadata. A crate with `quest_giver` remains a
crate; a sign remains readable; a minigame frame remains playable. Only a
living talk-capable entity enters dialogue.

All candidates register with the process-wide world-interaction dispatcher.
Exactly one candidate wins. Active selected tools use a higher explicit
priority when their `F` action is intentional. A disabled or pending winner
consumes the key, preventing an object behind it from firing. Jobs, business,
home, livestock, and authored-object proximity candidates must also be in the
player's forward cone. There is no ambient “first available” farming action.

## Road Ahead containers

The Clothing Crate and Billy's Toolbag are shared visible props that resolve to
stable player-private native ECS containers. This prevents one player from
taking another player's quest reward while retaining the stock container UI.

- The Clothing Crate seeds Mucky Top and Mucky Skirt exactly once.
- Billy's Toolbag seeds Billy's authored pick exactly once.
- Native `InventorySwapEvent` / combine handling owns every transfer.
- The server validates source identity, owner, range, slot compatibility,
  backpack capacity, and active quest step.
- The authoritative transfer advances the quest and suppresses duplicate reward
  minting.
- Empty containers never reseed. Reopen, reconnect, death, and another browser
  session observe the same ECS entity.
- `Take All` plans against the native backpack, waits for authoritative quest
  state between mutually exclusive rewards, and reports a full backpack.

## Authored fallback interactions

Some procedural Grove landmarks do not yet have a dedicated native component.
Their `read`, `repair`, `tend`, `practice`, `use`, `recover`, `check_outfit`,
`take_photo`, `open_door`, `open_gate`, and `inspect` actions use a narrow server
receipt path instead of a browser-only toast.

The server resolves the submitted object id against the authored landmark
catalog, derives the allowed interaction kind from the server label, validates
the server-read actor position, and rejects mismatched labels or roles. Repair
also validates the native selected/worn repair tool. Successful receipts are
stored in actor-owned server state; only then are local quest, jobs-board,
daily-task, animation, or toast consequences dispatched.

Native containers, plants, loot, shops, stations, and other typed capabilities
are rejected from this fallback and must use their stock native handler.

## Pending and failure behavior

Container and authored-object buttons become disabled and display an ellipsis
while waiting for authoritative confirmation. Gathering waits for the server
node result. Errors distinguish missing repair tools, range failures, and stale
or mismatched targets. A rejected request does not advance a quest or display a
success message.

## Required regression matrix

- Clothing Crate and Billy's Toolbag open container UI, never dialogue.
- Before/during/after-step Road Ahead behavior; two players; two browsers;
  take-one, Take All, store/reopen/relog; no reseed; full backpack.
- Mucky Top and Skirt equip, unequip, swap, and re-equip in either order, with
  both layers visible and the wearing quest driven by native ECS.
- Native containers, plants, GrabBags, shops, mailboxes, crafting/cooking
  stations (including stoves), doors, signs, media, minigames, outfit stands,
  NPCs, robots, players, groups, and builds keep their typed action.
- Hostiles do not talk. Visitors can view media. Boards and livestock require a
  faced target.
- Authored read/repair/tend/practice/use/photo actions mutate server state;
  spoofed role/label, remote position, and unequipped repair requests reject.
- Camera/fishing/wand/clipboard active-tool collisions, disabled winners,
  overlapping candidates, unregister/stale-target behavior, and rapid repeated
  input produce exactly one action.
