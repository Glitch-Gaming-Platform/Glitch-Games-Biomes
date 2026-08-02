import { getSecret } from "@/server/shared/secrets";
import type { ReadonlyVec2f, ReadonlyVec3f } from "@/shared/ecs/gen/types";
import type { BiomesId } from "@/shared/ids";
import * as jwt from "jsonwebtoken";

const TOKEN_VERSION = 2 as const;
const TOKEN_MAX_AGE_SECONDS = 5 * 60;

export interface Ch1WarpAuthorizationInput {
  id: BiomesId;
  action: string;
  dungeon_id: string;
  run_id: string;
  party_id: string;
  reset_encounters: boolean;
  position: ReadonlyVec3f;
  orientation: ReadonlyVec2f;
}

function payloadFor(input: Ch1WarpAuthorizationInput) {
  // Camera orientation is presentation-only and may be normalized while the
  // generated event crosses the Web-to-Logic transport. Keep the exact warp
  // destination and every transition/admission field authoritative instead.
  return {
    v: TOKEN_VERSION,
    u: input.id,
    action: input.action,
    dungeon: input.dungeon_id,
    run: input.run_id,
    party: input.party_id,
    reset: input.reset_encounters,
    position: [...input.position],
  };
}

export function authorizeCh1Warp(input: Ch1WarpAuthorizationInput) {
  return jwt.sign(
    payloadFor(input),
    getSecret("game-action-permission-token-secret"),
    { algorithm: "HS512", expiresIn: TOKEN_MAX_AGE_SECONDS }
  );
}

export function validateCh1WarpAuthorization(
  input: Ch1WarpAuthorizationInput,
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
      decoded.action === expected.action &&
      decoded.dungeon === expected.dungeon &&
      decoded.run === expected.run &&
      decoded.party === expected.party &&
      decoded.reset === expected.reset &&
      JSON.stringify(decoded.position) === JSON.stringify(expected.position)
    );
  } catch {
    return false;
  }
}
