export const HARTHMERE_MUCK_CREATURE_NPC_ASSET_VERSION =
  "harthmere-muck-creature-npc-asset-v3-stagger-polish" as const;

export const HARTHMERE_INDISWORM_RUNTIME_ASSET_URL = "npcs/indisworm" as const;

export const HARTHMERE_CREATURE_STAGGER_RUNTIME_ASSET_URLS = Object.freeze({
  "npcs/mossy_mucker":
    "/assets/harthmere/glb/creatures/stagger/mossy_mucker.glb",
  "npcs/tree_mucker": "/assets/harthmere/glb/creatures/stagger/tree_mucker.glb",
  "npcs/stone_mucker":
    "/assets/harthmere/glb/creatures/stagger/stone_mucker.glb",
  "npcs/jugger_mucker":
    "/assets/harthmere/glb/creatures/stagger/jugger_mucker.glb",
  "npcs/seedy_muckling":
    "/assets/harthmere/glb/creatures/stagger/seedy_muckling.glb",
  "npcs/brown_hexer": "/assets/harthmere/glb/creatures/stagger/brown_hexer.glb",
  "npcs/purple_hexer":
    "/assets/harthmere/glb/creatures/stagger/purple_hexer.glb",
  "npcs/cow": "/assets/harthmere/glb/creatures/stagger/cow.glb",
  "npcs/sheep": "/assets/harthmere/glb/creatures/stagger/sheep.glb",
  "npcs/rabbit": "/assets/harthmere/glb/creatures/stagger/rabbit.glb",
} as const);

export function harthmereMuckCreatureRuntimeAssetUrl(
  assetKey: string
): string | undefined {
  if (assetKey === "npcs/indisworm") {
    return HARTHMERE_INDISWORM_RUNTIME_ASSET_URL;
  }
  return (
    HARTHMERE_CREATURE_STAGGER_RUNTIME_ASSET_URLS as Record<
      string,
      string | undefined
    >
  )[assetKey];
}

export function harthmereMuckCreatureAssetKeyForLabel(
  label: string | undefined
): string | undefined {
  const normalized = String(label ?? "")
    .trim()
    .toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (
    /robot|bot|sentinel|sentential|sentiental|jackie|billy|doctor|merchant|owner|clerk/.test(
      normalized
    )
  ) {
    return undefined;
  }
  if (/indisworm/.test(normalized)) {
    return "npcs/indisworm";
  }
  if (/hex|hexer|wraith/.test(normalized)) {
    return /pale|greater|wraith|boss/.test(normalized)
      ? "npcs/purple_hexer"
      : "npcs/brown_hexer";
  }
  // Huntable muck-area wildlife. Checked before the muck guard so a "Muckmeadow
  // Cow/Sheep/Rabbit" resolves to its animal mesh instead of a mucker.
  const livestock = normalized.match(
    /\b(cow|bovine|cattle|ox|oxen|calf|heifer|sheep|ewe|ram|lamb|rabbit|bunny|hare)\b/
  );
  if (livestock) {
    const word = livestock[1];
    if (/sheep|ewe|ram|lamb/.test(word)) {
      return "npcs/sheep";
    }
    if (/rabbit|bunny|hare/.test(word)) {
      return "npcs/rabbit";
    }
    return "npcs/cow";
  }
  if (!/muck|mucker|muckling|muckwad/.test(normalized)) {
    return undefined;
  }
  if (/old wood|copse|tree/.test(normalized)) {
    return "npcs/tree_mucker";
  }
  if (/grave|pale|stone|cobble/.test(normalized)) {
    return "npcs/stone_mucker";
  }
  if (/elite|alpha|boss|jugger|west breach/.test(normalized)) {
    return "npcs/jugger_mucker";
  }
  if (/muckling|seedy|road/.test(normalized)) {
    return "npcs/seedy_muckling";
  }
  return "npcs/mossy_mucker";
}
