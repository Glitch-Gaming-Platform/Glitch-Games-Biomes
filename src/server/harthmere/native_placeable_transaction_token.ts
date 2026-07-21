import { getSecret } from "@/server/shared/secrets";
import type { BiomesId } from "@/shared/ids";
import type { ReadonlyVec2, ReadonlyVec3 } from "@/shared/math/types";
import * as jwt from "jsonwebtoken";

const TOKEN_VERSION = 1 as const;

export interface HarthmerePlaceableAuthorizationInput {
  id: BiomesId;
  transaction_id: string;
  operation: string;
  entity_id: BiomesId;
  item_id: BiomesId;
  position: ReadonlyVec3;
  orientation: ReadonlyVec2;
  old_position: ReadonlyVec3;
  old_orientation: ReadonlyVec2;
}

function payloadFor(input: HarthmerePlaceableAuthorizationInput) {
  return {
    v: TOKEN_VERSION,
    u: input.id,
    t: input.transaction_id,
    op: input.operation,
    e: input.entity_id,
    item: input.item_id,
    p: [...input.position],
    o: [...input.orientation],
    oldP: [...input.old_position],
    oldO: [...input.old_orientation],
  };
}

export function authorizeHarthmerePlaceableTransaction(
  input: HarthmerePlaceableAuthorizationInput
) {
  return jwt.sign(
    payloadFor(input),
    getSecret("game-action-permission-token-secret"),
    { algorithm: "HS512", expiresIn: 5 * 60 }
  );
}

export function validateHarthmerePlaceableTransactionAuthorization(
  input: HarthmerePlaceableAuthorizationInput,
  authorization: string
) {
  try {
    const decoded = jwt.verify(
      authorization,
      getSecret("game-action-permission-token-secret"),
      { algorithms: ["HS512"] }
    );
    if (typeof decoded === "string") return false;
    return (
      JSON.stringify(payloadFor(input)) ===
      JSON.stringify({
        v: decoded.v,
        u: decoded.u,
        t: decoded.t,
        op: decoded.op,
        e: decoded.e,
        item: decoded.item,
        p: decoded.p,
        o: decoded.o,
        oldP: decoded.oldP,
        oldO: decoded.oldO,
      })
    );
  } catch {
    return false;
  }
}
