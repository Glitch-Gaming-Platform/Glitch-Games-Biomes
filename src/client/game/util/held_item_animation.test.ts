import {
  harthmereHeldBowClipForEmote,
  harthmereHeldGunClipForEmote,
  harthmereHeldItemClipForEmote,
  harthmereRangedBodyActionForState,
  resolveAvailableHeldItemAnimation,
} from "@/client/game/util/held_item_animation";
import type { HarthmerePremiumWeaponDefinition } from "@/shared/harthmere/premium_weapon_catalog";
import assert from "assert";

function weapon(
  profile: HarthmerePremiumWeaponDefinition["profile"],
  idleClip: string,
  family = "sword"
) {
  return { profile, idleClip, family } as HarthmerePremiumWeaponDefinition;
}

describe("held-item animation sync", () => {
  it("keeps bow release variants on the release clip", () => {
    assert.equal(harthmereHeldBowClipForEmote("rangedAim"), "AimDraw_24");
    assert.equal(
      harthmereHeldBowClipForEmote("rangedReleaseVar4"),
      "Release_24"
    );
    assert.equal(harthmereHeldBowClipForEmote("rangedReload"), "Reload_24");
    assert.equal(harthmereHeldGunClipForEmote("rangedAim"), "IdleAim_24");
    assert.equal(harthmereHeldGunClipForEmote("rangedRelease"), "Fire_24");
  });

  it("activates distinct bow and gun body actions only with a combat target", () => {
    const bow = weapon("ranged", "IdleAim_24", "bow");
    const gun = weapon("ranged", "IdleAim_24", "energy_weapon");

    assert.equal(
      harthmereRangedBodyActionForState({
        weapon: bow,
        emoteType: undefined,
        targetActive: false,
      }),
      undefined
    );
    assert.equal(
      harthmereRangedBodyActionForState({
        weapon: bow,
        emoteType: undefined,
        targetActive: true,
      }),
      "bowAim"
    );
    assert.equal(
      harthmereRangedBodyActionForState({
        weapon: bow,
        emoteType: "rangedRelease",
        targetActive: true,
      }),
      "bowRelease"
    );
    assert.equal(
      harthmereRangedBodyActionForState({
        weapon: gun,
        emoteType: undefined,
        targetActive: true,
      }),
      "gunAim"
    );
    assert.equal(
      harthmereRangedBodyActionForState({
        weapon: gun,
        emoteType: "rangedRelease",
        targetActive: true,
      }),
      "gunFire"
    );
  });

  it("maps body attack families to profile-specific held-item clips", () => {
    assert.equal(
      harthmereHeldItemClipForEmote(
        weapon("melee", "IdleDrawn_24"),
        "attack1Var3"
      ),
      "BasicSlash_24"
    );
    assert.equal(
      harthmereHeldItemClipForEmote(weapon("melee", "IdleDrawn_24"), "attack2"),
      "HeavySlash_24"
    );
    assert.equal(
      harthmereHeldItemClipForEmote(
        weapon("magic", "Channel_24"),
        "magicCastVar2"
      ),
      "Cast_24"
    );
    assert.equal(
      harthmereHeldItemClipForEmote(
        weapon("shield", "IdleGuard_24"),
        "shieldBashVar1"
      ),
      "ShieldBash_24"
    );
    assert.equal(
      harthmereHeldItemClipForEmote(
        weapon("ranged", "IdleAim_24", "bow"),
        "rangedRelease"
      ),
      "Release_24"
    );
    assert.equal(
      harthmereHeldItemClipForEmote(
        weapon("ranged", "IdleAim_24", "energy_weapon"),
        "rangedRelease"
      ),
      "Fire_24"
    );
  });

  it("falls back to the available idle clip when an asset lacks its action clip", () => {
    assert.deepEqual(
      resolveAvailableHeldItemAnimation(["IdleDrawn_24"], {
        clipName: "BasicSlash_24",
        localTimeSeconds: 0.18,
        fallbackClipName: "IdleDrawn_24",
        fallbackLocalTimeSeconds: 12.5,
      }),
      { clipName: "IdleDrawn_24", localTimeSeconds: 12.5 }
    );
    assert.deepEqual(
      resolveAvailableHeldItemAnimation(["IdleAim_24", "Release_24"], {
        clipName: "Release_24",
        localTimeSeconds: 0.08,
        fallbackClipName: "IdleAim_24",
        fallbackLocalTimeSeconds: 12.5,
      }),
      { clipName: "Release_24", localTimeSeconds: 0.08 }
    );
  });
});
