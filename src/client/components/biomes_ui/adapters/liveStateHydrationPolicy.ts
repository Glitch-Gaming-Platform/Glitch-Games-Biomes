import type { TabKey } from "../BiomesUITypes";

export type BiomesUILiveStateHydrationKeyV1 =
  | "banking"
  | "guild"
  | "building"
  | "inventoryLoot"
  | "progression"
  | "daily"
  | "farmingFood"
  | "jobsBoard"
  | "quest";

function biomesUITabOpenV1(activeTab: TabKey | null, tabs: readonly TabKey[]) {
  return activeTab !== null && tabs.includes(activeTab);
}

export function shouldHydrateBiomesUILiveStateForTabV1(
  stateKey: BiomesUILiveStateHydrationKeyV1,
  activeTab: TabKey | null
) {
  switch (stateKey) {
    case "banking":
      return biomesUITabOpenV1(activeTab, ["banking"]);
    case "guild":
      return biomesUITabOpenV1(activeTab, ["guilds"]);
    case "building":
      return biomesUITabOpenV1(activeTab, ["land"]);
    case "inventoryLoot":
      return biomesUITabOpenV1(activeTab, ["inventory", "loot"]);
    case "progression":
      return biomesUITabOpenV1(activeTab, [
        "abilities",
        "skills",
        "classes",
        "collections",
      ]);
    case "daily":
      return biomesUITabOpenV1(activeTab, ["daily"]);
    case "farmingFood":
    case "jobsBoard":
    case "quest":
      return true;
  }
}
