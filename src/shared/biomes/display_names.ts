// BIOMES_DISPLAY_NAMES
// Product naming contract: the game is Biomes; Harthmere is a town/city inside it.
// Keep this file small and dependency-free so UI/runtime code can import it without
// pulling Harthmere content modules into generic game screens.
export const BIOMES_GAME_NAME = "Biomes" as const;
export const BIOMES_HARTHMERE_TOWN_NAME = "Harthmere" as const;
export const BIOMES_HARTHMERE_TOWN_KIND = "town" as const;
export const BIOMES_HARTHMERE_LOCATION_LABEL = `${BIOMES_HARTHMERE_TOWN_NAME} ${BIOMES_HARTHMERE_TOWN_KIND}` as const;
export const BIOMES_DISPLAY_NAMES_VERSION = "biomes-display-names" as const;
