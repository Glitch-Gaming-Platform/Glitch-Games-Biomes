import {
  readHarthmereCombatPresentation,
  subscribeHarthmereCombatPresentation,
} from "@/client/game/util/harthmere_combat_presentation";
import { useSyncExternalStore } from "react";

export function useHarthmereCombatPresentation() {
  return useSyncExternalStore(
    subscribeHarthmereCombatPresentation,
    readHarthmereCombatPresentation,
    readHarthmereCombatPresentation
  );
}
