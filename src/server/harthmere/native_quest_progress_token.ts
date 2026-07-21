import { getSecret } from "@/server/shared/secrets";
import type { BiomesId } from "@/shared/ids";
import * as jwt from "jsonwebtoken";

const TOKEN_MAX_AGE_SECONDS = 5 * 60;

export interface HarthmereQuestProgressAuthorizationInput {
  id: BiomesId;
  challenge_id: BiomesId;
  step_id: BiomesId;
}

function payload(input: HarthmereQuestProgressAuthorizationInput) {
  return {
    v: 1,
    u: input.id,
    q: input.challenge_id,
    s: input.step_id,
  } as const;
}

export function authorizeHarthmereQuestProgress(
  input: HarthmereQuestProgressAuthorizationInput
) {
  return jwt.sign(
    payload(input),
    getSecret("game-action-permission-token-secret"),
    { algorithm: "HS512", expiresIn: TOKEN_MAX_AGE_SECONDS }
  );
}

export function validateHarthmereQuestProgressAuthorization(
  input: HarthmereQuestProgressAuthorizationInput,
  authorization: string
) {
  try {
    const decoded = jwt.verify(
      authorization,
      getSecret("game-action-permission-token-secret"),
      { algorithms: ["HS512"] }
    );
    if (typeof decoded === "string") return false;
    const expected = payload(input);
    return (
      decoded.v === expected.v &&
      decoded.u === expected.u &&
      decoded.q === expected.q &&
      decoded.s === expected.s
    );
  } catch {
    return false;
  }
}
