# Harthmere boss marketing screenshots

This runbook records the deterministic cutscene-based workflow for the eleven
Harthmere boss hero images. The scene source of truth is
`src/shared/cutscene/promo_scenes.ts`, in `HARTHMERE_BOSS_PROMO_SPECS`.

## Fast path

1. Use Node `24.18.1` from `.nvmrc`.
2. Run the narrow cutscene and promo-scene tests before rebuilding.
3. Before Chromium, prove host/container build identity and run the Chapter 1
   seed readback against the retained stack's Redis. Do not treat HTTP, Sync,
   lifecycle, or renderer readiness as proof that distant scenery exists.
4. Capture one representative scene from each coordinate family first:
   ordinary map, Elsewhen dungeon, runtime Underways, and open Wilds. Build a
   four-frame contact sheet and reject the setup before spending a full batch.
5. Keep one authenticated observer page warm and capture the whole group with
   `cutscenePromoBatch=boss-marketing`.
6. The capture service writes both the branded final and a `-raw.png` frame to
   `artifacts/cutscenes/` after every scene, so a late failure does not discard
   completed shots.
7. Visually inspect the saved 1920×1080 PNGs. Adjust the data table in
   `HARTHMERE_BOSS_PROMO_SPECS`, not browser camera state, then rerun only the
   affected scene with `cutscenePromo=<scene-id>&capturePersist=1`.

The authenticated batch URL can be generated in code with:

```ts
promoBatchCaptureAuthUrl("boss-marketing", "http://localhost:3000");
```

## Authored staging log

| Boss                     | Encounter scenery              | Stage position          | Camera far → near                     | FOV | Time |
| ------------------------ | ------------------------------ | ----------------------- | ------------------------------------- | --: | ---: |
| Muck-Scarred Helix       | West Muck Breach               | `232, 33, -506`         | `222, 36, -496` → `225, 35, -499`     |  30 | 0.78 |
| The Gilded Bull          | Sun Court                      | `2968, 44, -312`        | `2946, 50, -304` → `2951, 48, -307`   |  36 | 0.38 |
| The Ninth Winter         | Ash Hall                       | `3524, 65, -344`        | `3498, 70, -344` → `3505, 69, -344`   |  42 | 0.86 |
| The Failed Apprentice    | Bellward Halls — Bell Ring     | `354, 53, -313.4`       | `366, 58, -301` → `363, 56.5, -304`   |  35 | 0.73 |
| The First Choir          | Bellward Halls — Central Choir | `356, 53, -309`         | `370, 58, -295` → `367, 56.5, -298`   |  35 | 0.78 |
| The Echo-Singer          | Veins of the Wyrm — Echo Hall  | `632, 53, -318`         | `616, 59, -302` → `620, 56.5, -306`   |  36 | 0.71 |
| Vyrahel, the Vein-Keeper | Veins of the Wyrm — Spine Hall | `642, 53, -334`         | `656, 59, -350` → `653, 56.5, -346`   |  35 | 0.66 |
| Thaedryn the Bellbound   | Wyrm's Bed                     | `640, 53, -268`         | `618, 64, -240` → `623, 60, -247`     |  39 | 0.75 |
| Hex Wraith               | Gravewood Pale Muck            | `632.924, 47, 146.321`  | `620, 53, 159` → `624, 51, 155`       |  30 | 0.74 |
| Alpha Mucker             | Old Wood Muck Patch            | `648.693, 57, -455`     | `678, 66, -428` → `670, 63, -436`     |  36 | 0.72 |
| The Root-Crowned Dead    | Deep Old Wood                  | `620, 53, -505`         | `603, 60, -518` → `608, 57, -514`     |  32 | 0.80 |

### Rejected passes and mistakes

The first 2026-08-03 batch proved the pipeline but was rejected at visual QA:
four Bellward/Veins scenes used quest-marker coordinates rather than the
renderer placements in the shifted Old Well / Underways district; the two
Chapter 1 dungeon cameras crossed their arena shell axes; and several Wilds
cameras were too distant or occluded by authored trees. The corrected table
above records the renderer-space anchors and accepted sector-proof lanes so the
same coordinate mistake is not repeated.

The 2026-08-04 retained-stack batch was also rejected. The mistakes were:

- Readiness was accepted without running the authoritative Chapter 1 seed
  readback against the same retained Redis world. The audit later proved all
  49 desert and all 60 winter dungeon terrain shards were absent, so correct
  cameras could only photograph sky.
- The Underways coordinates were shifted by `+1600` from source comments even
  though the running stack explicitly had
  `BIOMES_DISABLE_HARTHMERE_EXTRA_TOWN_OFFSET=1`. Runtime environment wins over
  a historical coordinate assumption; record and test it before capture.
- A full eleven-scene batch was allowed to finish before representative visual
  QA. Future runs must inspect one ordinary-map, one Elsewhen, one Underways,
  and one Wilds frame first, then capture only after all four scenery families
  pass.
- A completed PNG is not an accepted PNG. File count, dimensions, successful
  persistence, and a healthy renderer prove the capture mechanism only. Final
  delivery requires contact-sheet inspection and explicit visual acceptance.

## Output contract

Final filenames use `biomes-harthmere-boss-<boss-id>.png`. Matching unbranded
frames use `biomes-harthmere-boss-<boss-id>-raw.png`. Do not hand-position a
browser camera for release screenshots: keeping the stage, camera, lighting,
animation beat, and filename in the registry makes the result reproducible.

The boss puppets use only the canonical `*_world.glb` assets and run in
`clientPuppet` mode with no end placements or commits. They cannot mutate
combat, quest, or world state.
