# The four request boards, as one system (2026-07-29)

Fishing Board · Collective Research Board · Farming Bounties · Industrial Job
Board — restored, unified, wired into the board UI the game already has, and
scoped so each board only ever shows its own kind of work.

## What these boards actually are

A board is a `quest_giver` placeable carrying standing requests: somebody wants
N of an item and will pay for it. The player picks a request up at the board,
gathers, and hands it in at the same board.

The **Collective Research Board is the worked example**, exactly as you said —
thirteen categorised listings across fishing, farming, mining, cooking,
photography, puzzles and combat, paid in Collective Tokens. The other three are
the same machine with a narrower catalogue and a Bling payout:

| Board | Listings | Asks for | Pays |
|---|---|---|---|
| Fishing Board | 1 | fish | Bling |
| Farming Bounties | 3 | crops and forage | Bling |
| Industrial Job Board | 3 | stone, brick, bar | Bling |
| Collective Research | 13 (7 deliveries + 6 event listings) | anything | Collective Tokens |

All four are **`iced`** in the restored world, so all twenty listings were
unreachable. That is the headline fix.

## The thing that makes this system fragile

**Every Bling bounty shares its trigger ids.** All seven use the identical
`seq` (`8717089019405262`), the identical gather leaf (`4571475775082996`) and
the identical turn-in leaf (`3835519168545347`); six of the seven also share a
pick-up leaf. The Collective's listings do the same — one pick-up leaf and one
hand-over leaf for the whole board, with the gather leaf varying by *discipline*
rather than by listing.

It is safe at runtime only because trigger state is keyed per quest root and
`ChallengeClaimRewardsTrigger.findEvent` matches on `challenge === rootId` as
well as `stepId`. So **anything keyed on a leaf id alone silently merges all
seven boards' bounties into one.** `native_combat_quest_routing.ts` already
carries a scar from exactly this hazard on the combat quests.

Board identity is therefore the only thing separating a Farming bounty from an
Industrial one, and it is carried explicitly everywhere rather than derived.
Three E2E tests exist purely to hold that line:

- seven bounties sharing three leaf ids complete **independently**;
- a turn-in event for one quest does **not** settle another on the same leaf;
- a turn-in claimed at the **wrong board** is refused.

## Three listings could not be completed as authored

Kept — the listings are canon — with an explicit defect tag and a narrow repair:

1. **Fishing · Punk'd** — its reward leaf carries `rewardsList: []`, an *empty
   array*. `ChallengeClaimRewardsTrigger` indexes it, gets `undefined`, and
   grants nothing. The listing confiscated four Punkfish and paid zero.
   Repaired to the Collective's standard four-item rate.
2. **Fishing · Royal Flush** — asks for four Punkfish and takes one **Royal
   Gramma**, an item the player is never told to bring. Uncompletable unless
   they happen to be carrying one. The take now matches the ask; the authored
   value is preserved in `HARTHMERE_ROYAL_FLUSH_AUTHORED_TAKE_ITEM_ID`.
3. **Six of the seven Bling bounties open on a blank objective row** — their
   shared pick-up leaf has a `description` but no `name`. Because the id is
   shared, one projection fixes all six.

Authored *prices* are never touched, even where they are a bad deal — sixty-four
Limestone Bricks for ten Bling is the offer the snapshot makes.

## Using the board UI the game already has

The boards render through **`HarthmereJobsBoardPanel`**, the same panel the live
jobs boards use. That panel is driven entirely by a
`HarthmereJobsBoardSnapshot` plus a `boardId`, and it already scopes itself —
`getHarthmereAvailableJobsPanel` filters `openJobs` by
`job.boardId === boardId`. So the adapter's whole job is to project native ECS
quest state into that shape with the right `boardId` on every posting.

**Scoping is enforced twice, deliberately:**

1. `harthmereBoardRequestsForEntity` only ever returns the board's own
   category's catalogue, so nothing else is projected in the first place;
2. every posting carries that board's `boardId`, so the panel's own filter would
   drop a stray one anyway.

Physically, the boards are registered in `HARTHMERE_JOBS_BOARD_LOCATIONS`
alongside the live boards, which is what gives them the same interaction radius,
map marker and panel. Two things are narrowed there:

- `acceptedKinds` holds **exactly one kind** per board (`gather` for the three
  buying boards, `delivery` for research);
- a new `readOnlyRequestBoard` flag marks them as carrying authored townsfolk
  requests rather than a player posting queue. Players fill these boards; they
  do not post to them, and nothing escrows.

Research pays Collective Tokens, which are not currency, so those postings show
zero gold and carry the tokens as a reward item rather than misreporting Bling
in the gold column.

The adapter is **read-only**. Accepting and turning in happen through the native
ECS trigger engine exactly as for every other snapshot quest, so the panel
cannot drift into becoming a second quest authority.

## The Harthmere quay board

The snapshot's Fishing Board is at `[1258, 53, -80]` on the original map,
nowhere near Harthmere. Now that the Brell runs under the east bridge past
`river_dock_supply` and `dock_warehouse`, the town has a working waterfront and
nowhere to trade what comes out of it.

A second Fishing Board now stands on the quay at authored `[613, -174]` — six
voxels from the river's centreline, so it is on the bank at the water's edge,
and fourteen from the warehouse wall. It is a **distinct entity over the same
catalogue**: a request read at either board is the same quest, which is the
"all boards are connected" rule applied across the two halves of the map.

## Connecting the boards

- One shared **standing** across all four, derived from completed listings.
  Bling bounties count one each; research counts its token value, which keeps
  research prestigious without making the other three pointless.
- `harthmereOtherBoards` gives each board the other three, so a board can point
  the player onward.
- Category rules (`isFish` / `isFruit|isVegetable|isSeed` / `isBlock|isAnyStone|
  isOre|isBar|isIngot` / anything for research) gate what may ever be listed
  where. An unrecognised item fails every board except research — a board that
  accepts anything is a board with no identity.
- A pricing formula for any *future* listing: a per-board multiplier over the
  item's own sell price with a floor, so new requests are priced in the same
  currency of effort rather than by feel.

## Restoring the boards

The thaw is a data operation, added to the existing `PRODUCTION_CONTENT_SYNC`
pass: for each of the four board entities that is present, emit an update with
`iced: null`. The entities, their `quest_giver` components and all twenty
listings survive intact in the snapshot — clearing that one component is the
entire restore. The pass is idempotent; an already-thawed board simply is not in
the set.

## Engine compatibility

- **Native ECS** — no new quest authority. Listings advance through the stock
  trigger engine on the authored `challengeClaimRewards` / `inventoryHas`
  leaves; everything added here is data, a read-only projection, or a display
  fix. Daily listings relist through `QuestExecutor.canRepeat`'s own UTC-midnight
  clock rather than a second one.
- **Gaia** — the farming and fishing catalogues are satisfied by Gaia's existing
  growth and fishing simulations. The Harthmere quay board is only reachable
  because the Brell now carries real `ShardWater`.
- **Anima** — the Collective's two combat listings (`Juggment Day`, `Seedy
  Sappers`) resolve through the existing `npcKilled` firehose path and the type
  aliases already in `native_combat_quest_routing.ts`; no new combat wiring.

## Tests — 60 unit + 10 end-to-end

| File | Coverage |
|---|---|
| `native_request_boards.test.ts` (39) | board registry, restore manifest, currency per board, the shared-trigger-id hazard, catalogue integrity, both defects and their repairs, category rules incl. falsy/unknown attributes, pricing incl. negative/NaN/missing inputs, the full lifecycle, remaining-count clamping, turn-in gating, daily reset arithmetic, cross-board standing, quay board placement |
| `nativeRequestBoardAdapter.test.ts` (21) | per-board scoping (four ways, including through the panel's own filter), no leakage between boards, one accepted kind per board, status projection at every stage, token-vs-gold display, empty poster collections, quay board world-space shift |
| `native_request_board_locations.test.ts` (10) | registry seam, no disturbance to the live boards, single kind per board, read-only flag, distinct markers, snapshot positions preserved, quay board on dry land near water |
| `native_request_board_progression.test.ts` (10) | **end to end through the real trigger engine**: nothing lists before the intro quest; a board lists only its own; a full pick-up → gather → turn-in per board; a short delivery refused; seven shared-leaf bounties staying independent; a cross-quest turn-in rejected; a wrong-board claim rejected; daily relisting |

Regression: 202 tests pass across the boards, river, still-water and post-Gimme
quest suites, including the existing jobs-board suites unchanged.

## Open

- The **full `tsc`** over the client adapter's dependency graph was still
  running when I stopped it; the mocha runs compile all four files through
  ts-node and pass, and the narrow shared-module typecheck was clean earlier.
  Worth one uninterrupted run.
- The four snapshot boards' **intro quests** (`Hooked on Crafting`,
  `Botanical Bounty`, `The Silver Lining`, `Research Initiative` → `Spring
  Research`) are themselves gated behind longer authored chains I have not
  audited. Thawing the boards makes the listings reachable; whether each intro
  chain is completable in the restored world is the next thing to check.
- Two scratch test files from the water work still need deleting:
  `src/shared/harthmere/test/tmp_grove_water.test.ts` and `tmp_trough_probe.test.ts`.
