export interface HarthmereContainerLootEntry {
  itemId: string;
  quantity: number;
}

/**
 * Server-authored seed contents for generic world containers.
 *
 * Keeping this table in shared authority code lets the ECS materializer and
 * legacy diagnostic UI agree without accepting a client-provided item list.
 */
export function harthmereContainerLootForLabel(
  label?: string | null
): HarthmereContainerLootEntry[] {
  const text = (label ?? "").toLowerCase();
  if (/clothing|wardrobe|outfit|garment|laundry/.test(text)) {
    return [
      { itemId: "baker_apron", quantity: 1 },
      { itemId: "field_trousers", quantity: 1 },
      { itemId: "cloth_scrap", quantity: 4 },
    ];
  }
  if (/mail|bank|courier|postage|parcel|deposit/.test(text)) {
    return [
      { itemId: "old_coin", quantity: 3 },
      { itemId: "iron_key_blank", quantity: 1 },
    ];
  }
  if (/toolbag|tool|repair|kit/.test(text)) {
    return [
      { itemId: "woodcutters_axe", quantity: 1 },
      { itemId: "rough_stone", quantity: 3 },
      { itemId: "scrap_metal", quantity: 2 },
    ];
  }
  if (/underwater|waterproof|water|dock|river|fishing/.test(text)) {
    return [
      { itemId: "clean_water", quantity: 3 },
      { itemId: "river_trout", quantity: 2 },
    ];
  }
  if (/key|lock|strongbox|lockbox/.test(text)) {
    return [
      { itemId: "iron_key_blank", quantity: 1 },
      { itemId: "scrap_metal", quantity: 2 },
    ];
  }
  if (/first.?aid|bandage|medicine|medical|infirmary|salve|healer/.test(text)) {
    return [
      { itemId: "minor_healing_salve", quantity: 2 },
      { itemId: "cloth_scrap", quantity: 2 },
    ];
  }
  if (/food|ration|satchel|bag|basket/.test(text)) {
    return [
      { itemId: "road_ration", quantity: 3 },
      { itemId: "wild_berries", quantity: 2 },
    ];
  }
  return [
    { itemId: "road_ration", quantity: 1 },
    { itemId: "rough_stone", quantity: 2 },
    { itemId: "cloth_scrap", quantity: 2 },
  ];
}
