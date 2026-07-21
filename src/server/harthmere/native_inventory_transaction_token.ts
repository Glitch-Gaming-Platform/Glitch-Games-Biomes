import { getSecret } from "@/server/shared/secrets";
import type { ReadonlyItemBag } from "@/shared/ecs/gen/types";
import { itemBagToString } from "@/shared/game/items_serde";
import type { BiomesId } from "@/shared/ids";
import * as jwt from "jsonwebtoken";

const TOKEN_VERSION = 1 as const;
const TOKEN_MAX_AGE_SECONDS = 5 * 60;

export interface HarthmereInventoryTransactionAuthorizationInput {
  id: BiomesId;
  transaction_id: string;
  take: ReadonlyItemBag;
  give: ReadonlyItemBag;
  storage_take: ReadonlyItemBag;
  storage_give: ReadonlyItemBag;
  storage_max_slots: number;
  personal_bank_take: ReadonlyItemBag;
  personal_bank_give: ReadonlyItemBag;
  personal_bank_max_slots: number;
  account_bank_take: ReadonlyItemBag;
  account_bank_give: ReadonlyItemBag;
  account_bank_max_slots: number;
  gold_delta: bigint;
  publish_craft: boolean;
  station_entity_id?: BiomesId;
  robot_entity_id?: BiomesId;
  robot_energy_delta: number;
  write_standing: boolean;
  standing_scope: string;
  standing_likeability: number;
  standing_legal: number;
  standing_notoriety: number;
  standing_notoriety_floor: number;
}

interface HarthmereInventoryTransactionAuthorizationPayload {
  v: typeof TOKEN_VERSION;
  u: BiomesId;
  t: string;
  take: string;
  give: string;
  storageTake: string;
  storageGive: string;
  storageMaxSlots: number;
  personalBankTake: string;
  personalBankGive: string;
  personalBankMaxSlots: number;
  accountBankTake: string;
  accountBankGive: string;
  accountBankMaxSlots: number;
  gold: string;
  craft: boolean;
  station: BiomesId | null;
  robot: BiomesId | null;
  robotEnergy: number;
  standing: [string, number, number, number, number] | null;
}

function payloadFor(
  input: HarthmereInventoryTransactionAuthorizationInput
): HarthmereInventoryTransactionAuthorizationPayload {
  return {
    v: TOKEN_VERSION,
    u: input.id,
    t: input.transaction_id,
    take: itemBagToString(input.take),
    give: itemBagToString(input.give),
    storageTake: itemBagToString(input.storage_take),
    storageGive: itemBagToString(input.storage_give),
    storageMaxSlots: input.storage_max_slots,
    personalBankTake: itemBagToString(input.personal_bank_take),
    personalBankGive: itemBagToString(input.personal_bank_give),
    personalBankMaxSlots: input.personal_bank_max_slots,
    accountBankTake: itemBagToString(input.account_bank_take),
    accountBankGive: itemBagToString(input.account_bank_give),
    accountBankMaxSlots: input.account_bank_max_slots,
    gold: input.gold_delta.toString(),
    craft: input.publish_craft,
    station: input.station_entity_id ?? null,
    robot: input.robot_entity_id ?? null,
    robotEnergy: input.robot_energy_delta,
    standing: input.write_standing
      ? [
          input.standing_scope,
          input.standing_likeability,
          input.standing_legal,
          input.standing_notoriety,
          input.standing_notoriety_floor,
        ]
      : null,
  };
}

/**
 * Sign the complete value-moving transaction, not only its replay key. Logic
 * and web share this secret; browsers never receive it and therefore cannot
 * turn the internal bridge event into an arbitrary item/currency grant.
 */
export function authorizeHarthmereInventoryTransaction(
  input: HarthmereInventoryTransactionAuthorizationInput
) {
  return jwt.sign(
    payloadFor(input),
    getSecret("game-action-permission-token-secret"),
    {
      algorithm: "HS512",
      expiresIn: TOKEN_MAX_AGE_SECONDS,
    }
  );
}

export function validateHarthmereInventoryTransactionAuthorization(
  input: HarthmereInventoryTransactionAuthorizationInput,
  authorization: string
) {
  try {
    const decoded = jwt.verify(
      authorization,
      getSecret("game-action-permission-token-secret"),
      { algorithms: ["HS512"] }
    );
    if (typeof decoded === "string") return false;
    const expected = payloadFor(input);
    return (
      decoded.v === expected.v &&
      decoded.u === expected.u &&
      decoded.t === expected.t &&
      decoded.take === expected.take &&
      decoded.give === expected.give &&
      decoded.storageTake === expected.storageTake &&
      decoded.storageGive === expected.storageGive &&
      decoded.storageMaxSlots === expected.storageMaxSlots &&
      decoded.personalBankTake === expected.personalBankTake &&
      decoded.personalBankGive === expected.personalBankGive &&
      decoded.personalBankMaxSlots === expected.personalBankMaxSlots &&
      decoded.accountBankTake === expected.accountBankTake &&
      decoded.accountBankGive === expected.accountBankGive &&
      decoded.accountBankMaxSlots === expected.accountBankMaxSlots &&
      decoded.gold === expected.gold &&
      decoded.craft === expected.craft &&
      decoded.station === expected.station &&
      decoded.robot === expected.robot &&
      decoded.robotEnergy === expected.robotEnergy &&
      JSON.stringify(decoded.standing) === JSON.stringify(expected.standing)
    );
  } catch {
    return false;
  }
}
