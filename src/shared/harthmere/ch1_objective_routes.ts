// CHAPTER_1_MULTI_PERSON_OBJECTIVE_ROUTES
//
// Dynamic objectives must have one ordered, server-readable route. The active
// target, map aid, dialogue page and durable progress all consume these rows so
// the player can never be sent to one witness while hearing another.

import {
  CH1_ANCHORS,
  type Ch1AnchorKey,
  type Ch1Vec3,
} from "@/shared/harthmere/ch1_ids";
import { CH1_TESTIMONY_NPC_SEEDS } from "@/shared/harthmere/ch1_testimony_npcs";
import type { BiomesId } from "@/shared/ids";

export interface Ch1ObjectiveRouteStop {
  id: string;
  label: string;
  anchor: Ch1AnchorKey;
  entityId?: BiomesId;
}

export const CH1_TESTIMONY_ROUTE: readonly Ch1ObjectiveRouteStop[] =
  Object.freeze(
    CH1_TESTIMONY_NPC_SEEDS.map((testimony) => ({
      id: testimony.testimonyId,
      label: testimony.displayName,
      anchor: testimony.anchor,
      entityId: testimony.entityId,
    }))
  );

export const CH1_THREE_ANSWER_ROUTE: readonly Ch1ObjectiveRouteStop[] =
  Object.freeze([
    { id: "ranger_jane", label: "Ranger Jane", anchor: "ranger_jane" },
    {
      id: "cressa_vane",
      label: "Arbiter Cressa Vane",
      anchor: "returnstone_pad_office",
    },
    {
      id: "halden_rook",
      label: "Halden Rook",
      anchor: "gate_desert",
    },
  ]);

export interface Ch1SupplierRouteStop extends Ch1ObjectiveRouteStop {
  vendorId: string;
}

export const CH1_GROVE_SUPPLIER_ROUTE: readonly Ch1SupplierRouteStop[] =
  Object.freeze([
    {
      id: "rin",
      label: "Rin the Forager",
      anchor: "rin_forager",
      vendorId: "grove_rin_forager",
    },
    {
      id: "fern",
      label: "Fern the Grower",
      anchor: "fern_grower",
      vendorId: "grove_fern_grower",
    },
    {
      id: "gus",
      label: "Gus the Baker",
      anchor: "gus_baker",
      vendorId: "grove_gus_baker",
    },
    {
      id: "carlo",
      label: "Carlo the Cook",
      anchor: "carlo_cook",
      vendorId: "grove_carlo_cook",
    },
    {
      id: "mel",
      label: "Mel the Handyman",
      anchor: "mel_handyman",
      vendorId: "grove_mel_handyman",
    },
    {
      id: "luis",
      label: "Luis",
      anchor: "luis_repair_cart",
      vendorId: "grove_luis_repairs",
    },
  ]);

export function ch1RouteStopPosition(stop: Ch1ObjectiveRouteStop): Ch1Vec3 {
  return CH1_ANCHORS[stop.anchor];
}

export function ch1NextRouteStop(
  route: readonly Ch1ObjectiveRouteStop[],
  completed: readonly string[]
) {
  const done = new Set(completed);
  return route.find((stop) => !done.has(stop.id));
}

export function ch1NextSupplierRouteStop(
  vendorTransactions: Readonly<Record<string, number>>
) {
  return CH1_GROVE_SUPPLIER_ROUTE.find(
    (stop) => Number(vendorTransactions[stop.vendorId] ?? 0) < 1
  );
}
