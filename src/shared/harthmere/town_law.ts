// HARTHMERE_TOWN_LAW_RESTRICTED_AREAS_V1
export const HARTHMERE_RESTRICTED_AREA_VOCABULARY_V1 = [
  "noble",
  "guard",
  "prison",
  "treasury",
  "private",
  "guild",
  "temple",
  "black market",
] as const;

export const HARTHMERE_TOWN_LAW_RULES_V1 = {
  warnings: "restricted private warning no entry guarded permit markers are visible before trespass",
  trespass: "trespass illegal crime legal standing outlaw suspicious players trigger guard challenge stop attack escort warn behavior",
  temple: "temple chapel sanctuary sacrilege crime penalty reputation is stronger than ordinary theft",
  criminal: "black market fence vendor smuggler services are hidden until trusted outlaw reputation discovered unlock or bribe",
} as const;
