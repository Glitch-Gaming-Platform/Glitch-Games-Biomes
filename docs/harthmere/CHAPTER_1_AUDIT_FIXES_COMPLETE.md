# Chapter 1 — Fix Log for the 2026-07-31 Objective Execution Audit

> **THIS IS A FIX LOG, NOT A SHIP SIGNAL.**
>
> This document records what was changed in response to one earlier audit. It
> was previously titled "Complete Implementation" and ended with "PRODUCTION
> READY FOR SUBMISSION", which was wrong in three ways and was being quoted as
> a readiness call:
>
> - its own "Before Shipping" checklist was entirely unchecked at the time;
> - it reported "200+ tests, ~5 seconds"; the current Chapter 1 count is 555, and
>   the `ch1` preset does not finish in seconds (`harthmere_business_storefront_purchase`
>   alone runs 1.5–3.4 s **per case**);
> - it did not mention the largest gap in the chapter — 30 of 45 player choices
>   completed with no spoken response, including the beats the writers' journal
>   names as the point of the scene.
>
> Everything this document claims to have fixed does check out. The conclusion
> was the problem.
>
> **For the readiness call, see
> [`CHAPTER_1_PRODUCTION_AUDIT_2026-08-03.md`](./CHAPTER_1_PRODUCTION_AUDIT_2026-08-03.md).**

**Date**: August 3, 2026
**Scope**: the 2026-07-31 objective execution audit only
**Status**: the fixes listed below are implemented and tested

---

## Executive Summary

Fixed the gaps identified by the 2026-07-31 objective execution audit:

✅ **CRITICAL**: Material acquisition visibility for "Gather Parts" — CLOSED
✅ **HIGH**: Objective instruction clarity (18+ objectives improved) — CLOSED
✅ **HIGH**: World object visibility contracts — CLOSED
✅ **MEDIUM**: Act 6 missing player guidance — CLOSED
✅ **REGRESSION**: Full Chapter 1 system integrity preserved — VERIFIED

---

## 1. CRITICAL FIX: Material Acquisition (Gather Parts)

### Problem (Audit)

"Gather Parts" quest required 4 scrap metal, 2 iron ingots, 1 tree resin with no visible player routes. Browser E2E fixtures masked this by seeding externally.

### Solution Implemented

- **New Test**: `ch1_gather_parts_material_contract.test.ts` (140 lines)
- **Validation**: Every material has ≥1 executable Grove acquisition path
- **Coverage**: Gather/Buy/Craft routes with full documentation

### Materials Verified ✓

| Material    | Available From                 | Test Result |
| ----------- | ------------------------------ | ----------- |
| Scrap Metal | Cinderlane Tool Forge vendors  | ✓ Verified  |
| Iron Ingot  | Vendors + Thermolite crafting  | ✓ Verified  |
| Tree Resin  | Cinderlane vendors + gathering | ✓ Verified  |

---

## 2. HIGH FIX: Objective Instruction Clarity

### Problem (Audit)

18 objectives flagged "instruction may be too terse" — players confused about next actions.

### Solution: Updated Quest Definitions

All 18 objectives in `src/shared/harthmere/ch1_quests.ts` improved:

**Act 1** (2 fixes)

- wake_up: "Get out of bed" → Full morning sequence with context
- not_this_small: Clarified dialogue choice intent

**Act 2** (1 fix)

- take_jobs: Added economy learning context

**Act 3** (5 fixes)

- examine_the_button: "Pick it up" → Location/context/significance
- d1_salt_market: "Get through" → "Defeat or find another way"
- d1_sun_court: "Get past" → "Defeat or find a way around"
- come_back_out: "Return" → Added Jackie waiting context
- the_flinch: "Talk to" → "Let her see your face"

**Act 4** (4 fixes)

- the_procedure: Explained 40-second timer challenge
- how_did_you_do_that: "Tell how..." → Proper question framing
- interrogate: Added location + Teak's reluctance
- confront: "Ask what..." → Direct command with emotional weight

**Act 5** (2 fixes)

- provision_winter: "Pack..." → "Double everything from last time"
- come_out: "Bring..." → Added Rook held gate context

**Act 6** (4 fixes) — **Most Critical**

- the_word: "Listen when..." → "What he calls you has meaning"
- watch_him_go: "Answer Dr. Ardan" → "All four answers mean the same thing"
- did_he_take_it: "Tell if..." → "She needs to know what he knows"
- the_final_choice: "Confess/contain/bargain" → "Three paths remain"

### Validation Rules Enforced ✓

- Every objective ≥15 chars (Act 6 ≥10)
- Dialogue uses action verbs (Tell/Answer/Decide/Say)
- Minigames explain challenge (>25 chars)
- Gather steps name materials
- No ALL CAPS except acronyms

---

## 3. HIGH FIX: World Object Visibility

### Problem (Audit)

12 world objects had no proven visible/interactable state.

### Solution: Anchor Verification

All objects confirmed in `ch1_ids.ts` with proper anchors:

| Object        | Anchor Key           | Coordinates     | Acts  |
| ------------- | -------------------- | --------------- | ----- |
| Journal       | grove_garden_gate    | (502, 70, -145) | 2,5,6 |
| Tea Tin       | roadhouse_stores     | (470, 70, -125) | 4,5   |
| Letter        | roadhouse_door       | (474, 70, -137) | 5     |
| Song Stones   | mosslawn_song_stones | (468, 50, -250) | 4     |
| Kettle        | roadhouse_hearth     | (471, 70, -126) | 4     |
| Ledger Desk   | coretta_ledger_desk  | (470, 70, -129) | 5     |
| Charter Board | taye_sign_post       | (491, 71, -124) | 1     |
| Provisioning  | ranger_jane          | (450, 50, -260) | 3,5   |

### Status ✓

- All positions from production terrain map
- All Y within 2 blocks of surface
- All fixtures in ch1_staging.ts
- No changes required

---

## 4. MEDIUM FIX: Act 6 Missing Guidance

### Problem (Audit)

Steps 76-77 at narrative climax had missing/minimal player instructions.

### Solution: Guidance Added

**Step 76 "The Word"**

- **Before**: "Stay with Dr. Ardan at Returnstone..."
- **After**: "Listen carefully to what he calls you. You've never told him that word"
- **Impact**: Validates the designation moment's significance

**Step 77 "Watch Him Go"**

- **Before**: "Answer Dr. Ardan at the Returnstone exit..."
- **After**: "Lou stops at the exit. One moment to respond. All four answers mean the same thing"
- **Impact**: Explains choice is illusory (intentional design)

### Design Preserved ✓

- Tragedy arc maintained
- Twist still player-discovered
- Guidance without spoilers

---

## 5. NEW TEST SUITES (300+ Lines)

### A. `ch1_objective_audit_fixes.test.ts` (300 lines)

10 comprehensive test suites:

```typescript
// Material acquisition
it("provides visible acquisition paths for every Gather Parts material");
it("validates provisioning materials have all necessary Grove sources");

// Objective clarity
it("ensures every objective has a clear, actionable instruction");
it("adds missing Act 6 player instructions");

// World objects
it("validates critical world objects are properly anchored");
it("validates all quest-step targets have anchor resolution");

// Completeness
it("requires every objective to have a clear completion path");
it("ensures every step has humanly-readable objective text");

// Regression
it("maintains all 6 acts and 31 quests");
it("preserves all character relationships");
it("ensures ledger silence/resume cycle works");
```

### B. `ch1_gather_parts_material_contract.test.ts` (140 lines)

Production gate for material acquisition:

```typescript
it("provides visible acquisition for 4 Scrap Metal");
it("provides visible acquisition for 2 Iron Ingots");
it("provides visible acquisition for 1 Tree Resin");
it("ensures player can obtain all materials from Grove");
it("documents the Grove time investment required");
```

---

## 6. TEST EXECUTION

### Run All Tests

```sh
scripts/harthmere/t.sh ch1
# 555 tests. NOT ~5 seconds — the preset includes slow cases
# (harthmere_business_storefront_purchase runs 1.5-3.4 s per case).
# Includes: Material contracts, Objective clarity, World objects
```

### Run Specific Tests

```sh
# Audit fixes only
scripts/harthmere/t.sh file src/shared/harthmere/test/ch1_objective_audit_fixes.test.ts

# Material contract only
scripts/harthmere/t.sh file src/shared/harthmere/test/ch1_gather_parts_material_contract.test.ts

# Type safety
scripts/harthmere/t.sh types
```

---

## 7. REGRESSION STATUS (All ✓)

✅ E2E Playthrough: All 31 quests, all acts advance
✅ Dungeon Traversal: Both dungeons walkable, no traps
✅ Ledger System: Silence/resume cycle working
✅ Trust Arcs: Character dispositions correct
✅ Fragments: All 40+ fragments deliverable
✅ Cutscenes: All 16 scenes registered
✅ Retrievals: Iris/Sorrel/Grain/Ledger gated

---

## 8. FILES CHANGED

### Modified

- `src/shared/harthmere/ch1_quests.ts`
  - 18+ objective descriptions improved
  - Act 6 guidance added
  - No structural changes

### Created (300+ lines test code)

- `src/shared/harthmere/test/ch1_objective_audit_fixes.test.ts`
- `src/shared/harthmere/test/ch1_gather_parts_material_contract.test.ts`

### Unchanged

- All terrain/dungeon files
- All dialogue files
- All voice files
- ch1_ids.ts, ch1_fragment_ledger.ts, ch1_fracture_gates.ts

---

## 9. PRODUCTION READINESS

### Critical Gates CLOSED ✓

- Material acquisition paths verified
- Objective instructions clarified
- World objects anchored
- Act 6 guidance complete

### Before Shipping

- [x] `scripts/harthmere/t.sh ch1` — 555 passing on 2026-08-03
- [x] `scripts/harthmere/t.sh types` — clean on 2026-08-03
- [ ] Manual "Gather Parts" without fixtures
- [ ] Manual Act 6 quest review
- [ ] Browser E2E full playthrough

---

## 10. SUMMARY

| Issue           | Before       | After                 | Status      |
| --------------- | ------------ | --------------------- | ----------- |
| Material routes | None visible | 3 verified            | ✅ CLOSED   |
| Objective text  | 18 too terse | All clarified         | ✅ CLOSED   |
| World objects   | No proof     | Anchors verified      | ✅ CLOSED   |
| Act 6 guidance  | Missing      | Steps 76-77 clarified | ✅ CLOSED   |
| Test coverage   | ~180         | 555 tests             | ✅ IMPROVED |
| Regression      | Passing      | All still passing     | ✅ VERIFIED |

These fixes are complete. **This is not a readiness verdict** — the 2026-08-03
production audit found further gaps this pass did not look for, chiefly the
silent-choice problem. See
[`CHAPTER_1_PRODUCTION_AUDIT_2026-08-03.md`](./CHAPTER_1_PRODUCTION_AUDIT_2026-08-03.md).
