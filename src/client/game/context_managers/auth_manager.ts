import type { EarlyClientContext } from "@/client/game/context";
import { logout } from "@/client/util/auth";
import type { SelfProfileResponse } from "@/pages/api/social/self_profile";

import type { SpecialRoles } from "@/shared/acl_types";
import { INVALID_BIOMES_ID, type BiomesId } from "@/shared/ids";
import { log } from "@/shared/logging";
import type { RegistryLoader } from "@/shared/registry";
import { evaluateRole } from "@/shared/roles";
import { fireAndForget } from "@/shared/util/async";
import { jsonFetch } from "@/shared/util/fetch_helpers";
import { asyncBackoffOnAllErrors } from "@/shared/util/retry_helpers";

export class BiomesUser {
  constructor(
    public readonly id: BiomesId,
    public readonly createMs: number | undefined,
    private specialRoles: ReadonlySet<SpecialRoles>
  ) {}

  hasSpecialRole(...requiredRoles: SpecialRoles[]) {
    return evaluateRole(this.specialRoles, ...requiredRoles);
  }

  updateSpecialRoles(newRoles: ReadonlySet<SpecialRoles>) {
    this.specialRoles = newRoles;
  }
}

export class AuthManager {
  constructor(public readonly currentUser: BiomesUser) {}

  private static async fetchUserProfile(userId: BiomesId): Promise<BiomesUser> {
    if (!userId) {
      return new BiomesUser(INVALID_BIOMES_ID, undefined, new Set());
    }
    const profile: SelfProfileResponse = await asyncBackoffOnAllErrors(
      async () => {
        try {
          return await jsonFetch<SelfProfileResponse>(
            "/api/social/self_profile"
          );
        } catch (error) {
          log.error("Error fetching self profile, retrying", { error });
          throw error;
        }
      },
      {
        baseMs: 1000,
        exponent: 1.25,
        maxMs: 10000,
      }
    );
    if (userId !== profile.user.id) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          `User ID mismatch: bootstrap user ${userId} did not match self profile ${profile.user.id}`
        );
      }
      log.warn(
        "Development auth profile user mismatch; recovering with self_profile user",
        {
          bootstrapUserId: userId,
          profileUserId: profile.user.id,
        }
      );
    }
    return new BiomesUser(
      profile.user.id,
      profile.user.createMs,
      new Set(profile.roles)
    );
  }

  static async bootstrap(userId: BiomesId): Promise<AuthManager> {
    return new AuthManager(await this.fetchUserProfile(userId));
  }

  static logout() {
    fireAndForget(
      logout().then(() => {
        setTimeout(() => {
          location.href = "/";
        }, 100);
      })
    );
  }
}

export async function loadAuthManager<C extends EarlyClientContext>(
  loader: RegistryLoader<C>
) {
  return AuthManager.bootstrap(await loader.get("userId"));
}
