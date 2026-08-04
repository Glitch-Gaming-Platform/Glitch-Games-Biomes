import { npcEntity } from "@/server/spawn/spawn_npc";
import { prepareHarthmerePlayerLikeNpcForUniqueAppearance } from "@/server/harthmere/player_like_npc_cosmetics";
import type { Change, ProposedChange } from "@/shared/ecs/change";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import {
  EntityDescription,
  NpcState,
  Voice,
} from "@/shared/ecs/gen/components";
import { HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS } from "@/shared/harthmere/business_customer_npc_seed";
import { harthmereVoiceProfileForActor } from "@/shared/harthmere/npc_voice_profiles";
import {
  HARTHMERE_THREEJS_CLOTHING_CATALOG,
  type HarthmereCharacterAppearance,
  makeHarthmereNpcAppearanceConfig,
  withHarthmereAppearanceMarker,
  withHarthmereBodyAndFaceMarkers,
} from "@/shared/harthmere/voxel_faces";
import type { BiomesId } from "@/shared/ids";
import { LOCAL_DEV_HUMAN_NPC_TYPE_ID } from "@/shared/npc/bikkie";
import { HARTHMERE_BUSINESS_CUSTOMER_BEHAVIOR_VERSION } from "@/shared/npc/behavior/business_customer";
import {
  deserializeNpcCustomState,
  serializeNpcCustomState,
} from "@/shared/npc/serde";

// Standing CUSTOMER NPCs inside each business (the patrons; the owner is seeded
// separately at the counter). UNLIKE owners, customers are NOT quest_givers —
// they are talkable flavor NPCs with default dialog only. Same deterministic
// appearance generator the owners / Grove NPCs / player avatars use, so each one
// is visually distinct.

export const HARTHMERE_BUSINESS_CUSTOMER_NPC_SEED_SOURCE =
  "harthmere-business-customer-npc-seed";

let cachedPatronAppearances:
  ReadonlyMap<BiomesId, HarthmereCharacterAppearance> | undefined;

function patronAppearanceSignature(appearance: HarthmereCharacterAppearance) {
  return JSON.stringify({
    clothing: appearance.clothing,
    faceAccessory: appearance.face.accessory,
    facialHair: appearance.face.facialHair,
  });
}

export function harthmereBusinessCustomerAppearance(
  seed: (typeof HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS)[number]
) {
  if (!cachedPatronAppearances) {
    const appearances = new Map<BiomesId, HarthmereCharacterAppearance>();
    const used = new Set<string>();
    const palettes = ["earth", "forest", "river", "ember", "royal", "ash"];
    for (const [
      index,
      candidate,
    ] of HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS.entries()) {
      const torsoPalette = palettes[index % palettes.length];
      const legsPalette =
        palettes[Math.floor(index / palettes.length) % palettes.length];
      const handsId =
        Math.floor(index / 36) % 2 === 0 ? "fingerless_gloves" : "cloth_wraps";
      const base = makeHarthmereNpcAppearanceConfig({
        id: candidate.entityId,
        name: candidate.displayName,
        roleHint: `${candidate.roleTitle} (${candidate.faction})`,
        forwardAxis: "minusZ",
        source: `${HARTHMERE_BUSINESS_CUSTOMER_NPC_SEED_SOURCE}:${candidate.customerNpcId}`,
      });
      const selected: HarthmereCharacterAppearance = {
        ...base,
        clothing: {
          ...base.clothing,
          torso: HARTHMERE_THREEJS_CLOTHING_CATALOG[`${torsoPalette}_tunic`],
          legs: HARTHMERE_THREEJS_CLOTHING_CATALOG[`${legsPalette}_trousers`],
          hands: HARTHMERE_THREEJS_CLOTHING_CATALOG[handsId],
        },
      };
      const signature = patronAppearanceSignature(selected);
      if (used.has(signature)) {
        throw new Error(
          `Duplicate patron wardrobe for ${candidate.customerNpcId}`
        );
      }
      used.add(signature);
      appearances.set(candidate.entityId, selected);
    }
    cachedPatronAppearances = appearances;
  }
  const appearance = cachedPatronAppearances.get(seed.entityId);
  if (!appearance) {
    throw new Error(`Missing patron appearance for ${seed.customerNpcId}`);
  }
  return appearance;
}

function npcDialog(...lines: string[]) {
  return lines.map((line) => `<text>${line}</text>`).join("{break}");
}

function changeKindForSeed(id: BiomesId, existingIds: ReadonlySet<BiomesId>) {
  return existingIds.has(id) ? "update" : "create";
}

function proposedFromChange(change: Change): ProposedChange {
  if (change.kind === "delete") {
    return { kind: "delete", id: change.id };
  }
  if (change.kind === "create") {
    return { kind: "create", entity: change.entity };
  }
  return { kind: "update", entity: change.entity };
}

export function harthmereBusinessCustomerNpcSeedEntityIds() {
  return HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS.map((seed) => seed.entityId);
}

export function buildHarthmereBusinessCustomerNpcSeedChanges(input: {
  tick: number;
  nowSeconds?: number;
  existingIds?: ReadonlySet<BiomesId>;
}): Change[] {
  const existingIds = input.existingIds ?? new Set<BiomesId>();
  const nowSeconds = input.nowSeconds ?? secondsSinceEpoch();
  const changes: Change[] = [];

  for (const seed of HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS) {
    const kind = changeKindForSeed(seed.entityId, existingIds);
    const appearance = harthmereBusinessCustomerAppearance(seed);
    const base = prepareHarthmerePlayerLikeNpcForUniqueAppearance(
      npcEntity(
        {
          id: seed.entityId,
          typeId: LOCAL_DEV_HUMAN_NPC_TYPE_ID,
          position: seed.position,
          orientation: seed.orientation,
          velocity: [0, 0, 0],
          displayName: seed.displayName,
          defaultDialog: npcDialog(seed.line, ...seed.extraLines),
        },
        nowSeconds
      ),
      kind
    );
    const customState = deserializeNpcCustomState(undefined);
    customState.businessCustomer = {
      version: HARTHMERE_BUSINESS_CUSTOMER_BEHAVIOR_VERSION,
      sessionId: `persistent:${seed.outpostId}`,
      ticketId: seed.customerNpcId,
      outpostId: seed.outpostId,
      businessType: seed.businessType,
      actorEntityId: seed.entityId,
      phase: "patron_wandering",
      reaction: "neutral",
      entrance: seed.position,
      queueTarget: seed.position,
      customer: seed.position,
      staff: seed.position,
      departure: seed.position,
      // Ambient patrons are set dressing, not shift customers. Keep each one
      // at its authored spot instead of sending every patron around the same
      // building-corner loop when Anima starts.
      waypoints: [seed.position],
      waypointIndex: 0,
      lastPhaseChangedAtSeconds: nowSeconds,
    };
    // HARTHMERE_BUSINESS_NPC_PLAYER_AVATAR_PARITY: drop the uniform default
    // appearance_component/wearing npcEntity assigns to the player-like human.
    // Explicit nulls on updates repair already-seeded customers; omission alone
    // only works for brand-new entities. Each customer then renders from per-id
    // rich-appearance fallback (snapshotRichNpc*Fallback) — a distinct,
    // clothed, animated PLAYER/Grove-style avatar matching the rest of the cast,
    // instead of an identical default avatar (or the wrong voxel NPC design).
    const entity = {
      ...base,
      npc_state: NpcState.create({
        data: serializeNpcCustomState(customState),
      }),
      entity_description: EntityDescription.create({
        text: withHarthmereAppearanceMarker(
          withHarthmereBodyAndFaceMarkers(
            seed.description,
            appearance.face,
            appearance.body
          ),
          appearance
        ),
      }),
      voice: Voice.create({
        voice: harthmereVoiceProfileForActor({
          source: "business_customer",
          id: seed.customerNpcId,
          entityId: seed.entityId,
          displayName: seed.displayName,
          role: seed.roleTitle,
          kind: "humanoid",
          background: seed.background,
        }).voiceParameterId,
      }),
    };
    changes.push({
      kind,
      tick: input.tick,
      entity,
    });
  }

  return changes;
}

export function buildHarthmereBusinessCustomerNpcSeedProposedChanges(input: {
  nowSeconds: number;
  existingIds?: ReadonlySet<BiomesId>;
}): ProposedChange[] {
  return buildHarthmereBusinessCustomerNpcSeedChanges({
    tick: 1,
    nowSeconds: input.nowSeconds,
    existingIds: input.existingIds,
  }).map(proposedFromChange);
}
