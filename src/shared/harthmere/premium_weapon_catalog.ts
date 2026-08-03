import {
  HARTHMERE_ENERGY_WEAPONS,
  getHarthmereEnergyWeapon,
} from "@/shared/harthmere/energy_weapon_catalog";

export const HARTHMERE_PREMIUM_WEAPON_VERSION =
  "harthmere-premium-voxel-weapons-v1" as const;

export const HARTHMERE_HOTBAR_HELD_ITEM_EVENT =
  "biomes:harthmere-hotbar-held-item" as const;

export type HarthmerePremiumWeaponProfile =
  "melee" | "ranged" | "magic" | "magicBook" | "thrown" | "shield";

export type HarthmerePremiumWeaponQuality =
  "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface HarthmerePremiumWeaponDefinition {
  id: string;
  label: string;
  family: string;
  profile: HarthmerePremiumWeaponProfile;
  slot: "main_hand" | "off_hand";
  twoHanded: boolean;
  quality: HarthmerePremiumWeaponQuality;
  icon: string;
  baseValue: number;
  durabilityMax: number;
  requiredLevel: number;
  targetLength: number;
  attackPoints?: number;
  accuracy?: number;
  criticalChance?: number;
  defense?: number;
  armor?: number;
  magicResistance?: number;
  assetUrl: string;
  previewUrl: string;
  inventoryIconUrl: string;
  idleClip: string;
  visualAliases: readonly string[];
  description: string;
}

type WeaponInput = Omit<
  HarthmerePremiumWeaponDefinition,
  "assetUrl" | "previewUrl" | "inventoryIconUrl" | "idleClip"
>;

const idleClipForProfile = (profile: HarthmerePremiumWeaponProfile) => {
  switch (profile) {
    case "ranged":
      return "IdleAim_24";
    case "magic":
      return "Channel_24";
    case "magicBook":
      return "OpenRead_24";
    case "thrown":
      return "Ready_24";
    case "shield":
      return "IdleGuard_24";
    default:
      return "IdleDrawn_24";
  }
};

const weapon = (definition: WeaponInput): HarthmerePremiumWeaponDefinition => ({
  ...definition,
  assetUrl: `/assets/harthmere/glb/weapons/${definition.id}.glb`,
  previewUrl: `/assets/harthmere/weapon_previews/${definition.id}.png`,
  inventoryIconUrl: `/assets/harthmere/weapon_icons/${definition.id}.png`,
  idleClip: idleClipForProfile(definition.profile),
});

const practical = {
  slot: "main_hand" as const,
  twoHanded: false,
  quality: "uncommon" as const,
  requiredLevel: 1,
  accuracy: 3,
  criticalChance: 0.02,
};

const gilded = {
  slot: "main_hand" as const,
  quality: "rare" as const,
  requiredLevel: 8,
  accuracy: 5,
  criticalChance: 0.04,
};

export const HARTHMERE_PREMIUM_WEAPONS = [
  weapon({
    ...practical,
    id: "one_handed_axe",
    label: "One-Handed Axe",
    family: "axe",
    profile: "melee",
    icon: "🪓",
    baseValue: 95,
    durabilityMax: 65,
    targetLength: 1.18,
    attackPoints: 17,
    visualAliases: ["axe_1handed"],
    description:
      "A bearded battle axe with a wedged iron head, leather grip, and visible assembly pins.",
  }),
  weapon({
    ...practical,
    id: "two_handed_axe",
    label: "Two-Handed Axe",
    family: "axe",
    profile: "melee",
    twoHanded: true,
    icon: "🪓",
    baseValue: 165,
    durabilityMax: 82,
    requiredLevel: 4,
    targetLength: 1.62,
    attackPoints: 25,
    visualAliases: ["axe_2handed"],
    description:
      "A long-hafted war axe with reinforced langets, a counterweight, and broad double-beveled steel.",
  }),
  weapon({
    ...practical,
    id: "double_axe",
    label: "Double Axe",
    family: "axe",
    profile: "melee",
    twoHanded: true,
    icon: "🪓",
    baseValue: 220,
    durabilityMax: 88,
    requiredLevel: 6,
    targetLength: 1.55,
    attackPoints: 28,
    visualAliases: ["Axe_Double"],
    description:
      "An asymmetric double axe pairing a chopping blade with a hooked armor-catching blade.",
  }),
  weapon({
    ...gilded,
    id: "golden_double_axe",
    label: "Golden Double Axe",
    family: "axe",
    profile: "melee",
    twoHanded: true,
    icon: "🪓",
    baseValue: 520,
    durabilityMax: 96,
    targetLength: 1.58,
    attackPoints: 32,
    visualAliases: ["Axe_Double_Golden"],
    description:
      "A tempered double axe with gilded trim, gold rivets, and ceremonial inlay around steel cutting edges.",
  }),
  weapon({
    ...practical,
    id: "small_axe",
    label: "Small Axe",
    family: "axe",
    profile: "melee",
    icon: "🪓",
    baseValue: 68,
    durabilityMax: 52,
    targetLength: 0.92,
    attackPoints: 13,
    visualAliases: ["Axe_small"],
    description:
      "A compact side axe with a short wrapped haft and pronounced utility beard.",
  }),
  weapon({
    ...gilded,
    id: "golden_small_axe",
    label: "Golden Small Axe",
    family: "axe",
    profile: "melee",
    twoHanded: false,
    icon: "🪓",
    baseValue: 260,
    durabilityMax: 62,
    targetLength: 0.95,
    attackPoints: 19,
    visualAliases: ["Axe_small_Golden"],
    description:
      "A compact steel hatchet with restrained gilded edge trim, pommel, and fastening pins.",
  }),
  weapon({
    ...practical,
    id: "steel_dagger",
    label: "Dagger",
    family: "dagger",
    profile: "melee",
    icon: "†",
    baseValue: 72,
    durabilityMax: 45,
    targetLength: 0.78,
    attackPoints: 12,
    accuracy: 7,
    criticalChance: 0.06,
    visualAliases: ["dagger", "Dagger"],
    description:
      "A slim triangular dagger with a fullered blade, ornate guard, and tightly wrapped grip.",
  }),
  weapon({
    ...gilded,
    id: "golden_dagger",
    label: "Golden Dagger",
    family: "dagger",
    profile: "melee",
    twoHanded: false,
    icon: "†",
    baseValue: 310,
    durabilityMax: 54,
    targetLength: 0.8,
    attackPoints: 18,
    accuracy: 9,
    criticalChance: 0.08,
    visualAliases: ["Dagger_Golden"],
    description:
      "A hardened golden assassin's dagger with a radiant point, gemstone pommel, and leather-over-bone handle.",
  }),
  weapon({
    ...practical,
    id: "double_headed_hammer",
    label: "Double-Headed Hammer",
    family: "hammer",
    profile: "melee",
    twoHanded: true,
    icon: "🔨",
    baseValue: 210,
    durabilityMax: 105,
    requiredLevel: 5,
    targetLength: 1.48,
    attackPoints: 29,
    accuracy: 1,
    visualAliases: ["Hammer_Double"],
    description:
      "A massive two-faced warhammer with steel bands, reinforced haft, and rune-cut striking faces.",
  }),
  weapon({
    ...gilded,
    id: "golden_double_headed_hammer",
    label: "Golden Double-Headed Hammer",
    family: "hammer",
    profile: "melee",
    twoHanded: true,
    icon: "🔨",
    baseValue: 560,
    durabilityMax: 116,
    targetLength: 1.5,
    attackPoints: 34,
    accuracy: 2,
    visualAliases: ["Hammer_Double_Golden"],
    description:
      "A heavy golden warhammer with radiant striking plates, crystal end caps, reinforced bands, and gold-filled runes.",
  }),
  weapon({
    ...practical,
    id: "iron_longsword",
    label: "One-Handed Sword",
    family: "sword",
    profile: "melee",
    icon: "⚔",
    baseValue: 120,
    durabilityMax: 50,
    requiredLevel: 2,
    targetLength: 1.18,
    attackPoints: 32,
    accuracy: 3,
    visualAliases: ["sword_1handed"],
    description:
      "A practical one-handed iron sword with a chamfered edge, fuller, brass guard, and leather grip.",
  }),
  weapon({
    ...practical,
    id: "two_handed_sword",
    label: "Two-Handed Sword",
    family: "sword",
    profile: "melee",
    twoHanded: true,
    icon: "⚔",
    baseValue: 180,
    durabilityMax: 60,
    requiredLevel: 3,
    targetLength: 1.62,
    attackPoints: 26,
    accuracy: 1,
    visualAliases: ["sword_2handed"],
    description:
      "A long Black Anvil blade with an extended wrapped grip, reinforced ricasso, and wide guard.",
  }),
  weapon({
    ...practical,
    id: "colored_two_handed_sword",
    label: "Colored Two-Handed Sword",
    family: "sword",
    profile: "melee",
    twoHanded: true,
    quality: "rare",
    icon: "⚔",
    baseValue: 245,
    durabilityMax: 66,
    requiredLevel: 6,
    targetLength: 1.63,
    attackPoints: 28,
    visualAliases: ["sword_2handed_color"],
    description:
      "A faction-painted two-handed sword whose blue enamel and cloth wrap signal rarity without changing its construction.",
  }),
  weapon({
    ...practical,
    id: "standard_sword",
    label: "Standard Sword",
    family: "sword",
    profile: "melee",
    icon: "⚔",
    baseValue: 145,
    durabilityMax: 58,
    requiredLevel: 3,
    targetLength: 1.24,
    attackPoints: 20,
    visualAliases: ["Sword"],
    description:
      "A classic knightly sword with a tapered point, central fuller, curved quillons, and peened pommel.",
  }),
  weapon({
    ...gilded,
    id: "golden_sword",
    label: "Golden Sword",
    family: "sword",
    profile: "melee",
    twoHanded: false,
    icon: "⚔",
    baseValue: 440,
    durabilityMax: 72,
    targetLength: 1.26,
    attackPoints: 27,
    visualAliases: ["Sword_Golden"],
    description:
      "A hardened golden knightly sword with radiant cutting edges, gilded guard, rivets, and gemstone pommel.",
  }),
  weapon({
    ...practical,
    id: "great_sword",
    label: "Great Sword",
    family: "greatsword",
    profile: "melee",
    twoHanded: true,
    quality: "rare",
    icon: "⚔",
    baseValue: 310,
    durabilityMax: 90,
    requiredLevel: 8,
    targetLength: 1.88,
    attackPoints: 34,
    accuracy: 1,
    visualAliases: ["Sword_big"],
    description:
      "A monumental great sword with a massive chamfered blade, extended grip, side lugs, and counterweighted pommel.",
  }),
  weapon({
    ...gilded,
    id: "golden_great_sword",
    label: "Golden Great Sword",
    family: "greatsword",
    profile: "melee",
    twoHanded: true,
    quality: "epic",
    icon: "⚔",
    baseValue: 780,
    durabilityMax: 102,
    requiredLevel: 12,
    targetLength: 1.9,
    attackPoints: 40,
    accuracy: 2,
    visualAliases: ["Sword_big_Golden"],
    description:
      "An epic golden great sword with bright edge work, reinforced ricasso, radiant gemstone, and ceremonial cloth binding.",
  }),
  weapon({
    ...practical,
    id: "hunter_bow",
    label: "Wooden Bow",
    family: "bow",
    profile: "ranged",
    twoHanded: true,
    icon: "🏹",
    baseValue: 75,
    durabilityMax: 90,
    targetLength: 1.38,
    attackPoints: 8,
    accuracy: 5,
    visualAliases: ["bow", "Bow_Wooden"],
    description:
      "A layered ash-and-yew hunting bow with visible grain, horn tips, a wrapped grip, and a taut string.",
  }),
  weapon({
    ...gilded,
    id: "golden_bow",
    label: "Golden Bow",
    family: "bow",
    profile: "ranged",
    twoHanded: true,
    icon: "🏹",
    baseValue: 430,
    durabilityMax: 98,
    targetLength: 1.4,
    attackPoints: 23,
    accuracy: 8,
    visualAliases: ["Bow_Golden"],
    description:
      "A laminated war bow with gilded limb plates, gold tip caps, carved motifs, and a practical wooden core.",
  }),
  weapon({
    ...practical,
    id: "strung_bow",
    label: "Strung Bow",
    family: "bow",
    profile: "ranged",
    twoHanded: true,
    icon: "🏹",
    baseValue: 165,
    durabilityMax: 82,
    requiredLevel: 4,
    targetLength: 1.36,
    attackPoints: 18,
    accuracy: 7,
    visualAliases: ["bow_withString"],
    description:
      "A recurved field bow with reinforced nocks, linen bindings, carved limbs, and a visibly tensioned string.",
  }),
  weapon({
    ...practical,
    id: "one_handed_crossbow",
    label: "One-Handed Crossbow",
    family: "crossbow",
    profile: "ranged",
    icon: "🏹",
    baseValue: 190,
    durabilityMax: 72,
    requiredLevel: 5,
    targetLength: 1.0,
    attackPoints: 22,
    accuracy: 8,
    visualAliases: ["crossbow_1handed"],
    description:
      "A compact hand crossbow with laminated limbs, working trigger housing, bolt groove, stirrup, and steel bowstring.",
  }),
  weapon({
    ...practical,
    id: "two_handed_crossbow",
    label: "Two-Handed Crossbow",
    family: "crossbow",
    profile: "ranged",
    twoHanded: true,
    quality: "rare",
    icon: "🏹",
    baseValue: 340,
    durabilityMax: 96,
    requiredLevel: 9,
    targetLength: 1.45,
    attackPoints: 31,
    accuracy: 9,
    visualAliases: ["crossbow_2handed"],
    description:
      "A heavy arbalest with broad steel limbs, reinforced stock, winding hardware, deep bolt channel, and foot stirrup.",
  }),
  weapon({
    ...practical,
    id: "steel_dart",
    label: "Dart",
    family: "dart",
    profile: "thrown",
    icon: "➳",
    baseValue: 44,
    durabilityMax: 36,
    targetLength: 0.62,
    attackPoints: 10,
    accuracy: 8,
    criticalChance: 0.05,
    visualAliases: ["Dart"],
    description:
      "A balanced steel throwing dart with a needle point, bright flights, binding rings, and weighted grip.",
  }),
  weapon({
    ...gilded,
    id: "golden_dart",
    label: "Golden Dart",
    family: "dart",
    profile: "thrown",
    twoHanded: false,
    icon: "➳",
    baseValue: 170,
    durabilityMax: 42,
    targetLength: 0.64,
    attackPoints: 15,
    accuracy: 10,
    criticalChance: 0.07,
    visualAliases: ["Dart_Golden"],
    description:
      "A steel throwing dart with gilded collars, bright flights, and a gold-inlaid needle point.",
  }),
  weapon({
    ...practical,
    id: "arcane_staff",
    label: "Staff",
    family: "staff",
    profile: "magic",
    twoHanded: true,
    icon: "✦",
    baseValue: 250,
    durabilityMax: 78,
    requiredLevel: 4,
    targetLength: 1.72,
    attackPoints: 14,
    magicResistance: 6,
    visualAliases: ["staff"],
    description:
      "A tall rune-bound staff whose restrained shaft supports a floating crystal cluster and rotating focus cage.",
  }),
  weapon({
    ...practical,
    id: "arcane_wand",
    label: "Wand",
    family: "wand",
    profile: "magic",
    icon: "✦",
    baseValue: 180,
    durabilityMax: 52,
    requiredLevel: 2,
    targetLength: 0.86,
    attackPoints: 10,
    magicResistance: 5,
    visualAliases: ["wand"],
    description:
      "An elegant spiral-wood wand with a faceted gem tip, silver ferrule, fine grip wire, and floating rune bead.",
  }),
  weapon({
    ...practical,
    id: "arcane_spellbook_closed",
    label: "Spellbook — Closed",
    family: "spellbook",
    profile: "magicBook",
    icon: "📕",
    baseValue: 195,
    durabilityMax: 64,
    requiredLevel: 2,
    targetLength: 0.76,
    attackPoints: 8,
    magicResistance: 7,
    visualAliases: [
      "spellbook_closed",
      "Book1_Closed",
      "Book2_Closed",
      "Book3_Closed",
      "Book4_Closed",
    ],
    description:
      "A chained leather spellbook with metal corners, clasp, bookmarks, raised glyph, and softly glowing page edges.",
  }),
  weapon({
    ...practical,
    id: "arcane_spellbook_open",
    label: "Spellbook — Open",
    family: "spellbook",
    profile: "magicBook",
    icon: "📖",
    baseValue: 220,
    durabilityMax: 64,
    requiredLevel: 3,
    targetLength: 0.9,
    attackPoints: 9,
    magicResistance: 8,
    visualAliases: [
      "spellbook_open",
      "Book1_Open",
      "Book2_Open",
      "Book3_Open",
      "Book4_Open",
    ],
    description:
      "An open casting grimoire with glowing pages, metal corners, floating bookmarks, chains, and animated arcane glyphs.",
  }),
  weapon({
    ...practical,
    id: "sealed_scroll",
    label: "Scroll",
    family: "scroll",
    profile: "magicBook",
    icon: "📜",
    baseValue: 90,
    durabilityMax: 34,
    targetLength: 0.72,
    attackPoints: 6,
    magicResistance: 3,
    visualAliases: ["Scroll"],
    description:
      "A reinforced casting scroll with decorative end caps, wax seal, colored ribbon, and glowing written bands.",
  }),
  weapon({
    ...practical,
    id: "crystal_focus",
    label: "Crystal Focus",
    family: "focus",
    profile: "magic",
    icon: "◆",
    baseValue: 260,
    durabilityMax: 48,
    requiredLevel: 5,
    targetLength: 0.7,
    attackPoints: 9,
    magicResistance: 10,
    visualAliases: [
      "Crystal1",
      "Crystal1_Damaged",
      "Crystal2",
      "Crystal2_Damaged",
      "Crystal3",
      "Crystal3_Damaged",
      "Crystal4",
      "Crystal5",
      "Crystal5_Damaged",
    ],
    description:
      "A faceted crystal cluster with visible inclusions, silver cage, internal glow, and orbiting chips.",
  }),
  weapon({
    ...practical,
    id: "star_focus",
    label: "Star Focus",
    family: "focus",
    profile: "magic",
    icon: "★",
    baseValue: 285,
    durabilityMax: 50,
    requiredLevel: 6,
    targetLength: 0.72,
    attackPoints: 10,
    magicResistance: 10,
    visualAliases: ["Star", "Coin_Star"],
    description:
      "A rotating celestial focus with offset star points, brass orbit, night-blue core, and constellation pins.",
  }),
  weapon({
    ...practical,
    id: "snowflake_focus",
    label: "Snowflake Focus",
    family: "focus",
    profile: "magic",
    icon: "❄",
    baseValue: 300,
    durabilityMax: 52,
    requiredLevel: 6,
    targetLength: 0.76,
    attackPoints: 10,
    magicResistance: 12,
    visualAliases: ["Snowflake1", "Snowflake2", "Snowflake3"],
    description:
      "An intricate sixfold frost focus with crystalline branches, a cold-white core, and drifting ice motes.",
  }),
  weapon({
    ...practical,
    id: "smoke_bomb",
    label: "Smoke Bomb",
    family: "smoke_bomb",
    profile: "thrown",
    icon: "●",
    baseValue: 65,
    durabilityMax: 24,
    targetLength: 0.58,
    attackPoints: 4,
    accuracy: 8,
    visualAliases: ["smokebomb"],
    description:
      "A thrown ceramic shell with metal bands, wrapped cloth grip, waxed fuse, vent holes, and impact cap.",
  }),
  ...HARTHMERE_ENERGY_WEAPONS.map((energy) =>
    weapon({
      id: energy.id,
      label: energy.label,
      family: "energy_weapon",
      profile: "ranged",
      slot: "main_hand",
      twoHanded: energy.twoHanded,
      quality: energy.quality,
      icon: "◉",
      baseValue: energy.priceGold,
      durabilityMax: 0,
      requiredLevel: energy.requiredLevel,
      targetLength: energy.targetLength,
      attackPoints: energy.baseDamage,
      accuracy: 8 + energy.tier * 2,
      criticalChance: 0.03 + energy.tier * 0.01,
      visualAliases: [energy.projectileId, `energy_weapon_tier_${energy.tier}`],
      description: energy.description,
    })
  ),
  ...[
    [
      "round_shield",
      "Round Shield",
      "shield_round",
      "round",
      "uncommon",
      135,
      14,
      18,
    ],
    [
      "barbarian_round_shield",
      "Barbarian Round Shield",
      "shield_round_barbarian",
      "barbarian",
      "rare",
      210,
      17,
      22,
    ],
    [
      "spiked_shield",
      "Spiked Shield",
      "shield_spikes",
      "spiked",
      "rare",
      245,
      20,
      25,
    ],
    [
      "square_shield",
      "Square Shield",
      "shield_square",
      "square",
      "uncommon",
      170,
      18,
      22,
    ],
    [
      "badge_shield",
      "Badge Shield",
      "shield_badge",
      "badge",
      "rare",
      230,
      18,
      24,
    ],
    [
      "colored_round_shield",
      "Colored Round Shield",
      "shield_round_color",
      "round_color",
      "rare",
      220,
      17,
      22,
    ],
    [
      "colored_spiked_shield",
      "Colored Spiked Shield",
      "shield_spikes_color",
      "spiked_color",
      "epic",
      340,
      22,
      28,
    ],
    [
      "colored_square_shield",
      "Colored Square Shield",
      "shield_square_color",
      "square_color",
      "rare",
      260,
      20,
      25,
    ],
    [
      "colored_badge_shield",
      "Colored Badge Shield",
      "shield_badge_color",
      "badge_color",
      "epic",
      360,
      21,
      28,
    ],
  ].map(([id, label, alias, family, quality, baseValue, defense, armor]) =>
    weapon({
      id: String(id),
      label: String(label),
      family: String(family),
      profile: "shield",
      slot: "off_hand",
      twoHanded: false,
      quality: quality as HarthmerePremiumWeaponQuality,
      icon: "⬟",
      baseValue: Number(baseValue),
      durabilityMax: 88 + Number(defense),
      requiredLevel: Math.max(1, Math.floor(Number(defense) / 3)),
      targetLength: 1.08,
      defense: Number(defense),
      armor: Number(armor),
      visualAliases: [String(alias)],
      description:
        "A fully constructed shield with a finished front face, visible side thickness, reinforced rim, back straps, and a solid hand grip.",
    })
  ),
] as const satisfies readonly HarthmerePremiumWeaponDefinition[];

export const HARTHMERE_PREMIUM_WEAPON_VENDOR_STOCK =
  HARTHMERE_PREMIUM_WEAPONS.filter(
    (definition) => !getHarthmereEnergyWeapon(definition.id)
  ).map((definition) => ({
    itemId: definition.id,
    quantity: 1,
    price: Math.max(20, Math.round(definition.baseValue * 1.08)),
  }));

const premiumWeaponByKey = new Map<string, HarthmerePremiumWeaponDefinition>();

for (const definition of HARTHMERE_PREMIUM_WEAPONS) {
  premiumWeaponByKey.set(definition.id.toLowerCase(), definition);
  for (const alias of definition.visualAliases) {
    premiumWeaponByKey.set(alias.toLowerCase(), definition);
  }
}

export function getHarthmerePremiumWeapon(value: unknown) {
  return premiumWeaponByKey.get(
    String(value ?? "")
      .trim()
      .toLowerCase()
  );
}
