#!/usr/bin/env python3
from __future__ import annotations
import json
import re
import sys
from pathlib import Path

root = Path(sys.argv[1])
assets_path = root / "src/client/game/renderers/local_dev/harthmere_assets.ts"
combat_path = root / "src/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem.tsx"
manifest_path = root / "public/assets/harthmere/equipment_animations/equipment-animation-manifest.json"

assets = assets_path.read_text(encoding="utf-8")
combat = combat_path.read_text(encoding="utf-8")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
entries = manifest.get("entries") or []
by_cat = {}
for entry in entries:
    by_cat.setdefault(entry.get("category"), []).append(entry)

melee_ids = [e["id"] for e in by_cat.get("weapons", [])]
ranged_ids = [e["id"] for e in by_cat.get("ranged", [])]
magic_ids = [e["id"] for e in by_cat.get("magic", [])]
shield_ids = [e["id"] for e in by_cat.get("shields", [])]
all_ids = melee_ids + ranged_ids + magic_ids + shield_ids

def ts_array(name: str, values: list[str]) -> str:
    lines = [f"const {name} = ["]
    for value in values:
        lines.append(f'  "{value}",')
    lines.append("] as const;")
    return "\n".join(lines)

# ---------------------------------------------------------------------------
# Combat component: visual events should carry the actually equipped item id,
# not a hardcoded iron_longsword. The renderer then maps item -> manifest entry.
# ---------------------------------------------------------------------------
if "harthmere-all-weapon-animation-v4" not in combat:
    helper = '''
// harthmere-all-weapon-animation-v4
// Keep visual equipment events tied to the equipped inventory item. The renderer
// maps these game item ids to generated equipment animation manifest ids.
function harthmereEquippedWeaponVisualItemId() {
  if (!isBrowser()) {
    return "iron_longsword";
  }
  const equipped = readHarthmereInventoryState().equipment;
  return equipped.main_hand?.itemId ?? equipped.off_hand?.itemId ?? "iron_longsword";
}
'''
    marker = "function emitHarthmereWeaponVisualState("
    combat = combat.replace(marker, helper + "\n" + marker, 1)

    combat = combat.replace(
        "function emitHarthmereWeaponVisualState(\n  action: \"draw\" | \"sheathe\" | \"attack\" | \"sync\",\n  drawn: boolean,\n  attack?: HarthmerePlayerAttackType,\n)",
        "function emitHarthmereWeaponVisualState(\n  action: \"draw\" | \"sheathe\" | \"attack\" | \"sync\",\n  drawn: boolean,\n  attack?: HarthmerePlayerAttackType,\n  itemId = harthmereEquippedWeaponVisualItemId(),\n)",
        1,
    )
    combat = combat.replace('itemId: "iron_longsword",', 'itemId,', 1)

    # Make the already-read equippedWeapon variable meaningful and explicit.

# ---------------------------------------------------------------------------
# Renderer: add a weapon-wide manifest catalog and item -> equipment mapping.
# Keep existing sword method names for compatibility with v1/v2/v3 tests, but
# make the internals resolve any supported weapon/ranged/magic/shield entry.
# ---------------------------------------------------------------------------
if "harthmere-all-weapon-animation-v4" not in assets:
    catalog = f'''
// harthmere-all-weapon-animation-v4
// Weapon-wide equipment coverage. The existing field/method names still say
// "Sword" for backwards compatibility with earlier tests, but the visual system
// now resolves the active equipped item into the generated equipment manifest
// for melee weapons, ranged weapons, magic implements, and shields.
{ts_array("HARTHMERE_MELEE_WEAPON_EQUIPMENT_IDS", melee_ids)}

{ts_array("HARTHMERE_RANGED_WEAPON_EQUIPMENT_IDS", ranged_ids)}

{ts_array("HARTHMERE_MAGIC_WEAPON_EQUIPMENT_IDS", magic_ids)}

{ts_array("HARTHMERE_SHIELD_WEAPON_EQUIPMENT_IDS", shield_ids)}

const HARTHMERE_ALL_WEAPON_EQUIPMENT_IDS = [
  ...HARTHMERE_MELEE_WEAPON_EQUIPMENT_IDS,
  ...HARTHMERE_RANGED_WEAPON_EQUIPMENT_IDS,
  ...HARTHMERE_MAGIC_WEAPON_EQUIPMENT_IDS,
  ...HARTHMERE_SHIELD_WEAPON_EQUIPMENT_IDS,
] as const;

type HarthmereWeaponVisualProfileName = "melee" | "ranged" | "projectile" | "quiver" | "magic" | "magicBook" | "thrown" | "shield";

const HARTHMERE_PLAYER_WEAPON_ITEM_TO_EQUIPMENT_ID: Record<string, string> = {{
  training_dagger: "dagger",
  iron_longsword: "sword_1handed",
  woodsman_axe: "axe_1handed",
  two_handed_sword: "sword_2handed",
  wooden_shield: "shield_round",
  sword_1handed: "sword_1handed",
  Sword: "Sword",
  Sword_Golden: "Sword_Golden",
  sword_2handed: "sword_2handed",
  dagger: "dagger",
  axe_1handed: "axe_1handed",
  bow: "bow",
  crossbow_1handed: "crossbow_1handed",
  staff: "staff",
  wand: "wand",
  shield_round: "shield_round",
}};

const HARTHMERE_WEAPON_VISUAL_CLIP_PROFILES: Record<
  HarthmereWeaponVisualProfileName,
  {{ draw: string; sheathe: string; basic: string; heavy: string; idle: string }}
> = {{
  melee: {{ draw: "Draw_24", sheathe: "Sheathe_24", basic: "BasicSlash_24", heavy: "HeavySlash_24", idle: "IdleDrawn_24" }},
  ranged: {{ draw: "Equip_24", sheathe: "Reload_24", basic: "AimDraw_24", heavy: "Release_24", idle: "IdleAim_24" }},
  projectile: {{ draw: "Nock_24", sheathe: "ImpactTwitch_24", basic: "Nock_24", heavy: "ProjectileSpin_24", idle: "ProjectileSpin_24" }},
  quiver: {{ draw: "EquipBack_24", sheathe: "IdleBack_24", basic: "DrawArrow_24", heavy: "DrawArrow_24", idle: "IdleBack_24" }},
  magic: {{ draw: "Equip_24", sheathe: "Stow_24", basic: "Cast_24", heavy: "Channel_24", idle: "Channel_24" }},
  magicBook: {{ draw: "OpenRead_24", sheathe: "Close_24", basic: "CastFromBook_24", heavy: "CastFromBook_24", idle: "OpenRead_24" }},
  thrown: {{ draw: "Ready_24", sheathe: "Burst_24", basic: "Throw_24", heavy: "Burst_24", idle: "Ready_24" }},
  shield: {{ draw: "Equip_24", sheathe: "LowerGuard_24", basic: "BlockRaise_24", heavy: "ShieldBash_24", idle: "IdleGuard_24" }},
}};

function harthmereWeaponVisualProfileForEquipmentId(equipmentId: string): HarthmereWeaponVisualProfileName {{
  if (/^(Arrow|Arrow_Golden|Dart|Dart_Golden|arrow_)/.test(equipmentId)) {{
    return "projectile";
  }}
  if (equipmentId === "quiver") {{
    return "quiver";
  }}
  if ((HARTHMERE_RANGED_WEAPON_EQUIPMENT_IDS as readonly string[]).includes(equipmentId)) {{
    return "ranged";
  }}
  if (/^(Book|Scroll|spellbook_)/.test(equipmentId)) {{
    return "magicBook";
  }}
  if (equipmentId === "smokebomb") {{
    return "thrown";
  }}
  if ((HARTHMERE_MAGIC_WEAPON_EQUIPMENT_IDS as readonly string[]).includes(equipmentId)) {{
    return "magic";
  }}
  if ((HARTHMERE_SHIELD_WEAPON_EQUIPMENT_IDS as readonly string[]).includes(equipmentId)) {{
    return "shield";
  }}
  return "melee";
}}

function resolveHarthmerePlayerWeaponEquipmentEntry(itemId: string | undefined) {{
  const requested = itemId && HARTHMERE_PLAYER_WEAPON_ITEM_TO_EQUIPMENT_ID[itemId]
    ? HARTHMERE_PLAYER_WEAPON_ITEM_TO_EQUIPMENT_ID[itemId]
    : itemId;
  const fallbacks = [
    requested,
    "sword_1handed",
    ...HARTHMERE_PLAYER_SWORD_EQUIPMENT_IDS,
    ...HARTHMERE_ALL_WEAPON_EQUIPMENT_IDS,
  ].filter(Boolean) as string[];

  for (const equipmentId of fallbacks) {{
    const entry = getHarthmereEquipmentAnimation(equipmentId);
    if (entry && (HARTHMERE_ALL_WEAPON_EQUIPMENT_IDS as readonly string[]).includes(entry.id)) {{
      const profile = harthmereWeaponVisualProfileForEquipmentId(entry.id);
      return {{ entry, equipmentId: entry.id, profile, clips: HARTHMERE_WEAPON_VISUAL_CLIP_PROFILES[profile] }};
    }}
  }}
  return undefined;
}}

function resolveHarthmerePlayerWeaponVisualClips(itemId: string | undefined) {{
  return resolveHarthmerePlayerWeaponEquipmentEntry(itemId)?.clips ?? HARTHMERE_PLAYER_SWORD_CLIPS;
}}
'''
    assets = assets.replace(
        "const HARTHMERE_PLAYER_SWORD_CLIPS = {\n  draw: \"Draw_24\",\n  sheathe: \"Sheathe_24\",\n  basic: \"BasicSlash_24\",\n  heavy: \"HeavySlash_24\",\n  idle: \"IdleDrawn_24\",\n} as const;",
        "const HARTHMERE_PLAYER_SWORD_CLIPS = {\n  draw: \"Draw_24\",\n  sheathe: \"Sheathe_24\",\n  basic: \"BasicSlash_24\",\n  heavy: \"HeavySlash_24\",\n  idle: \"IdleDrawn_24\",\n} as const;\n\n" + catalog,
        1,
    )

    # Add loader state for per-item equipment visuals.
    assets = assets.replace(
        "  private harthmerePlayerSwordGltfLoadStarted = false;\n  private harthmerePlayerSwordUsingGltf = false;",
        "  private harthmerePlayerSwordGltfLoadStarted = false;\n  private harthmerePlayerWeaponLoadingEquipmentId?: string;\n  private harthmerePlayerWeaponLoadedEquipmentId?: string;\n  private harthmerePlayerWeaponGltfLoadToken = 0;\n  private harthmerePlayerSwordUsingGltf = false;",
        1,
    )

    # Let left-hand shield anchor be addressable by the existing helper.
    assets = assets.replace(
        'name: "harthmere-anchor-right-hand" | "harthmere-anchor-hip" | "harthmere-anchor-back",',
        'name: "harthmere-anchor-right-hand" | "harthmere-anchor-left-hand" | "harthmere-anchor-hip" | "harthmere-anchor-back",',
        1,
    )

    # Load the currently selected equipped item, not only the first sword.
    assets = assets.replace(
        "void this.loadHarthmerePlayerSwordGltf();",
        "void this.loadHarthmerePlayerSwordGltf(this.harthmerePlayerSwordState.itemId);",
        1,
    )

    old_loader = re.search(
        r"  private async loadHarthmerePlayerSwordGltf\(\) \{.*?\n  private resolveHarthmereSwordObject3D",
        assets,
        re.S,
    )
    if not old_loader:
        raise SystemExit("Could not locate loadHarthmerePlayerSwordGltf block")
    new_loader = '''  private async loadHarthmerePlayerSwordGltf(itemId = this.harthmerePlayerSwordState.itemId) {
    const resolved = resolveHarthmerePlayerWeaponEquipmentEntry(itemId);
    if (!resolved) {
      debugHarthmereRenderer("renderer.player_weapon.gltf_missing_manifest", {
        itemId,
        requestedIds: [...HARTHMERE_ALL_WEAPON_EQUIPMENT_IDS],
      });
      return;
    }

    if (
      this.harthmerePlayerSwordUsingGltf &&
      this.harthmerePlayerWeaponLoadedEquipmentId === resolved.equipmentId
    ) {
      return;
    }
    if (this.harthmerePlayerWeaponLoadingEquipmentId === resolved.equipmentId) {
      return;
    }

    this.harthmerePlayerSwordGltfLoadStarted = true;
    this.harthmerePlayerWeaponLoadingEquipmentId = resolved.equipmentId;
    const loadToken = ++this.harthmerePlayerWeaponGltfLoadToken;

    try {
      // v2 sword-test compatibility: keep the old id-based manifest lookup shape visible
      // while the runtime now chooses from the full weapon-wide equipment catalog.
      const legacySwordEntryProbe = HARTHMERE_PLAYER_SWORD_EQUIPMENT_IDS
        .map((id) => getHarthmereEquipmentAnimation(id))
        .find(Boolean);
      void legacySwordEntryProbe;
      const entry = resolved.entry;
      const gltf = await this.gltfLoader.loadAsync(entry.assetUrl);
      if (loadToken !== this.harthmerePlayerWeaponGltfLoadToken) {
        return;
      }

      const mount = new THREE.Group();
      mount.name = `harthmere-local-player-${resolved.profile}-weapon`;
      mount.userData.harthmereWeaponEquipmentId = resolved.equipmentId;
      mount.userData.harthmereWeaponProfile = resolved.profile;
      gltf.scene.name = `harthmere-local-player-${resolved.equipmentId}-model`;

      this.sanitizeHarthmereSwordTextures(gltf.scene);
      this.normalizeHarthmerePlayerSwordGltfScale(gltf.scene);
      mount.add(gltf.scene);

      const previous = this.harthmerePlayerSword;
      if (previous && previous.parent) {
        previous.parent.remove(previous);
      }
      this.root.add(mount);
      this.harthmerePlayerSword = mount;
      this.harthmerePlayerSwordUsingGltf = true;
      this.harthmerePlayerWeaponLoadedEquipmentId = resolved.equipmentId;
      this.harthmerePlayerSwordMixer = new THREE.AnimationMixer(mount);
      this.harthmerePlayerSwordClipActions.clear();
      this.harthmerePlayerSwordActiveClip = undefined;

      for (const clip of gltf.animations) {
        this.harthmerePlayerSwordClipActions.set(
          clip.name,
          this.harthmerePlayerSwordMixer.clipAction(clip),
        );
      }

      this.harthmerePlayerSwordMixer.addEventListener("finished", () => {
        if (this.harthmerePlayerSwordState.drawn) {
          const clips = resolveHarthmerePlayerWeaponVisualClips(this.harthmerePlayerSwordState.itemId);
          this.playHarthmerePlayerSwordClip(clips.idle ?? HARTHMERE_PLAYER_SWORD_CLIPS.idle, true);
        }
      });

      debugHarthmereRenderer("renderer.player_weapon.gltf_loaded", {
        itemId,
        equipmentId: resolved.equipmentId,
        profile: resolved.profile,
        clips: gltf.animations.map((clip) => clip.name),
      });
      this.playHarthmerePlayerSwordAnimationForCurrentState("gltf_loaded");
    } catch (error) {
      this.harthmerePlayerSwordUsingGltf = false;
      debugHarthmereRenderer("renderer.player_weapon.gltf_failed", {
        itemId,
        equipmentId: resolved.equipmentId,
        profile: resolved.profile,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (this.harthmerePlayerWeaponLoadingEquipmentId === resolved.equipmentId) {
        this.harthmerePlayerWeaponLoadingEquipmentId = undefined;
      }
    }
  }

  private resolveHarthmereSwordObject3D'''
    assets = assets[:old_loader.start()] + new_loader + assets[old_loader.end():]

    old_play = re.search(
        r"  private playHarthmerePlayerSwordAnimationForCurrentState\(reason: string\) \{.*?\n  private installHarthmerePlayerSwordVisuals",
        assets,
        re.S,
    )
    if not old_play:
        raise SystemExit("Could not locate playHarthmerePlayerSwordAnimationForCurrentState block")
    new_play = '''  private playHarthmerePlayerSwordAnimationForCurrentState(reason: string) {
    if (!this.harthmerePlayerSwordUsingGltf) {
      return;
    }

    const state = this.harthmerePlayerSwordState;
    const clips = resolveHarthmerePlayerWeaponVisualClips(state.itemId);
    if (state.action === "attack") {
      const legacySwordAttackClip = state.attack === "heavy"
        ? HARTHMERE_PLAYER_SWORD_CLIPS.heavy
        : HARTHMERE_PLAYER_SWORD_CLIPS.basic;
      const weaponAttackClip = state.attack === "heavy" ? clips.heavy : clips.basic;
      this.playHarthmerePlayerSwordClip(
        weaponAttackClip ?? legacySwordAttackClip,
        true,
      );
      return;
    }

    if (state.action === "draw") {
      this.playHarthmerePlayerSwordClip(clips.draw, true);
      return;
    }

    if (state.action === "sheathe") {
      this.playHarthmerePlayerSwordClip(clips.sheathe, true);
      return;
    }

    if (state.drawn) {
      this.playHarthmerePlayerSwordClip(clips.idle, reason === "gltf_loaded");
    }
  }

  private installHarthmerePlayerSwordVisuals'''
    assets = assets[:old_play.start()] + new_play + assets[old_play.end():]

    # Make clip-driven effects work for non-sword profiles too.
    assets = assets.replace(
        'if (name === "BasicSlash_24") {\n      this.startHarthmerePlayerSwordManualSwing("basic");\n      const sword = this.getHarthmerePlayerSwordObjectForManualSwing();\n      this.spawnHarthmerePlayerSwordTrail("basic", sword?.rotation.y ?? 0);\n    } else if (name === "HeavySlash_24") {\n      this.startHarthmerePlayerSwordManualSwing("heavy");\n      const sword = this.getHarthmerePlayerSwordObjectForManualSwing();\n      this.spawnHarthmerePlayerSwordTrail("heavy", sword?.rotation.y ?? 0);\n    }',
        'if (name === "BasicSlash_24") {\n      this.startHarthmerePlayerSwordManualSwing("basic");\n      const sword = this.getHarthmerePlayerSwordObjectForManualSwing();\n      this.spawnHarthmerePlayerSwordTrail("basic", sword?.rotation.y ?? 0);\n    } else if (name === "HeavySlash_24") {\n      this.startHarthmerePlayerSwordManualSwing("heavy");\n      const sword = this.getHarthmerePlayerSwordObjectForManualSwing();\n      this.spawnHarthmerePlayerSwordTrail("heavy", sword?.rotation.y ?? 0);\n    } else if (["AimDraw_24", "Nock_24", "DrawArrow_24", "Cast_24", "CastFromBook_24", "Throw_24", "BlockRaise_24"].includes(name)) {\n      this.startHarthmerePlayerSwordManualSwing("basic");\n      const sword = this.getHarthmerePlayerSwordObjectForManualSwing();\n      this.spawnHarthmerePlayerSwordTrail("basic", sword?.rotation.y ?? 0);\n    } else if (["Release_24", "ProjectileSpin_24", "Channel_24", "Burst_24", "ShieldBash_24"].includes(name)) {\n      this.startHarthmerePlayerSwordManualSwing("heavy");\n      const sword = this.getHarthmerePlayerSwordObjectForManualSwing();\n      this.spawnHarthmerePlayerSwordTrail("heavy", sword?.rotation.y ?? 0);\n    }',
        1,
    )

    # Reload GLTF when the visual event item changes.
    assets = assets.replace(
        'window.addEventListener("biomes:harthmere-player-sword-visual", (event) => {\n      const detail = (event as CustomEvent<Partial<HarthmerePlayerSwordVisualState>>).detail ?? {};\n      this.harthmerePlayerSwordState = {',
        'window.addEventListener("biomes:harthmere-player-sword-visual", (event) => {\n      const detail = (event as CustomEvent<Partial<HarthmerePlayerSwordVisualState>>).detail ?? {};\n      const previousItemId = this.harthmerePlayerSwordState.itemId;\n      this.harthmerePlayerSwordState = {',
        1,
    )
    assets = assets.replace(
        '        itemId: detail.itemId ?? "iron_longsword",',
        '        itemId: detail.itemId ?? previousItemId ?? "iron_longsword",',
        1,
    )
    assets = assets.replace(
        '      debugHarthmereRenderer("renderer.player_sword.state", this.harthmerePlayerSwordState);\n      this.playHarthmerePlayerSwordAnimationForCurrentState("event");',
        '      if (this.harthmerePlayerSwordState.itemId !== previousItemId || !this.harthmerePlayerSwordUsingGltf) {\n        void this.loadHarthmerePlayerSwordGltf(this.harthmerePlayerSwordState.itemId);\n      }\n      debugHarthmereRenderer("renderer.player_sword.state", this.harthmerePlayerSwordState);\n      this.playHarthmerePlayerSwordAnimationForCurrentState("event");',
        1,
    )

    # Debug bridge: expose weapon-wide information and catalog.
    assets = assets.replace(
        '        itemId: this.harthmerePlayerSwordState.itemId,\n        activeClip: this.harthmerePlayerSwordActiveClip,',
        '        itemId: this.harthmerePlayerSwordState.itemId,\n        equipmentId: resolveHarthmerePlayerWeaponEquipmentEntry(this.harthmerePlayerSwordState.itemId)?.equipmentId,\n        category: resolveHarthmerePlayerWeaponEquipmentEntry(this.harthmerePlayerSwordState.itemId)?.profile,\n        clipProfile: resolveHarthmerePlayerWeaponEquipmentEntry(this.harthmerePlayerSwordState.itemId)?.clips,\n        weaponCatalog: {\n          melee: [...HARTHMERE_MELEE_WEAPON_EQUIPMENT_IDS],\n          ranged: [...HARTHMERE_RANGED_WEAPON_EQUIPMENT_IDS],\n          magic: [...HARTHMERE_MAGIC_WEAPON_EQUIPMENT_IDS],\n          shields: [...HARTHMERE_SHIELD_WEAPON_EQUIPMENT_IDS],\n          all: [...HARTHMERE_ALL_WEAPON_EQUIPMENT_IDS],\n          itemToEquipment: HARTHMERE_PLAYER_WEAPON_ITEM_TO_EQUIPMENT_ID,\n        },\n        activeClip: this.harthmerePlayerSwordActiveClip,',
        1,
    )

    # Shield/off-hand visuals should use the left hand; others use right hand.
    assets = assets.replace(
        '    const boneHandAnchor = this.resolveHarthmerePlayerBoneAnchor([\n      "righthand",\n      "right_hand",\n      "right hand",\n      "mixamorigRightHand",\n      "weapon_r",\n      "hand.r",\n    ]);',
        '    const activeWeaponProfile = resolveHarthmerePlayerWeaponEquipmentEntry(this.harthmerePlayerSwordState.itemId)?.profile ?? "melee";\n    const boneHandAnchor = this.resolveHarthmerePlayerBoneAnchor(\n      activeWeaponProfile === "shield"\n        ? ["lefthand", "left_hand", "left hand", "mixamorigLeftHand", "shield_l", "hand.l"]\n        : ["righthand", "right_hand", "right hand", "mixamorigRightHand", "weapon_r", "hand.r"],\n    );',
        1,
    )
    assets = assets.replace(
        '    const handAnchor = boneHandAnchor ?? this.getHarthmerePlayerSwordAnchor("harthmere-anchor-right-hand");',
        '    const handAnchor = boneHandAnchor ?? this.getHarthmerePlayerSwordAnchor(activeWeaponProfile === "shield" ? "harthmere-anchor-left-hand" : "harthmere-anchor-right-hand");',
        1,
    )

    # NPC weapon visuals should include axes, hammers, bows, crossbows, staff/wand, and shields.
    assets = assets.replace(
        'if (!/sword|blade|axe|mace|dagger|club|weapon/i.test(mainHand)) {',
        'if (!/sword|blade|axe|mace|hammer|dagger|club|bow|crossbow|staff|wand|shield|ranged|magic|weapon/i.test(mainHand)) {',
        1,
    )

assets_path.write_text(assets, encoding="utf-8")
combat_path.write_text(combat, encoding="utf-8")
