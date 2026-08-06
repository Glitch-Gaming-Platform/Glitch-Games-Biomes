# Harthmere Combat Lock-On

The desktop combat lock-on is a native-targeting aid, not a parallel damage
system. `Tab` locks the best eligible rendered combat target; pressing `Tab`
again releases it. While locked, the camera and player smoothly face the target,
W/S advance and retreat, and A/D become target-relative strafing. Under pointer
lock, the mouse wheel cycles eligible targets in screen order.

The unmodified `Tab` key is owned by the module-load combat key router, before
replacement-HUD/browser focus listeners. The React hotkey remains a fallback,
but normal production input publishes the lock state even when a panel mount is
delayed or replaced. Modified, repeated, already-prevented, and text-entry Tab
events remain untouched.

## Target choice

Candidates come from the existing rendered combat actor registries. Acquisition
scores screen-center proximity, world distance, hostility, boss priority, and
recent target continuity. The system excludes dead, missing, passive, merchant,
civilian, and out-of-range actors. It holds a target to 36 units and grants only
a 1.25-second visibility/missing grace so a dodge behind an enemy does not break
lock, while a real despawn or obstruction does.

The indicator is a small amber diamond/ring attached to the projected enemy
body. Bosses use the same single-target contract for this first version; future
multi-part boss targeting can extend the candidate model without changing Tab
or attack authority.

## Camera and attacks

The camera uses a damped target orientation and adds bounded pullback/FOV as
distance increases, keeping both the player and large enemy readable. The player
orientation follows that camera heading, so existing locomotion naturally
produces strafing. Jump, double-jump, evade, dodge, roll, basic, held-heavy,
ranged, and magic animations continue through their existing upper/lower-body
layers.

Lock-on only chooses the intended target. The selected ECS item still owns
reach, timing, damage, ammo/mana, protection, paid-release receipts, and impact
validation. A melee target outside the selected item's reach remains a miss. If
the locked target dies, despawns, or leaves range, the next valid cursor target
can still receive a buffered attack.

## Debug and tests

The rendered state is available at:

```js
window.__harthmereCombatLockOnDebug;
```

It includes `version`, `active`, `sequence`, `reason`, and the exact target
offset/entity id/label/world/screen data. Focused coverage lives in
`harthmere_combat_lock_on.test.ts`; native attack integration is covered in
`attack_destroy_delegate_item_spec.test.ts`. Real browser acceptance must follow
the lock-on/FPS section of `TESTING_FASTER.md` and prove authoritative HP rather
than accepting animation or the reticle alone.
