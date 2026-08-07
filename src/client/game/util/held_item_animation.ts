import type { HarthmerePremiumWeaponDefinition } from "@/shared/harthmere/premium_weapon_catalog";

export const HARTHMERE_HELD_ITEM_ANIMATION_SYNC_VERSION =
  "harthmere-held-item-animation-sync-v2" as const;

export interface HeldItemAnimationRequest {
  clipName: string;
  localTimeSeconds: number;
  fallbackClipName?: string;
  fallbackLocalTimeSeconds?: number;
}

export interface ResolvedHeldItemAnimation {
  clipName: string;
  localTimeSeconds: number;
}

export type HarthmereRangedBodyStyle = "bow" | "gun";
export type HarthmereRangedBodyAction =
  "bowAim" | "bowRelease" | "gunAim" | "gunFire";

const hasPrefix = (value: string | undefined, prefix: string) =>
  value?.startsWith(prefix) ?? false;

export function harthmereHeldBowClipForEmote(emoteType: string | undefined) {
  if (hasPrefix(emoteType, "rangedRelease")) return "Release_24";
  if (hasPrefix(emoteType, "rangedReload")) return "Reload_24";
  if (hasPrefix(emoteType, "rangedAim")) return "AimDraw_24";
  return "IdleAim_24";
}

export function harthmereHeldGunClipForEmote(emoteType: string | undefined) {
  if (hasPrefix(emoteType, "rangedRelease")) return "Fire_24";
  return "IdleAim_24";
}

export function harthmereRangedBodyStyleForWeapon(
  weapon: HarthmerePremiumWeaponDefinition | undefined
): HarthmereRangedBodyStyle | undefined {
  if (weapon?.family === "bow") return "bow";
  if (weapon?.family === "energy_weapon") return "gun";
  return undefined;
}

/**
 * The weapon-specific stance is deliberately target-gated. Equipping a bow or
 * gun during exploration does not freeze the avatar into a combat pose; a
 * valid lock/cursor target activates aim, and the matching ranged emote swaps
 * that stance to the fast release/fire action.
 */
export function harthmereRangedBodyActionForState(input: {
  weapon: HarthmerePremiumWeaponDefinition | undefined;
  emoteType: string | undefined;
  targetActive: boolean;
}): HarthmereRangedBodyAction | undefined {
  if (!input.targetActive) return undefined;
  const style = harthmereRangedBodyStyleForWeapon(input.weapon);
  if (!style) return undefined;
  if (hasPrefix(input.emoteType, "rangedRelease")) {
    return style === "bow" ? "bowRelease" : "gunFire";
  }
  if (!input.emoteType || hasPrefix(input.emoteType, "rangedAim")) {
    return style === "bow" ? "bowAim" : "gunAim";
  }
  return undefined;
}

/**
 * Selects the weapon-local clip that corresponds to the body emote. The held
 * mesh remains parented to the animated Tool socket, so these clips add bow
 * string, shield, spell focus, or weapon-local motion without replacing the
 * authored body swing.
 */
export function harthmereHeldItemClipForEmote(
  weapon: HarthmerePremiumWeaponDefinition,
  emoteType: string | undefined
) {
  switch (weapon.profile) {
    case "ranged":
      if (weapon.family === "bow") {
        return harthmereHeldBowClipForEmote(emoteType);
      }
      if (weapon.family === "energy_weapon") {
        return harthmereHeldGunClipForEmote(emoteType);
      }
      return weapon.idleClip;
    case "melee":
      if (hasPrefix(emoteType, "attack2")) return "HeavySlash_24";
      if (hasPrefix(emoteType, "attack1")) return "BasicSlash_24";
      return weapon.idleClip;
    case "magic":
      if (hasPrefix(emoteType, "magicCast")) return "Cast_24";
      return weapon.idleClip;
    case "magicBook":
      if (hasPrefix(emoteType, "magicCast")) return "CastFromBook_24";
      return weapon.idleClip;
    case "thrown":
      if (hasPrefix(emoteType, "attack2")) return "Burst_24";
      if (hasPrefix(emoteType, "attack1")) return "Throw_24";
      return weapon.idleClip;
    case "shield":
      if (
        hasPrefix(emoteType, "shieldBash") ||
        hasPrefix(emoteType, "attack2")
      ) {
        return "ShieldBash_24";
      }
      if (hasPrefix(emoteType, "shieldBlock") || emoteType === "block") {
        return "BlockRaise_24";
      }
      return weapon.idleClip;
  }
}

/** Resolve an authored action clip, falling back to the asset's idle clip. */
export function resolveAvailableHeldItemAnimation(
  availableClipNames: readonly string[] | undefined,
  request: HeldItemAnimationRequest
): ResolvedHeldItemAnimation | undefined {
  if (!availableClipNames) {
    return {
      clipName: request.clipName,
      localTimeSeconds: request.localTimeSeconds,
    };
  }
  if (availableClipNames.includes(request.clipName)) {
    return {
      clipName: request.clipName,
      localTimeSeconds: request.localTimeSeconds,
    };
  }
  if (
    request.fallbackClipName &&
    availableClipNames.includes(request.fallbackClipName)
  ) {
    return {
      clipName: request.fallbackClipName,
      localTimeSeconds:
        request.fallbackLocalTimeSeconds ?? request.localTimeSeconds,
    };
  }
  return undefined;
}
