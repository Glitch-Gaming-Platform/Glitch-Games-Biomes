# NPC expression audit and dialogue transition fix

Date: 2026-08-03
Scope: the 71 cinematic expressions NPCs emote, and the blend into and out of
them during dialogue.

Measured with `scripts/harthmere/blender/audit_expression_clips.py` against
`character-animations.blend` (24 fps), cross-referenced with
`cinematic_expression_catalog.json`.

## Summary

The clips themselves are in good shape. The jank came from three defects in how
they were *scheduled and blended*, all in code:

1. the ease-in was 0.08 s — three times faster than every other animation, and
   at low frame rates a single-frame pop;
2. only the ease-in was specified, so expressions snapped on and drifted off;
3. every `once` expression was dropped the instant its clip ended, which is
   roughly a third of the way through the dialogue beat it belonged to.

All three are fixed.

## What the clips look like

70 `Cinematic*` actions matching 71 catalog entries (`CinematicCopy` serves two).
Every catalog entry resolves to a real clip — no missing animations.

| Property | Finding |
| -------- | ------- |
| Interpolation | **100% Bezier.** Zero linear, zero constant keys across all 70 clips. |
| Keyframe density | 3.0 keys/curve on short clips, 5.0 on long. None below 2.5. |
| Bones driven | **7 of the rig's 16**, uniformly. |
| Clip length | 0.58 s / 0.79 s / 1.17 s — only three distinct lengths. |
| Entry gap from idle | 0.145 - 0.225, median 0.158. Tight and consistent. |
| Loop gap (start vs end pose) | 0.000 for every looping clip. |

Two things worth calling out as genuinely good: the **entry gap is small and
uniform**, so no expression has to travel far from idle — the blend had every
chance to be smooth. And **looping clips return exactly to their start pose**
(gap 0.000), so loops are seamless.

The 7-of-16 bone coverage is a deliberate upper-body authoring choice, not a
defect: legs keep whatever the locomotion layer is doing, which is what lets an
expression play while an NPC stands or walks.

## Defect 1 — the ease-in was a pop, not a blend

`gameplayNpcExpressionAnimationAction` set `easeInTime: 0.08` while
`getSmoothedWeight`'s default for everything else is `0.25`.

Worse, the smoothing was `dw = min(1, dt / easeTime)`, which **degenerates into
a snap whenever a frame is longer than the ease time**:

| Frame rate | Old, ease 0.08 | New, ease 0.22 |
| ---------- | -------------: | -------------: |
| 14 FPS (dt 0.071) | **0.89 in one frame** | 0.28 |

At the 14 FPS captured in `battle.log`, the expression reached 89% weight in a
single frame. That is the jank, exactly.

The linear form was also frame-rate *dependent* — the same transition landed in
a different place depending on how the wall time was divided into frames:

```
old form, 0.25 s of blend:   3 steps -> 0.760    30 steps -> 0.686
new form, 0.25 s of blend:   3 steps -> 0.679    30 steps -> 0.679
```

**Fix:** `getSmoothedWeight` now uses `1 - exp(-dt / easeTime)`, the
frame-rate-independent form of the same first-order approach. It cannot
overshoot, and the weight reaches the same point after a given amount of wall
time regardless of frame rate.

## Defect 2 — the blend was asymmetric

`AnimationStatus` only had `easeInTime`. On the way *out*, `weightDiff` is
negative, so the code fell through to the 0.25 s default no matter what the
expression asked for. Expressions snapped on in 0.08 s and drifted off in
0.25 s — an asymmetry the eye reads as a glitch rather than as a performance.

**Fix:** added `easeOutTime`, plumbed it through the smoother, and gave
expressions an authored pair:

```ts
export const HARTHMERE_EXPRESSION_EASE_IN_SECS = 0.22;
export const HARTHMERE_EXPRESSION_EASE_OUT_SECS = 0.3;
```

Ease-out is slightly longer than ease-in so settling back to idle reads as the
character relaxing rather than the expression being cut off.

The cutscene path (`cutsceneNpcAnimationAction`) specified no ease at all and
inherited the generic default in both directions; it now uses the same authored
dialogue blend, so a scripted beat and an in-world line look alike.

## Defect 3 — `once` expressions ended a third of the way through the line

This is the largest finding. **Every catalog entry declares a `durationSeconds`
longer than its actual clip**, by a median factor of **2.74**:

| Expression | Clip | Playback | Declared | Actual | Ratio |
| ---------- | ---- | -------- | -------: | -----: | ----: |
| `sadness` | `CinematicSad` | once | 2.40 s | 0.58 s | **4.12** |
| `cowering` | `CinematicCower` | hold | 3.00 s | 0.79 s | 3.79 |
| `embarrassment` | `CinematicEmbarrassed` | once | 2.20 s | 0.58 s | 3.77 |
| `curiosity` | `CinematicCurious` | once | 2.00 s | 0.58 s | 3.43 |

All 28 `once` expressions are affected. The `loop` and `hold` modes already
survived the gap — `loop` repeats, `hold` clamps its final pose — but `once`
mapped to `{ kind: "once" }` with no clamp, and `accumulateAction` **removes a
finished one-shot from the accumulation as soon as the clip's own duration
elapses**.

The result: an NPC performed a 0.58 s sad gesture, returned to neutral idle, and
kept talking for another 1.8 s with no expression at all.

**Fix:** `once` now clamps its final pose. The gesture plays, the character
settles into the emotion for the rest of the beat, and the expression eases out
when the emote actually expires. That matches both what the catalog durations
imply and how gesture works in conversation — you settle into it, you do not
reset to neutral mid-sentence.

This makes `once` and `hold` behave identically at runtime. That is a real
consequence and worth a design decision later: the three modes were evidently
authored on the assumption that clips would be as long as declared. The
alternative — re-authoring 28 clips to their declared lengths — is the higher
quality fix and is recommended below.

## Deliberately not changed

Two other fast eases exist and are **combat**, not dialogue:

| Site | Ease | Why it stays fast |
| ---- | ---: | ----------------- |
| `magicCharge` | 0.08 s | Charge windup is a telegraph; it should read immediately. |
| NPC evade | 0.04 s | A reactive dodge must snap. Slowing it would undermine the i-frame readability work. |

Both still benefit from the exponential fix — at 14 FPS the old form gave them
`dw = 1.00` and `0.89`, i.e. a hard snap; they now give `0.83` and `0.59`, still
fast but continuous and frame-rate independent.

## Re-authoring the 27 one-shot clips (done)

Follow-up 1 is complete. `scripts/harthmere/blender/reauthor_once_expressions.py`
rebuilds every one-shot clip to the length its catalog entry declares.

### Why clamping alone was not enough

Inspecting the clips revealed something the duration numbers alone did not: all
27 are the *same* three-key shape — rest at frame 4, pose at frame 10, **back to
rest** at frame 18, driving 7 bones (`Waist`, `Chest`, `Head`, `L_Arm`, `R_Arm`,
`L_Thigh`, `R_Thigh`) via `rotation_quaternion` and `location`.

Because the clip's *last* key is the rest pose, the interim `clampWhenFinished`
fix was holding a **neutral** pose. It stopped the hard drop-out, but the
character still stood back up at 0.58 s. The clip itself had to carry the beat.

### Structure of the rebuilt clips

A dialogue gesture should push into the pose, overshoot, settle, and then live
there until the line ends — and it should *not* walk itself back to neutral,
because the ease-out blend owns the return to idle.

| Factor | Phase |
| -----: | ----- |
| −0.08 | anticipation — a small counter-move before the push |
| 0 → 1 | the original authored action, keys untouched |
| 1.12 | overshoot past the pose |
| 0.96 | settle back under it |
| 1.03 | a smaller second bounce |
| ~1.0 ± 0.025 | hold, with a 2.6 s breathing sine to the declared duration |

Every added key is the animator's own rest → peak delta, scaled. Nothing invents
a new axis of motion, so the result can only ever be more or less of the pose
that was authored — never a different pose.

One implementation note for anyone extending this: Blender's
`Quaternion.slerp()` rejects factors outside `[0, 1]`, which is exactly what
anticipation and overshoot need. The script converts the delta rotation to
axis-angle and scales the angle instead, which extrapolates freely in both
directions, and it flips the double cover (`dot < 0`) first so the delta takes
the short path.

### Measured result

| | Before | After |
| --- | ---: | ---: |
| Mean duration | 0.58 s | **1.80 s** (matches declared) |
| Mean keys/curve | 3.0 | **11.3** |
| Total keys added | — | 7,082 |
| Entry gap from idle | 0.146–0.158 | **unchanged** |
| Interpolation | 100% Bezier | **100% Bezier** |
| Bones driven | 7 | **7** |
| Clips ending on the pose | 0 / 27 | **21 / 27** |
| Loop/hold clips (43) | — | **untouched** |

The entry gap being unchanged matters: the blend *into* an expression is
identical, so the ease work above still applies exactly as measured.

The 6 clips that still end close to rest are ones whose authored peak is itself
near the rest pose — subtle beats like a small nod. Ending near neutral is
correct for those, not a failure.

### Shipping status — NOT yet live

Output is `src/galois/data/animations/character-animations_expressions.blend`.
**The source file is not modified, and nothing references the new file yet.**

The artifact the game loads is
`src/galois/data/animations/character-animations.gltf`
(`src/galois/js/assets/wearables.ts:59` -> `LoadGLTF("animations/character-animations.gltf")`).
That file still contains the original one-shots — confirmed by reading it
directly:

```
animations in shipping glTF: 120
  CinematicApology         0.75 s
  CinematicCurious         0.75 s
  CinematicEmbarrassed     0.75 s
  CinematicSad             0.75 s
```

**The code fix and the clips are coupled.** With the code change but the old
clips, `clampWhenFinished` holds the *rest* pose, because the old clips end at
rest. That is still better than the previous hard drop-out, but the intended
result — the character settling into the emotion for the length of the line —
only appears once the re-authored clips ship.

To complete it:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python scripts/harthmere/blender/export_expression_animations.py
```

The script backs up the current glTF to `tmp/animation_backup/` first, exports
the re-authored clips over `character-animations.gltf`, and prints the resulting
durations so the change is verifiable without opening Blender. Expect ~1.5-2.2 s
for the clips listed above; 0.75 s means the old ones shipped.

It must run `--background`, not from the interactive console: Blender's glTF
add-on reads `bpy.context.active_object` during export, which the console
context does not provide, and `temp_override` does not help because the add-on
re-reads the global context internally.

Then rebuild the client and re-run `audit_expression_clips.py` against the
result.

## Recommended follow-ups

1. **Only three clip lengths existed** (0.58 / 0.79 / 1.17 s) across 70
   expressions, and the one-shots are now driven by their declared durations
   instead. The 43 `loop`/`hold` clips still share three rhythms — `fury` and
   `yawning` should not feel the same.
2. **Hand-animate the highest-traffic expressions.** The procedural settle is a
   large improvement over a 0.58 s stub, but it is still a scaled version of one
   authored pose. The dozen expressions used most in dialogue would benefit from
   real secondary motion — weight shifts, finger and head counter-movement —
   rather than an intensity breath.
3. **Consider an additive layer for expressions.** At 7 of 16 bones they are
   already close to additive in spirit; making that explicit would let an NPC
   gesture while walking without the locomotion layer fighting the blend.

## Verification

10 static checks pass, covering: the exponential form replacing the linear one,
the old form being gone, the non-positive-ease guard, frame-rate independence
(3 steps vs 30 steps agree to within 0.001), `easeOutTime` plumbed end to end,
the authored constants, both dialogue and cutscene paths using them, and `once`
clamping.

An eleventh assertion initially failed because it searched the whole file for
`easeInTime: 0.08` and matched the magic-charge site. That was the assertion
being too broad, not a missed edit — the expression paths are clean, and the
combat value is intentional.

Client typecheck did not complete in the audit sandbox. Run before shipping:

```bash
NODE_OPTIONS=--max-old-space-size=8192 yarn tsc --noEmit --pretty false
node_modules/.bin/mocha --config .mocharc.fast.json \
  src/client/game/util/test/animation_system.test.ts
```

Expect fallout in any test asserting the old linear blend curve or the 0.08 s
expression ease; those encode the defect and should be updated.
