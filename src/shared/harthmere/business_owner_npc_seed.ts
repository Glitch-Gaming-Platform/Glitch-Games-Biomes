import type { BiomesId } from "@/shared/ids";
import type { Vec2, Vec3 } from "@/shared/math/types";
import {
  HARTHMERE_BUSINESS_OUTPOSTS,
  HARTHMERE_BUSINESS_OUTPOST_SAFE_SITES,
} from "@/shared/harthmere/business_customer_simulator";
import { SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE } from "@/shared/harthmere/snapshot_grove_content";

// HARTHMERE_BUSINESS_OWNER_NPC_SEED
//
// The 19 outpost businesses were placed on the map with owner NPC ids referenced
// by the economy / jobs board, but no owner NPC entity was ever seeded — so the
// shops stood empty. This module is the canonical data for one unique, named
// owner NPC per business, modeled on the Snapshot Grove NPC pattern (deterministic
// id, authored name/role/dialog, grounded position) but placed inside each
// business's building footprint. The server seed builder
// (`buildHarthmereBusinessOwnerNpcSeedChanges`) turns these into ECS NPCs with
// unique generated appearances.

export const HARTHMERE_BUSINESS_OWNER_NPC_SEED_VERSION =
  "harthmere-business-owner-npc-seed" as const;

// Offset range reserved for business owners. Grove NPCs use 9301+, robot
// sentinels 9401+, and the 100 ambient muck monsters 9451–9550, so 9601+ is a
// clear, non-overlapping band for the 19 owners.
export const HARTHMERE_BUSINESS_OWNER_NPC_ID_OFFSET_BASE = 9601;

export interface HarthmereBusinessOwnerNpcSeed {
  ownerNpcId: string;
  outpostId: string;
  businessType: string;
  businessName: string;
  displayName: string;
  roleTitle: string;
  idOffset: number;
  entityId: BiomesId;
  position: Vec3;
  orientation: Vec2;
  line: string;
  extraLines: string[];
  description: string;
}

interface OwnerCopy {
  displayName: string;
  roleTitle: string;
  line: string;
  extra: string;
}

// Authored, human-readable copy for each owner. Keyed by ownerNpcId so it stays
// matched to the outpost definitions regardless of array order.
const HARTHMERE_BUSINESS_OWNER_COPY: Readonly<Record<string, OwnerCopy>> = {
  npc_outpost_ashline_foreman: {
    displayName: "Foreman Calla Ashe",
    roleTitle: "Refinery Foreman",
    line: "Welcome to the Containment Works. Mind the cold bins — exotic matter bites.",
    extra: "Sort sealed raw matter for me and the pay is good, safety rating better.",
  },
  npc_outpost_anchorwright: {
    displayName: "Anchorwright Doran Vell",
    roleTitle: "Anchor Repair Lead",
    line: "If a biome anchor is drifting, I'm the one who pins it back down.",
    extra: "Bring me a bent anchor brace and I'll show you how the repair rig works.",
  },
  npc_outpost_glassyard_designer: {
    displayName: "Designer Mira Glass",
    roleTitle: "Biome Designer",
    line: "Every biome you see was drawn on a table like this one first.",
    extra: "Sketch a planting plan with me and you'll earn your first design fee.",
  },
  npc_outpost_redoubt_captain: {
    displayName: "Captain Bren Holt",
    roleTitle: "Security Captain",
    line: "Contracts for guards, walls, and ward stones — all signed here at the Redoubt.",
    extra: "Run a patrol loop for me and I'll vouch you to the bigger jobs.",
  },
  npc_outpost_eastgate_operator: {
    displayName: "Operator Saff Lin",
    roleTitle: "Portal Operator",
    line: "Step lively — the Eastgate portals only hold a charge so long.",
    extra: "Help me align a transit ring and you'll learn the safe-jump checklist.",
  },
  npc_outpost_southplot_grower: {
    displayName: "Grower Pell Soren",
    roleTitle: "Rare Foods Grower",
    line: "Southplot grows what other plots can't. Careful where you step.",
    extra: "Harvest a rare crop row with me and a share of the basket is yours.",
  },
  npc_outpost_cinderlane_smith: {
    displayName: "Smith Goran Ember",
    roleTitle: "Tool Smith",
    line: "Hot forge, sharp tools. Tell me what you're building and I'll fit the steel.",
    extra: "Pump the bellows through a heat and I'll teach you a blade's temper.",
  },
  npc_outpost_moonstall_warder: {
    displayName: "Warder Iselle Moon",
    roleTitle: "Ward Keeper",
    line: "Wards, charms, and quiet magic. The Moonstall keeps the dark polite.",
    extra: "Charge a ward stone with me and you'll carry your first charm home.",
  },
  npc_outpost_westtrail_guide: {
    displayName: "Guide Tamsin Roe",
    roleTitle: "Trail Guide",
    line: "Lost? Sit at the Guide Table. I've walked every trail worth walking.",
    extra: "Mark a safe route with me and the map fee is yours.",
  },
  npc_outpost_keylot_builder: {
    displayName: "Builder Hadrin Kael",
    roleTitle: "Property Builder",
    line: "You want a home of your own? Keylot turns empty plots into deeds.",
    extra: "Stake out a plot with me and I'll cover the first foundation course.",
  },
  npc_outpost_brightcart_trader: {
    displayName: "Trader Odette Bright",
    roleTitle: "General Trader",
    line: "If it can be bought or sold, the Brightcart has a price for it.",
    extra: "Run a delivery cart for me and you'll keep a cut of the trade.",
  },
  npc_outpost_ridgecooler_hunter: {
    displayName: "Hunter Marl Ridge",
    roleTitle: "Wild-Meat Hunter",
    line: "Fresh meat, hung cold in the Larder. The wilds pay if you're patient.",
    extra: "Track a beast with me and I'll split the kill and the coin.",
  },
  npc_outpost_greenlamp_doctor: {
    displayName: "Doctor Hana Greenlamp",
    roleTitle: "Clinic Doctor",
    line: "Hurt? Sit down. The Greenlamp patches what the wilds tear up.",
    extra: "Restock my clinic shelves and I'll teach you a field dressing.",
  },
  npc_outpost_returnstone_keeper: {
    displayName: "Keeper Eli Stonewell",
    roleTitle: "Returnstone Keeper",
    line: "Set your return here and you'll always have a way home.",
    extra: "Help me attune a Returnstone pad and you'll bind your first anchor.",
  },
  npc_outpost_clearbarrel_boss: {
    displayName: "Boss Greta Clearbarrel",
    roleTitle: "Cleanup Boss",
    line: "Someone has to haul the muck and waste out. That someone is us.",
    extra: "Clear a cleanup route with me and the hazard pay is good.",
  },
  npc_outpost_hingehall_fixer: {
    displayName: "Fixer Tomas Hinge",
    roleTitle: "Repair Fixer",
    line: "Broken hinge, busted rig, jammed door — bring it to Hingehall.",
    extra: "Fix a busted fixture with me and you'll learn the repair bench.",
  },
  npc_outpost_redpot_cook: {
    displayName: "Cook Bessa Redpot",
    roleTitle: "Kitchen Cook",
    line: "Hot food, fast service. The Redpot never lets a traveler go hungry.",
    extra: "Work the service line with me and you'll eat on the house.",
  },
  npc_outpost_stampspur_dispatcher: {
    displayName: "Dispatcher Nyle Stampspur",
    roleTitle: "Courier Dispatcher",
    line: "Parcels in, parcels out. Stampspur keeps the roads moving.",
    extra: "Carry a dispatch run for me and the courier fee is yours.",
  },
  npc_outpost_lanternrest_host: {
    displayName: "Host Wren Lanternrest",
    roleTitle: "Inn Host",
    line: "A warm bed and a lit lantern. Rest easy at the Lanternrest.",
    extra: "Help me ready the rooms and you'll always have a bunk here.",
  },
};

function entityIdFromOffset(idOffset: number): BiomesId {
  return (Number(SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE) + idOffset) as BiomesId;
}

// Place the owner at the center of the building footprint so it always stands
// inside the shop, on the building's ground level.
function ownerPositionForSafeSite(site: {
  groundY: number;
  footprint: { xMin: number; xMax: number; zMin: number; zMax: number };
}): Vec3 {
  return [
    (site.footprint.xMin + site.footprint.xMax) / 2,
    site.groundY,
    (site.footprint.zMin + site.footprint.zMax) / 2,
  ];
}

export const HARTHMERE_BUSINESS_OWNER_NPC_SEEDS: readonly HarthmereBusinessOwnerNpcSeed[] =
  HARTHMERE_BUSINESS_OUTPOSTS.map((outpost, index) => {
    const site = HARTHMERE_BUSINESS_OUTPOST_SAFE_SITES.find(
      (candidate) => candidate.outpostId === outpost.outpostId
    );
    const copy = HARTHMERE_BUSINESS_OWNER_COPY[outpost.ownerNpcId];
    if (!site) {
      throw new Error(
        `Missing business outpost safe site for ${outpost.outpostId}`
      );
    }
    if (!copy) {
      throw new Error(
        `Missing business owner copy for ${outpost.ownerNpcId} (${outpost.outpostId})`
      );
    }
    const idOffset = HARTHMERE_BUSINESS_OWNER_NPC_ID_OFFSET_BASE + index;
    return {
      ownerNpcId: outpost.ownerNpcId,
      outpostId: outpost.outpostId,
      businessType: outpost.businessType,
      businessName: outpost.displayName,
      displayName: copy.displayName,
      roleTitle: copy.roleTitle,
      idOffset,
      entityId: entityIdFromOffset(idOffset),
      position: ownerPositionForSafeSite(site),
      orientation: [0, Number(outpost.position.rot) || 0] as Vec2,
      line: copy.line,
      extraLines: [copy.extra],
      description: `${copy.displayName}, ${copy.roleTitle} of ${outpost.displayName}.`,
    } satisfies HarthmereBusinessOwnerNpcSeed;
  });

export function harthmereBusinessOwnerNpcSeedIds(): BiomesId[] {
  return HARTHMERE_BUSINESS_OWNER_NPC_SEEDS.map((seed) => seed.entityId);
}

// HARTHMERE_DELIVERY_RECIPIENT: stable map-marker id for a business owner,
// so a delivery job can point at a specific owner and the marker system resolves
// their in-shop position.
export function harthmereBusinessOwnerMarkerId(ownerNpcId: string): string {
  return `harthmere_owner:${ownerNpcId}`;
}

// Resolve a business owner seed by ownerNpcId, owner marker id, or entity id —
// the three forms a delivery recipient might be referenced by. Returns undefined
// for any unknown/blank input so callers can fall back to a place recipient.
export function harthmereBusinessOwnerSeedByRef(
  ref: string | number | undefined
): HarthmereBusinessOwnerNpcSeed | undefined {
  if (ref === undefined || ref === null || ref === "") {
    return undefined;
  }
  const asString = String(ref);
  const markerOwnerNpcId = asString.startsWith("harthmere_owner:")
    ? asString.slice("harthmere_owner:".length)
    : undefined;
  return HARTHMERE_BUSINESS_OWNER_NPC_SEEDS.find(
    (seed) =>
      seed.ownerNpcId === asString ||
      seed.ownerNpcId === markerOwnerNpcId ||
      Number(seed.entityId) === Number(ref)
  );
}

const HARTHMERE_BUSINESS_OWNER_ENTITY_ID_SET = new Set<number>(
  HARTHMERE_BUSINESS_OWNER_NPC_SEEDS.map((seed) => Number(seed.entityId))
);

// Business owners stand on a building FLOOR under a roof, so terrain grounding
// must NOT require open sky for them (that would push them onto the roof).
export function isHarthmereBusinessOwnerNpcEntityId(
  id: BiomesId | number | undefined
): boolean {
  return id !== undefined && HARTHMERE_BUSINESS_OWNER_ENTITY_ID_SET.has(Number(id));
}

export function validateHarthmereBusinessOwnerNpcSeeds(): string[] {
  const errors: string[] = [];
  const ids = new Set<BiomesId>();
  const offsets = new Set<number>();
  const owners = new Set<string>();
  const outposts = new Set<string>();
  for (const seed of HARTHMERE_BUSINESS_OWNER_NPC_SEEDS) {
    if (ids.has(seed.entityId)) {
      errors.push(`${seed.ownerNpcId}:duplicate_entity_id`);
    }
    ids.add(seed.entityId);
    if (offsets.has(seed.idOffset)) {
      errors.push(`${seed.ownerNpcId}:duplicate_id_offset`);
    }
    offsets.add(seed.idOffset);
    if (owners.has(seed.ownerNpcId)) {
      errors.push(`${seed.ownerNpcId}:duplicate_owner`);
    }
    owners.add(seed.ownerNpcId);
    if (outposts.has(seed.outpostId)) {
      errors.push(`${seed.outpostId}:duplicate_outpost`);
    }
    outposts.add(seed.outpostId);
    if (!seed.displayName.trim()) {
      errors.push(`${seed.ownerNpcId}:missing_display_name`);
    }
    if (!seed.position.every((value) => Number.isFinite(value))) {
      errors.push(`${seed.ownerNpcId}:invalid_position`);
    }
  }
  return errors;
}
