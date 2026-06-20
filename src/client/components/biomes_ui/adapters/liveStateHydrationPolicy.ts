import type { TabKey } from "../BiomesUITypes";

export type BiomesUILiveStateHydrationKey =
  | "banking"
  | "guild"
  | "building"
  | "inventoryLoot"
  | "progression"
  | "daily"
  | "farmingFood"
  | "jobsBoard"
  | "quest";

function biomesUITabOpen(activeTab: TabKey | null, tabs: readonly TabKey[]) {
  return activeTab !== null && tabs.includes(activeTab);
}

export function shouldHydrateBiomesUILiveStateForTab(
  stateKey: BiomesUILiveStateHydrationKey,
  activeTab: TabKey | null
) {
  switch (stateKey) {
    case "banking":
      return biomesUITabOpen(activeTab, ["banking"]);
    case "guild":
      return biomesUITabOpen(activeTab, ["guilds"]);
    case "building":
      return biomesUITabOpen(activeTab, ["land"]);
    case "inventoryLoot":
      return biomesUITabOpen(activeTab, ["inventory", "loot"]);
    case "progression":
      return biomesUITabOpen(activeTab, [
        "abilities",
        "skills",
        "classes",
        "collections",
      ]);
    case "daily":
      return biomesUITabOpen(activeTab, ["daily"]);
    case "farmingFood":
    case "jobsBoard":
    case "quest":
      return true;
  }
}
