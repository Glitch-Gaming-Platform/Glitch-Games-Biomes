export const HARTHMERE_MUCK_CREATURE_NPC_ASSET_VERSION_V1 =
  "harthmere-muck-creature-npc-asset-v1" as const;

export function harthmereMuckCreatureAssetKeyForLabelV1(
  label: string | undefined
): string | undefined {
  const normalized = String(label ?? "").trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (/robot|sentinel|jackie|billy|doctor|merchant|owner|clerk/.test(normalized)) {
    return undefined;
  }
  if (/hex|hexer|wraith/.test(normalized)) {
    return /pale|greater|wraith|boss/.test(normalized)
      ? "npcs/purple_hexer"
      : "npcs/brown_hexer";
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
