"""Re-author the one-shot expression clips to their declared dialogue lengths.

    exec(open('/Users/devindixon/Development/biomes-game/scripts/harthmere/blender/reauthor_once_expressions.py').read())

WHY
---
All 27 `once` clips are the same shape: three keys at frames 4/10/18 forming a
rest -> pose -> rest arc lasting 0.583 s, while their catalog entries declare
2.0-2.4 s. Two consequences:

  * the gesture ended roughly a third of the way through its dialogue beat;
  * because the clip's LAST key is the rest pose, clamping the final frame (the
    interim fix in `cinematic_expressions.ts`) holds a neutral pose. It stops the
    hard drop-out but the character still stands back up at 0.58 s.

So the clip itself has to carry the beat. A dialogue gesture should push into
the pose, overshoot slightly, settle, and then LIVE there — breathing — until
the line ends. It should not walk itself back to neutral; the ease-out blend
owns the return to idle.

METHOD
------
Every added key is a slerp along the animator's own rest -> peak axis with a
varying factor. Nothing invents a new axis of motion, so the result can only be
more or less of the pose the animator authored, never a different pose. That
also keeps quaternions normalised for free.

  factor  phase
  -0.08   anticipation, a small counter-move before the push
   0..1   the original authored action (untouched keys)
   1.12   overshoot past the pose
   0.96   settle back under it
   1.03   a smaller second bounce
   ~1.0   hold, with a +/-0.025 breathing sine until the declared duration

SAFETY
------
Writes `character-animations_expressions.blend` next to the source and never
overwrites it. Re-run `audit_expression_clips.py` against the output to confirm.
"""

import json
import math
import os

import bpy
from mathutils import Quaternion

REPO = "/Users/devindixon/Development/biomes-game"
SRC = os.path.join(REPO, "src/galois/data/animations/character-animations.blend")
OUT_BLEND = os.path.join(
    REPO, "src/galois/data/animations/character-animations_expressions.blend"
)
CATALOG = os.path.join(REPO, "src/shared/cutscene/cinematic_expression_catalog.json")
REPORT = os.path.join(REPO, "tmp", "reauthor_once_expressions.json")

ANTICIPATION_FACTOR = -0.08
OVERSHOOT_FACTOR = 1.12
SETTLE_UNDER_FACTOR = 0.96
SECOND_BOUNCE_FACTOR = 1.03
BREATH_AMPLITUDE = 0.025
BREATH_PERIOD_SECONDS = 2.6
# Seconds after the authored peak for each settle beat.
ANTICIPATION_LEAD = 0.10
OVERSHOOT_AT = 0.13
SETTLE_AT = 0.30
BOUNCE_AT = 0.46
HOLD_FROM = 0.60
BREATH_KEY_INTERVAL = 0.22


def fcurves_of(action):
    legacy = getattr(action, "fcurves", None)
    if legacy is not None:
        return list(legacy)
    out = []
    for layer in getattr(action, "layers", []) or []:
        for strip in getattr(layer, "strips", []) or []:
            for bag in getattr(strip, "channelbags", []) or []:
                out.extend(bag.fcurves)
    return out


def channel_groups(action):
    """Group fcurves by (data_path) so quaternions stay together."""
    groups = {}
    for fc in fcurves_of(action):
        groups.setdefault(fc.data_path, {})[fc.array_index] = fc
    return groups


def sample(fc, frame):
    return fc.evaluate(frame)


def set_key(fc, frame, value):
    kp = fc.keyframe_points.insert(frame, value, options={"FAST"})
    kp.interpolation = "BEZIER"
    kp.handle_left_type = "AUTO_CLAMPED"
    kp.handle_right_type = "AUTO_CLAMPED"
    return kp


def rebuild(action, target_seconds, fps):
    start, end = action.frame_range
    groups = channel_groups(action)
    if not groups:
        return None

    # The authored arc is rest(start) -> peak(mid) -> rest(end). Find the middle
    # key rather than assuming frame 10, so a differently-keyed clip still works.
    key_times = sorted(
        {round(kp.co[0], 3) for fc in fcurves_of(action) for kp in fc.keyframe_points}
    )
    if len(key_times) < 3:
        return None
    peak_frame = key_times[len(key_times) // 2]

    target_frames = target_seconds * fps
    peak_offset = peak_frame - start
    # The tail runs from the peak to the end of the declared duration.
    tail_end = start + target_frames

    beats = [
        (peak_frame - ANTICIPATION_LEAD * fps, ANTICIPATION_FACTOR, "anticipation"),
        (peak_frame + OVERSHOOT_AT * fps, OVERSHOOT_FACTOR, "overshoot"),
        (peak_frame + SETTLE_AT * fps, SETTLE_UNDER_FACTOR, "settle"),
        (peak_frame + BOUNCE_AT * fps, SECOND_BOUNCE_FACTOR, "bounce"),
    ]
    hold_start = peak_frame + HOLD_FROM * fps

    added = 0
    for path, comps in groups.items():
        indices = sorted(comps)
        is_quat = path.endswith("rotation_quaternion") and len(indices) == 4

        rest_vals = [sample(comps[i], start) for i in indices]
        peak_vals = [sample(comps[i], peak_frame) for i in indices]

        if is_quat:
            q_rest = Quaternion(rest_vals)
            q_peak = Quaternion(peak_vals)
            q_rest.normalize()
            q_peak.normalize()
            # Quaternion double cover: q and -q are the same orientation, so
            # take whichever sign gives the short path before measuring delta.
            if q_rest.dot(q_peak) < 0.0:
                q_peak = Quaternion([-c for c in q_peak])
            q_delta = q_rest.inverted() @ q_peak

            def at(factor, qr=q_rest, qd=q_delta):
                # `Quaternion.slerp()` refuses factors outside [0,1], which is
                # exactly what anticipation (-0.08) and overshoot (1.12) need.
                # Scaling the delta rotation's angle in axis-angle form gives
                # the same curve and extrapolates freely in both directions.
                axis, angle = qd.to_axis_angle()
                scaled = Quaternion(axis, angle * factor)
                return list((qr @ scaled).normalized())

        else:

            def at(factor, r=rest_vals, p=peak_vals):
                return [r[i] + (p[i] - r[i]) * factor for i in range(len(r))]

        # Drop authored keys after the peak: the old return-to-rest is replaced
        # by the settle-and-hold tail.
        for i in indices:
            fc = comps[i]
            for kp in [k for k in fc.keyframe_points if k.co[0] > peak_frame + 1e-4]:
                try:
                    fc.keyframe_points.remove(kp, fast=True)
                except Exception:
                    pass
            fc.update()

        for frame, factor, _label in beats:
            if frame <= start:
                continue
            vals = at(factor)
            for n, i in enumerate(indices):
                set_key(comps[i], frame, vals[n])
                added += 1

        # Hold with a breathing sine so the pose stays alive rather than frozen.
        frame = hold_start
        step = BREATH_KEY_INTERVAL * fps
        while frame <= tail_end + 1e-6:
            phase = (frame - hold_start) / (BREATH_PERIOD_SECONDS * fps)
            factor = 1.0 + BREATH_AMPLITUDE * math.sin(2.0 * math.pi * phase)
            vals = at(factor)
            for n, i in enumerate(indices):
                set_key(comps[i], frame, vals[n])
                added += 1
            frame += step

    return {
        "peak_frame": round(peak_frame, 2),
        "old_end": round(end, 2),
        "new_end": round(tail_end, 2),
        "old_seconds": round((end - start) / fps, 3),
        "new_seconds": round((tail_end - start) / fps, 3),
        "keys_added": added,
    }


def main():
    catalog = json.load(open(CATALOG))
    targets = {}
    for name, spec in catalog.items():
        if spec["playback"] != "once":
            continue
        # If two entries share a clip, author to the longer declared beat.
        targets[spec["clip"]] = max(
            targets.get(spec["clip"], 0.0), float(spec["durationSeconds"])
        )

    bpy.ops.wm.open_mainfile(filepath=SRC, load_ui=False)
    fps = bpy.context.scene.render.fps / max(1, bpy.context.scene.render.fps_base)

    report = []
    for clip, seconds in sorted(targets.items()):
        action = bpy.data.actions.get(clip)
        if not action:
            report.append({"clip": clip, "error": "missing"})
            continue
        try:
            info = rebuild(action, seconds, fps)
            if info is None:
                report.append({"clip": clip, "error": "unexpected key layout"})
                continue
            info.update(clip=clip, declared=seconds)
            report.append(info)
            print(
                f"  {clip:28} {info['old_seconds']:.2f}s -> {info['new_seconds']:.2f}s "
                f"(declared {seconds:.2f})  +{info['keys_added']} keys"
            )
        except Exception as exc:
            report.append({"clip": clip, "error": repr(exc)})
            print(f"  {clip:28} FAILED {exc!r}")

    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND, copy=True)
    os.makedirs(os.path.dirname(REPORT), exist_ok=True)
    with open(REPORT, "w") as fh:
        json.dump({"fps": fps, "clips": report}, fh, indent=2)

    ok = [r for r in report if "error" not in r]
    print(f"\nre-authored {len(ok)}/{len(report)} once clips")
    print("wrote", OUT_BLEND)
    print("wrote", REPORT)


main()
