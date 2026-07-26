// HARTHMERE_WORLD_OBJECT_INSPECTABLE
//
// Harthmere's interactable world props (crates, chests, boards, posts, stakes,
// fences, tables, mirrors, dummies, rings, flags, carts, workbenches, ovens,
// wells, gates, doors, ...) render as lightweight procedural beacons rather than
// full ECS entities (see harthmere_quest_object_markers.ts). Because they
// are not ECS entities, the cursor raycast never resolves them to an
// `inspectable` overlay, so the player never sees the "F" interaction prompt.
//
// This module is the node-safe, proximity-based selector that mirrors the NPC
// talk-radius fallback (getNearbyNpcTalkInspectableOverlay): given the
// player's position/facing and a static list of labeled world-object
// candidates, it returns the single best object the player is standing in front
// of, together with the interaction the object's label resolves to. The client
// overlay system uses the result to surface the same "F" prompt + action that
// talking to an NPC or a jobs board already uses.
//
// It depends only on the object-interaction semantics (pure string logic) so it
// can be unit-tested without the client renderer.

import {
  harthmereObjectInteractionForLabel,
  isHarthmereContainerObjectLabel,
  isHarthmereNonLivingObjectLabel,
  type HarthmereObjectInteraction,
} from "@/shared/harthmere/object_interaction_semantics";

export const HARTHMERE_WORLD_OBJECT_INSPECTABLE_VERSION =
  "harthmere-world-object-inspectable" as const;

// Mirrors the NPC talk-radius tuning so objects and NPCs feel consistent.
export const HARTHMERE_WORLD_OBJECT_INSPECT_RADIUS = 6.5;
export const HARTHMERE_WORLD_OBJECT_INSPECT_CLOSE_RADIUS = 2.75;
export const HARTHMERE_WORLD_OBJECT_INSPECT_MIN_VIEW_DOT = 0.15;
export const HARTHMERE_WORLD_OBJECT_INSPECT_CLOSE_MIN_VIEW_DOT = 0.35;
export const HARTHMERE_WORLD_OBJECT_INSPECT_MAX_VERTICAL_DISTANCE = 3.5;
// Containers inside ships, ruins, and stacked structures can be physically
// close while their authored anchor sits one floor below the player's feet.
// The live ECS scan and server range check still cap interaction at eight
// metres; this only prevents the generic prompt selector from rejecting them
// before the authoritative check can run.
export const HARTHMERE_CONTAINER_INSPECT_MAX_VERTICAL_DISTANCE = 8;

export type HarthmereWorldObjectVec3 = readonly [number, number, number];

export interface HarthmereWorldObjectCandidate {
  id: string;
  label: string;
  position: HarthmereWorldObjectVec3;
  entityDescription?: string;
}

export interface HarthmereWorldObjectInspectable {
  id: string;
  label: string;
  entityDescription?: string;
  position: HarthmereWorldObjectVec3;
  interaction: HarthmereObjectInteraction;
  isContainer: boolean;
  score: number;
}

export interface HarthmereWorldObjectVisibilityInput {
  candidate: HarthmereWorldObjectCandidate;
  activeMarkerId?: string;
  activePinMarkerId?: string;
  activePinPosition?: HarthmereWorldObjectVec3;
  alwaysVisible?: boolean;
  activePinMatchRadius?: number;
}

export interface SelectHarthmereWorldObjectInspectableInput {
  playerPosition: HarthmereWorldObjectVec3;
  facingView: HarthmereWorldObjectVec3;
  candidates: readonly HarthmereWorldObjectCandidate[];
  radius?: number;
  containerRadius?: number;
  closeRadius?: number;
  minViewDot?: number;
  closeMinViewDot?: number;
  maxVerticalDistance?: number;
}

export const HARTHMERE_WORLD_OBJECT_ACTIVE_PIN_MARKER_PREFIX =
  "jobs_board_marker:" as const;
export const HARTHMERE_WORLD_OBJECT_ACTIVE_PIN_MATCH_RADIUS = 1.75;

export function harthmereWorldObjectCandidateIsVisibleForInteraction(
  input: HarthmereWorldObjectVisibilityInput
): boolean {
  if (input.alwaysVisible) {
    return true;
  }
  const id = input.candidate.id;
  if (input.activeMarkerId && input.activeMarkerId === id) {
    return true;
  }
  const pinId = input.activePinMarkerId;
  if (
    pinId &&
    (pinId === id ||
      pinId === `${HARTHMERE_WORLD_OBJECT_ACTIVE_PIN_MARKER_PREFIX}${id}`)
  ) {
    return true;
  }
  const pinPosition = input.activePinPosition;
  if (pinPosition) {
    const dx = pinPosition[0] - input.candidate.position[0];
    const dz = pinPosition[2] - input.candidate.position[2];
    const horizontalDistance = Math.hypot(dx, dz);
    const radius =
      input.activePinMatchRadius ??
      HARTHMERE_WORLD_OBJECT_ACTIVE_PIN_MATCH_RADIUS;
    return Number.isFinite(horizontalDistance) && horizontalDistance <= radius;
  }
  return false;
}

// Returns true when the label/description names a non-living, interactable world
// prop (and not a living NPC). This is the gate the client uses too, so the
// prompt only appears for the objects authored in the semantics manifest.
export function isHarthmereInspectableWorldObject(input: {
  label?: string | null;
  entityDescription?: string | null;
}): boolean {
  return isHarthmereNonLivingObjectLabel(input);
}

// Pure proximity + facing score. Lower is better. Returns undefined when the
// object is out of range or behind the player's facing direction. Identical in
// spirit to harthmereNpcTalkCandidateScoreForTest so object/NPC selection agree.
export function harthmereWorldObjectCandidateScore(input: {
  playerPosition: HarthmereWorldObjectVec3;
  facingView: HarthmereWorldObjectVec3;
  objectPosition: HarthmereWorldObjectVec3;
  radius?: number;
  closeRadius?: number;
  minViewDot?: number;
  closeMinViewDot?: number;
  maxVerticalDistance?: number;
}): number | undefined {
  const radius = input.radius ?? HARTHMERE_WORLD_OBJECT_INSPECT_RADIUS;
  const closeRadius =
    input.closeRadius ?? HARTHMERE_WORLD_OBJECT_INSPECT_CLOSE_RADIUS;
  const minViewDot =
    input.minViewDot ?? HARTHMERE_WORLD_OBJECT_INSPECT_MIN_VIEW_DOT;
  const closeMinViewDot =
    input.closeMinViewDot ?? HARTHMERE_WORLD_OBJECT_INSPECT_CLOSE_MIN_VIEW_DOT;
  const maxVerticalDistance =
    input.maxVerticalDistance ??
    HARTHMERE_WORLD_OBJECT_INSPECT_MAX_VERTICAL_DISTANCE;
  const toObjX = input.objectPosition[0] - input.playerPosition[0];
  const toObjZ = input.objectPosition[2] - input.playerPosition[2];
  const horizontalDistance = Math.hypot(toObjX, toObjZ);
  if (!Number.isFinite(horizontalDistance) || horizontalDistance > radius) {
    return undefined;
  }
  const verticalDistance = Math.abs(
    input.objectPosition[1] - input.playerPosition[1]
  );
  if (
    !Number.isFinite(verticalDistance) ||
    verticalDistance > maxVerticalDistance
  ) {
    return undefined;
  }
  const viewX = input.facingView[0];
  const viewZ = input.facingView[2];
  const viewLength = Math.hypot(viewX, viewZ);
  if (!Number.isFinite(viewLength) || viewLength <= 1e-5) {
    return undefined;
  }
  const toObjLength = Math.max(horizontalDistance, 1e-5);
  const viewDot =
    (viewX * toObjX + viewZ * toObjZ) / (viewLength * toObjLength);
  const requiredViewDot =
    horizontalDistance <= closeRadius
      ? Math.max(-1, Math.min(1, closeMinViewDot))
      : Math.max(0, minViewDot);
  if (viewDot < requiredViewDot) {
    return undefined;
  }
  // Prefer closer objects with a gentle bias toward what the player is looking
  // at, so crowded Grove prop clusters don't flicker between neighbors.
  return horizontalDistance - viewDot * 0.9;
}

export function selectNearestHarthmereWorldObjectInspectable(
  input: SelectHarthmereWorldObjectInspectableInput
): HarthmereWorldObjectInspectable | undefined {
  let best: HarthmereWorldObjectInspectable | undefined;
  for (const candidate of input.candidates) {
    const labelInput = {
      label: candidate.label,
      entityDescription: candidate.entityDescription,
    };
    if (!isHarthmereInspectableWorldObject(labelInput)) {
      continue;
    }
    const isContainer = isHarthmereContainerObjectLabel(labelInput);
    const score = harthmereWorldObjectCandidateScore({
      playerPosition: input.playerPosition,
      facingView: input.facingView,
      objectPosition: candidate.position,
      // A terrain hit in front of a chest may be the chest's own voxel shell,
      // a ship hull, or a ruin wall. Callers can keep a tight terrain-depth
      // radius for ordinary props while allowing containers to use the normal
      // interaction radius; the server still enforces its authoritative 3-D
      // range check before opening anything.
      radius: isContainer
        ? input.containerRadius ?? input.radius
        : input.radius,
      closeRadius: input.closeRadius,
      minViewDot: input.minViewDot,
      // A player can be beside, above, or nearly centered over a chest inside
      // tight geometry. At close range, containers should remain usable from
      // any facing; non-container props still require the normal front cone.
      // `-1` is intentional: zero still rejects an object directly behind the
      // current yaw. That happened at Busted's sunken chest when swimming
      // physics drifted the player one block past its anchor while the camera
      // continued to face the ship hull.
      closeMinViewDot: input.closeMinViewDot ?? (isContainer ? -1 : undefined),
      maxVerticalDistance:
        input.maxVerticalDistance ??
        (isContainer
          ? HARTHMERE_CONTAINER_INSPECT_MAX_VERTICAL_DISTANCE
          : undefined),
    });
    if (score === undefined) {
      continue;
    }
    if (best && score >= best.score) {
      continue;
    }
    const interaction = harthmereObjectInteractionForLabel(labelInput) ?? {
      kind: "inspect",
      title: "Inspect",
      toastVerb: "Inspected",
    };
    best = {
      id: candidate.id,
      label: candidate.label,
      entityDescription: candidate.entityDescription,
      position: candidate.position,
      interaction,
      isContainer,
      score,
    };
  }
  return best;
}
