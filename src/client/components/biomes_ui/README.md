# BiomesUI

A redesigned, sci-fi themed UI shell for the Biomes client. Replaces the
Minecraft-looking hotbar/menus with a "temporal fracture / exotic matter
holography" aesthetic that matches the game premise. **Additive only** —
nothing in the existing UI is removed; this module composes alongside the
current `HotBar`, `BiomesTabbedPauseMenu`, `SelfInventoryScreen`, etc., so
you can adopt it per-feature.

## Why this exists

1. **The current UI looks like Minecraft.** Square voxel cells, the same
   bottom hotbar, identical inventory grid. Players said so in feedback.
2. **The lore promises something else.** Pocket dimensions, singularity
   manipulation, exotic matter, time-displaced threats. The chrome should
   sell that.
3. **The tutorial needs to highlight UI elements.** Today, the mission
   system tells the player *what* to do but the UI has no way to point
   to the *where*. A central highlight registry fixes this.
4. **All systems need a home.** Abilities, Skills, Classes, Land, Loot,
   Guilds, Banking — most of these have backend code in
   `LocalDevHarthmere*System.tsx` files, but no unified surface.

## Systems implemented

Every tab below is a real, themed surface in this module. Production
tabs are fed by Harthmere adapters; unfinished domains expose typed
adapter props so callers can wire real state before enabling them.

| Tab          | UI id              | Shortcut | Adapter wires to                                  |
|--------------|--------------------|----------|---------------------------------------------------|
| Today        | `tab.daily`        | **E**    | daily care-loop state + reward claims             |
| Inventory    | `tab.inventory`    | **I**    | `useHarthmereInventoryState()`                    |
| Abilities    | `tab.abilities`    | **B**    | `useHarthmereClassSkillState()` (abilities slice) |
| Skills       | `tab.skills`       | **K**    | `useHarthmereClassSkillState()` (skills slice)    |
| Classes      | `tab.classes`      | **Y**    | `chooseHarthmereClass()` / class definitions      |
| Land         | `tab.land`         | **L**    | scaffold — Biome plot model TBD                   |
| Loot         | `tab.loot`         | **O**    | recent inventory log entries                      |
| Guilds       | `tab.guilds`       | **G**    | `useHarthmereGuildState()`                        |
| Banking      | `tab.banking`      | **P**    | `inventory.bank` + currency totals                |
| Map & Quests | `tab.map`          | **M**    | mission state + live map marker adapter           |
| Collections  | `tab.collections`  | **C**    | existing `CollectionsScreen` data                 |
| Inbox        | `tab.inbox`        | **V**    | existing inbox notifications resource             |
| Options      | `tab.options`      | **,**    | local options + shortcut rebinder                 |

Hotbar slots 1..9 keep their existing shortcuts; the `BiomesHotbar` is a
visual replacement that delegates `onSelect`/`onUse`/`onDrop` to whatever
hotbar machinery is wired up by the host (i.e. the existing
`/hotbar/index` resource + `InventoryChangeSelectionEvent`).

## Architecture

```
biomes_ui/
├── BiomesUI.tsx              ← main shell (compose this in your top-level HUD)
├── BiomesUITypes.ts          ← TabKey + TAB_DESCRIPTORS
├── uniqueIds.ts              ← canonical id registry for every blinkable element
├── highlight/
│   ├── HighlightRegistry.ts  ← framework-agnostic pub/sub
│   ├── useBlinkTarget.ts     ← React hook
│   └── HighlightOverlay.tsx  ← <Highlightable> wrapper
├── hotbar/BiomesHotbar.tsx
├── nav/
│   ├── BiomesNav.tsx         ← tab rail (←/→ + Enter)
│   └── RovingGrid.tsx        ← keyboard-navigable slot grid primitive
├── shortcuts/BiomesShortcuts.ts
├── tabs/                     ← one component per tab
├── tutorial/
│   ├── tutorialMissionMap.ts ← step.target/step.trigger → blink cues
│   └── TutorialDirector.tsx  ← mount once; emits cues when step changes
├── theme/biomes_ui.css       ← clipped-corner glass panels, blink animations
└── __tests__/                ← Mocha + assert
```

## Highlight / blink system

Every interactive element has a `data-ui-id` attribute drawn from
`uniqueIds.ts`. Tutorial steps, quest hints, and admin tools call

```ts
requestHighlight({ uniqueId: "tab.inventory", style: "pulse", caption: "Open inventory" });
```

and the element blinks. If the element isn't mounted yet, the request is
queued and delivered as soon as it registers — no race conditions.

Styles:
- `pulse` — cyan glow (default)
- `ring`  — amber outline (warning / "go here")
- `arrow` — bobbing arrow above the element
- `shimmer` — diagonal sweep (exotic-matter feel)

## Tutorial wiring

`TutorialDirector` listens to the active mission step and looks up the
correct cues via `cuesForStep(target, trigger)`. For example, the
"Gear Up" step (`target: wardrobe, trigger: wearing`) blinks:

- `tab.inventory` (pulse — "Open inventory")
- `inventory.slot.chest` (ring — "Equip a top")
- `inventory.slot.legs`  (ring — "Equip bottoms")

The mapping lives in `tutorial/tutorialMissionMap.ts` and is verified
end-to-end by `scripts/harthmere/check-biomes-ui-tutorial-runtime.cjs`
against the live `SNAPSHOT_MISSIONS_V71` definitions.

## Keyboard navigation

- **Tab rail** (`BiomesNav`): ←/→ to move focus, Enter/Space to activate,
  Home/End to jump to first/last, direct shortcut keys to open.
- **Hotbar** (`BiomesHotbar`): 1..9 to select directly, ←/→ to shift
  selection, Enter to use, Q to drop.
- **Slot grids** (`RovingGrid` — used by Inventory, Banking vault,
  Collections, Classes): arrow keys move one cell, Home/End jump to row
  start/end, Ctrl+Home/End jump to grid corners, PageUp/Down jump 3
  rows, Enter activates.
- **Esc** closes the active tab pane.
- **Options → Tab Shortcuts** lets users rebind any tab key.

## Integration

Drop it next to the existing pause menu — they coexist:

```tsx
import { BiomesUI } from "@/client/components/biomes_ui/BiomesUI";
import { TutorialDirector } from "@/client/components/biomes_ui/tutorial/TutorialDirector";

function YourHUD() {
  const [activeTab, setActiveTab] = useState<TabKey | null>(null);
  const missionState = useSnapshotMissionStateV71();
  const currentStep = pickCurrentStep(missionState); // see TutorialDirector.tsx

  return (
    <>
      <BiomesUI
        activeTab={activeTab}
        onActiveTabChange={setActiveTab}
        hotbar={{
          slots: yourHotbarSlots,
          selectedIndex: hotbarIndex,
          onSelect: (i) => events.publish(new InventoryChangeSelectionEvent(...)),
        }}
        adapters={{
          inventory: harthmereInventoryAdapter,
          abilities: harthmereAbilitiesAdapter,
          guilds: harthmereGuildAdapter,
          daily: harthmereDailyTodoAdapter,
          map: snapshotMissionAdapter,
        }}
      />
      <TutorialDirector step={currentStep} />
    </>
  );
}
```

Nothing in the existing HUD needs to change. When you're ready to retire
the old pause menu, simply stop rendering it.

## Tests

These test layers can be run independently while iterating:

| Script | What it verifies |
|---|---|
| `node scripts/harthmere/check-biomes-ui-tutorial-targets.cjs` | Static audit — file presence, UI id declarations, tab descriptors, default shortcuts, Highlightable usage in every tab |
| `node scripts/harthmere/check-biomes-ui-highlight-registry.cjs` | Runtime — register/unregister, queued delivery, multi-target fan-out, clear, subscribe, error isolation |
| `node scripts/harthmere/check-biomes-ui-tutorial-runtime.cjs` | Runtime — every live mission step has cues, all cue ids are well-formed, captions fit |
| `node scripts/harthmere/check-biomes-ui-tabs-smoke.cjs` | Runtime — every tab renders via `renderToStaticMarkup` AND emits the expected `data-ui-id` attributes |
| `src/client/components/biomes_ui/__tests__/*.test.ts` | Mocha + assert (run via the existing test runner) |

The Today tab is the default BiomesUI tab. It reads the daily care-loop
snapshot from `/api/harthmere/live_mode_daily_state`, lets the player
claim a daily check-in plus small cozy tasks, and sends reward claims
through the live-mode care action path so gold, XP, town care, and items
come from the same state reducer as the rest of Harthmere progression.
The check-in reward is immediately available once per day. Other task
rewards stay locked until the relevant live system marks the task complete
for the day, such as the physical Jobs Board marking `jobs_board` complete
after the player opens the server-backed board.

The Map & Quests tab has focused coverage in
`src/client/components/biomes_ui/__tests__/progressionTabsNoDummy.test.tsx`
for tab classification, marker labels, geography terrain swatches,
center-player math, active minimap destination pins, quest centering,
and wheel zoom bounds. Map markers with world positions can be set as
the active destination from the marker card or the People, Buildings,
and Geography lists; the top-right minimap listens for that active pin
and renders a pulsing destination marker after the Biomes UI closes. The
standalone browser harness for click/drag/wheel interactions lives in
`MapQuestsTab.browser.test.ts` and is intentionally pending until the
repo browser bundler can mount this React tab reliably under `ts-mocha`.

## Mobile

`theme/biomes_ui.css` has breakpoints at 768px and 480px that shrink
slots and tabs. The nav rail uses `flex-wrap` so it folds onto multiple
lines on narrow screens. Touch support is inherent (every interactive
element is a `<button>`). The next step is a swipe gesture between tabs
— stub the listener in `BiomesUI.tsx`.

## What's Still Limited

- Full E2E Playwright coverage for map interactions; helper/static
  coverage exists, and the browser harness is pending until the local
  bundler can mount the tab reliably.
