export const HARTHMERE_MUCK_CREATURE_NPC_ASSET_VERSION =
  "harthmere-muck-creature-npc-asset" as const;

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
