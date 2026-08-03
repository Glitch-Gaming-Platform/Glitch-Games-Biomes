import type { BiomesId } from "@/shared/ids";
import type { Vec2, Vec3 } from "@/shared/math/types";
import {
  HARTHMERE_BUSINESS_OUTPOSTS,
  HARTHMERE_BUSINESS_OUTPOST_SAFE_SITES,
} from "@/shared/harthmere/business_customer_simulator";
import { SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE } from "@/shared/harthmere/snapshot_grove_content";
import {
  harthmereBusinessPostClearOfEveryAisle,
  harthmereBusinessStaffSidePost,
} from "@/shared/harthmere/business_aisle_keep_out";

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
  // General introduction used during ordinary conversation.
  line: string;
  // Background and outpost lore that is safe outside quest presentation.
  ambientLines: string[];
  // Work-offer copy reserved for the quest-giver channel by the ECS seeder.
  extraLines: string[];
  description: string;
}

interface OwnerCopy {
  displayName: string;
  roleTitle: string;
  line: string;
  ambient: readonly [string, string];
  extra: string;
}

// `line` plus `ambient` describes the owner and outpost during ordinary talk;
// `extra` is a job offer. Keying by ownerNpcId keeps copy attached to the right
// business even when the outpost array is reordered.
const HARTHMERE_BUSINESS_OWNER_COPY: Readonly<Record<string, OwnerCopy>> = {
  npc_outpost_ashline_foreman: {
    displayName: "Foreman Calla Ashe",
    roleTitle: "Refinery Foreman",
    line: "Welcome to the Containment Works. Mind the cold bins — exotic matter bites.",
    ambient: [
      "I log every sealed fragment twice; one careless count at Ashline can turn a cold bin into a spreading breach.",
      "Containment work is not glamorous, but the nearby roads stay usable because my crew respects gloves, distance, and warning lamps.",
    ],
    extra:
      "Sort sealed raw matter for me and the pay is good, safety rating better.",
  },
  npc_outpost_anchorwright: {
    displayName: "Anchorwright Doran Vell",
    roleTitle: "Anchor Repair Lead",
    line: "If a biome anchor is drifting, I'm the one who pins it back down.",
    ambient: [
      "North Anchor hears a failing brace before it sees one: a low shiver through the rig, then tools creeping across the bench.",
      "I trust old fasteners more than fresh promises, provided both have been inspected under load.",
    ],
    extra:
      "Bring me a bent anchor brace and I'll show you how the repair rig works.",
  },
  npc_outpost_glassyard_designer: {
    displayName: "Designer Mira Glass",
    roleTitle: "Biome Designer",
    line: "Every biome you see was drawn on a table like this one first.",
    ambient: [
      "Glassyard plans begin with water, shade, and who must maintain the place after the designer leaves.",
      "A beautiful pocket world can still be irresponsible; I would rather erase a clever sketch than build a habitat that consumes itself.",
    ],
    extra:
      "Sketch a planting plan with me and you'll earn your first design fee.",
  },
  npc_outpost_redoubt_captain: {
    displayName: "Captain Bren Holt",
    roleTitle: "Security Captain",
    line: "Contracts for guards, walls, and ward stones — all signed here at the Redoubt.",
    ambient: [
      "The Redoubt protects caravans and work crews, not pride; a guard who starts fights is another hazard on the road.",
      "I compare patrol notes at dusk because bandits, Muck, and frightened travelers leave very different gaps in a route.",
    ],
    extra: "Run a patrol loop for me and I'll vouch you to the bigger jobs.",
  },
  npc_outpost_eastgate_operator: {
    displayName: "Operator Saff Lin",
    roleTitle: "Portal Operator",
    line: "Step lively — the Eastgate portals only hold a charge so long.",
    ambient: [
      "Eastgate's rings are checked between every transit; a destination that is almost aligned is still the wrong destination.",
      "Portal work rewards patience before activation and speed afterward, which is why I sound hurried only when the ring is live.",
    ],
    extra:
      "Help me align a transit ring and you'll learn the safe-jump checklist.",
  },
  npc_outpost_southplot_grower: {
    displayName: "Grower Pell Soren",
    roleTitle: "Rare Foods Grower",
    line: "Southplot grows what other plots can't. Careful where you step.",
    ambient: [
      "Southplot's beds come from several climates, so I water by leaf and soil instead of trusting the weather overhead.",
      "Rare food is still food; I judge a harvest by whether it feeds people reliably, not by how impressive it looks in a merchant's basket.",
    ],
    extra:
      "Harvest a rare crop row with me and a share of the basket is yours.",
  },
  npc_outpost_cinderlane_smith: {
    displayName: "Smith Goran Ember",
    roleTitle: "Tool Smith",
    line: "Hot forge, sharp tools. Tell me what you're building and I'll fit the steel.",
    ambient: [
      "Cinderlane steel must survive field repairs, portal dust, and owners who remember maintenance only after something snaps.",
      "Bring me a worn tool and I can usually tell whether its last job was honest work, panic, or showing off.",
    ],
    extra:
      "Pump the bellows through a heat and I'll teach you a blade's temper.",
  },
  npc_outpost_moonstall_warder: {
    displayName: "Warder Iselle Moon",
    roleTitle: "Ward Keeper",
    line: "Wards, charms, and quiet magic. The Moonstall keeps the dark polite.",
    ambient: [
      "Moonstall wards are meant to warn and shelter before they harm; magic without restraint is only another loose weapon.",
      "I replace the western charms most often, where the night wind carries Muck static against the posts.",
    ],
    extra:
      "Charge a ward stone with me and you'll carry your first charm home.",
  },
  npc_outpost_westtrail_guide: {
    displayName: "Guide Tamsin Roe",
    roleTitle: "Trail Guide",
    line: "Lost? Sit at the Guide Table. I've walked every trail worth walking.",
    ambient: [
      "Westtrail maps include water, shelter, and the places where yesterday's safe path has begun to shimmer at the edges.",
      "A guide earns trust by turning people back early, not by leading them into danger for a better story.",
    ],
    extra: "Mark a safe route with me and the map fee is yours.",
  },
  npc_outpost_keylot_builder: {
    displayName: "Builder Hadrin Kael",
    roleTitle: "Property Builder",
    line: "You want a home of your own? Keylot turns empty plots into deeds.",
    ambient: [
      "At Keylot I check access, drainage, and claim records before anyone spends coin pretending an empty patch is ready for a home.",
      "A sound foundation is part stone and part agreement; skip either one and the argument arrives before the roof.",
    ],
    extra:
      "Stake out a plot with me and I'll cover the first foundation course.",
  },
  npc_outpost_brightcart_trader: {
    displayName: "Trader Odette Bright",
    roleTitle: "General Trader",
    line: "If it can be bought or sold, the Brightcart has a price for it.",
    ambient: [
      "Brightcart prices follow road risk, storage space, and scarcity; anyone blaming pure greed has never paid to replace a lost wagon.",
      "I keep common necessities near the front because a useful market should serve tired workers before collectors.",
    ],
    extra: "Run a delivery cart for me and you'll keep a cut of the trade.",
  },
  npc_outpost_ridgecooler_hunter: {
    displayName: "Hunter Marl Ridge",
    roleTitle: "Wild-Meat Hunter",
    line: "Fresh meat, hung cold in the Larder. The wilds pay if you're patient.",
    ambient: [
      "Ridgecooler takes only clean kills from known ground; sick animals and strange growth go to the wardens, not the butcher's hook.",
      "The wilds are not an endless pantry, so I leave young tracks, dens, and breeding ground alone.",
    ],
    extra: "Track a beast with me and I'll split the kill and the coin.",
  },
  npc_outpost_greenlamp_doctor: {
    displayName: "Doctor Hana Greenlamp",
    roleTitle: "Clinic Doctor",
    line: "Hurt? Sit down. The Greenlamp patches what the wilds tear up.",
    ambient: [
      "Greenlamp sees exhaustion disguised as bravery every evening; clean water and an hour's rest prevent more funerals than dramatic medicine.",
      "Muck exposure does not look like an ordinary wound, so tell me where you were before you tell me how tough you feel.",
    ],
    extra: "Restock my clinic shelves and I'll teach you a field dressing.",
  },
  npc_outpost_returnstone_keeper: {
    displayName: "Keeper Eli Stonewell",
    roleTitle: "Returnstone Keeper",
    line: "Set your return here and you'll always have a way home.",
    ambient: [
      "Returnstone anchors remember a traveler through careful attunement, not wishful touching and a hurried departure.",
      "I inspect this pad after every surge because a reliable way home matters most on the day every other route fails.",
    ],
    extra:
      "Help me attune a Returnstone pad and you'll bind your first anchor.",
  },
  npc_outpost_clearbarrel_boss: {
    displayName: "Boss Greta Clearbarrel",
    roleTitle: "Cleanup Boss",
    line: "Someone has to haul the muck and waste out. That someone is us.",
    ambient: [
      "Clearbarrel crews separate ordinary refuse from Muck-tainted waste; mixing them saves minutes and ruins ground for years.",
      "People notice a clean road but rarely the hands that made it safe, which suits me better than a contaminated parade.",
    ],
    extra: "Clear a cleanup route with me and the hazard pay is good.",
  },
  npc_outpost_hingehall_fixer: {
    displayName: "Fixer Tomas Hinge",
    roleTitle: "Repair Fixer",
    line: "Broken hinge, busted rig, jammed door — bring it to Hingehall.",
    ambient: [
      "Hingehall survives on small repairs done early, before a loose latch becomes a broken door during bad weather.",
      "I keep discarded parts sorted by wear; yesterday's cracked bracket may still teach me why today's machine is failing.",
    ],
    extra: "Fix a busted fixture with me and you'll learn the repair bench.",
  },
  npc_outpost_redpot_cook: {
    displayName: "Cook Bessa Redpot",
    roleTitle: "Kitchen Cook",
    line: "Hot food, fast service. The Redpot never lets a traveler go hungry.",
    ambient: [
      "Redpot stew changes with the caravans, but there is always something hot for workers coming off a cold route.",
      "I listen to empty bowls more than compliments; a kitchen learns quickly when portions, prices, or tempers are wrong.",
    ],
    extra: "Work the service line with me and you'll eat on the house.",
  },
  npc_outpost_stampspur_dispatcher: {
    displayName: "Dispatcher Nyle Stampspur",
    roleTitle: "Courier Dispatcher",
    line: "Parcels in, parcels out. Stampspur keeps the roads moving.",
    ambient: [
      "Stampspur marks every dispatch by route, weather, and urgency so a medicine parcel never waits behind someone's decorative purchase.",
      "A late courier is not automatically a lazy one; first I check bridges, portal charge, and the last safe-stop ledger.",
    ],
    extra: "Carry a dispatch run for me and the courier fee is yours.",
  },
  npc_outpost_lanternrest_host: {
    displayName: "Host Wren Lanternrest",
    roleTitle: "Inn Host",
    line: "A warm bed and a lit lantern. Rest easy at the Lanternrest.",
    ambient: [
      "Lanternrest keeps a light in the window for travelers who misjudged the distance between safe stops.",
      "I remember who needs quiet, who needs soup, and which road story should reach a warden before breakfast.",
    ],
    extra: "Help me ready the rooms and you'll always have a bunk here.",
  },
};

function entityIdFromOffset(idOffset: number): BiomesId {
  return (Number(SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE) + idOffset) as BiomesId;
}

// HARTHMERE_BUSINESS_OWNER_POST
// Place the owner behind their own service counter, on the staff side, clear of
// the customer aisle.
//
// This used to return the centre of the building footprint. That reads fine as
// "the owner stands in their shop" until the business became a real in-world
// simulation: the footprint centre *is* the customer lane, so all nineteen
// owners were parked as collidable one-metre bodies directly across the route
// their own customers have to walk. A queued customer with a perfectly valid
// path simply could not get past the shopkeeper.
//
// The staff-side post is also better staging — the owner is now where a
// shopkeeper would actually stand — so this is not a compromise for the
// simulation's benefit. The safe-site footprint centre remains the fallback for
// anything without an audited interior.
function ownerPositionForSafeSite(
  outpostId: string,
  site: {
    groundY: number;
    footprint: { xMin: number; xMax: number; zMin: number; zMax: number };
  }
): Vec3 {
  const staffSide = harthmereBusinessStaffSidePost(outpostId);
  if (staffSide) {
    return [staffSide[0], site.groundY, staffSide[2]];
  }
  return harthmereBusinessPostClearOfEveryAisle([
    (site.footprint.xMin + site.footprint.xMax) / 2,
    site.groundY,
    (site.footprint.zMin + site.footprint.zMax) / 2,
  ]);
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
      position: ownerPositionForSafeSite(outpost.outpostId, site),
      orientation: [0, Number(outpost.position.rot) || 0] as Vec2,
      line: copy.line,
      ambientLines: [...copy.ambient],
      extraLines: [copy.extra],
      description: `${copy.displayName}, ${copy.roleTitle} of ${
        outpost.displayName
      }. ${copy.ambient.join(" ")}`,
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
  return (
    id !== undefined && HARTHMERE_BUSINESS_OWNER_ENTITY_ID_SET.has(Number(id))
  );
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
