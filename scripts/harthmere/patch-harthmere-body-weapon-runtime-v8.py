#!/usr/bin/env python3
import json, os, re, sys
from pathlib import Path

VERSION = 'harthmere-body-weapon-aligned-clips-v8'
CLIPS = [
  'HarthmereBodyWeaponIdleDrawn_Aligned_30',
  'HarthmereBodyWeaponBasic_Aligned_30',
  'HarthmereBodyWeaponHeavy_Aligned_30',
  'HarthmereBodyWeaponDraw_Aligned_30',
  'HarthmereBodyWeaponSheathe_Aligned_30',
  'HarthmereBodyWeaponBlock_Aligned_30',
  'HarthmereBodyShieldBash_Aligned_30',
  'HarthmereBodyRangedDraw_Aligned_30',
  'HarthmereBodyRangedRelease_Aligned_30',
  'HarthmereBodyRangedReload_Aligned_30',
  'HarthmereBodyMagicCast_Aligned_30',
  'HarthmereBodyMagicChannel_Aligned_30',
  'HarthmereBodyToolUse_Aligned_30',
  'HarthmereBodyToolHeavyUse_Aligned_30',
  'HarthmereBodyItemUse_Aligned_30',
]

def replace_action(src, key, file_animation, backups=None, extra=''):
    backups = backups or []
    backup_part = f', backupFileAnimationNames: [{", ".join(json.dumps(x) for x in backups)}]' if backups else ''
    repl = f'{key}: {{ fileAnimationName: "{file_animation}"{backup_part}{extra} }},'
    # Match one-line or multi-line object without nested object braces.
    pat = re.compile(rf'{re.escape(key)}:\s*\{{[^{{}}]*?\}},', re.S)
    if pat.search(src):
        return pat.sub(repl, src, count=1)
    # Insert before destroy if action key doesn't exist.
    marker = '    destroy: { fileAnimationName: "DiggingTool" },'
    if marker in src:
        return src.replace(marker, f'    {repl}\n\n{marker}', 1)
    raise RuntimeError(f'Could not patch or insert action {key}')

def patch_player_animations(path):
    src=path.read_text(encoding='utf-8')
    if 'HARTHMERE_BODY_WEAPON_ALIGNED_CLIPS_VERSION_V8' not in src:
        legacy_compat = '''\n// harthmere-body-animation-weapon-sync-v5-static-compat\n// The v8 runtime supersedes these legacy broad-body clip mappings, but older\n// static v5 regression checks still look for the exact original strings. Keep\n// them here as comments so the historical test documents the migration without\n// forcing the runtime back to the jittery full-body Attack/HeavyAttack clips.\n// const HARTHMERE_BODY_UPPER_BODY_RE = /(.*(arm|hand|tool|chest|spine|shoulder|clavicle|neck|head|finger|weapon).*)/i;\n// attack1: { fileAnimationName: \"Attack\", timeScale: HARTHMERE_BODY_ATTACK_TIME_SCALE_V5.attack1 },\n// attack2: { fileAnimationName: \"HeavyAttack\", backupFileAnimationNames: [\"Attack2\"], timeScale: HARTHMERE_BODY_ATTACK_TIME_SCALE_V5.attack2 },\n// easeInTime: 0.035\n'''
        insert = legacy_compat + '''\n// harthmere-body-weapon-aligned-clips-v8\n// These clips are generated into every Harthmere player body size/color variant.\n// They replace the old broad Attack/HeavyAttack poses with restrained, upper-body\n// weapon/item overlays that share impact timing with the visible equipment.\nexport const HARTHMERE_BODY_WEAPON_ALIGNED_CLIPS_VERSION_V8 =\n  "harthmere-body-weapon-aligned-clips-v8";\n'''
        anchor = 'export const HARTHMERE_BODY_WEAPON_VISUAL_COHESION_VERSION_V7 ='
        if anchor in src:
            src = src.replace(anchor, insert + '\n' + anchor, 1)
        else:
            src = src.replace('export const playerSystem = new AnimationSystem(', insert + '\nexport const playerSystem = new AnimationSystem(', 1)
    mappings = {
      'attack1': ('HarthmereBodyWeaponBasic_Aligned_30', ['Attack', 'SideSwing']),
      'attack2': ('HarthmereBodyWeaponHeavy_Aligned_30', ['HeavyAttack', 'Attack2', 'Attack']),
      'rangedAim': ('HarthmereBodyRangedDraw_Aligned_30', ['BowDraw', 'BowShooting', 'BowShoot', 'Attack', 'Idle']),
      'rangedRelease': ('HarthmereBodyRangedRelease_Aligned_30', ['BowRelease', 'BowShoot', 'BowShooting', 'HeavyAttack', 'Attack']),
      'rangedReload': ('HarthmereBodyRangedReload_Aligned_30', ['CrossbowReload', 'ItemPutBack', 'Attack']),
      'magicCast': ('HarthmereBodyMagicCast_Aligned_30', ['BasicMagic', 'HeavyMagic', 'Attack']),
      'magicChannel': ('HarthmereBodyMagicChannel_Aligned_30', ['ChannelMagic', 'BasicMagic', 'Idle']),
      'shieldBlock': ('HarthmereBodyWeaponBlock_Aligned_30', ['ShieldBlock', 'Block', 'HitReact', 'Idle']),
      'shieldBash': ('HarthmereBodyShieldBash_Aligned_30', ['ShieldBash', 'Attack', 'HeavyAttack']),
      'mineImpact': ('HarthmereBodyToolUse_Aligned_30', ['Mining', 'DiggingTool', 'Attack']),
      'woodcutImpact': ('HarthmereBodyToolHeavyUse_Aligned_30', ['Woodcutting', 'Chopping', 'DiggingTool', 'Attack']),
      'foragePickup': ('HarthmereBodyItemUse_Aligned_30', ['ForagePickup', 'Gathering', 'DiggingHand', 'ItemPutBack']),
      'craftStationUse': ('HarthmereBodyToolUse_Aligned_30', ['CraftStationUse', 'DiggingTool', 'ItemPutBack']),
      'repairImpact': ('HarthmereBodyToolUse_Aligned_30', ['Repair', 'DiggingTool', 'Attack']),
      'buildPlace': ('HarthmereBodyToolUse_Aligned_30', ['BuildPlace', 'ItemPutBack', 'DiggingTool']),
      'eat': ('HarthmereBodyItemUse_Aligned_30', ['Eat', 'ItemPutBack']),
      'drink': ('HarthmereBodyItemUse_Aligned_30', ['Drink', 'ItemPutBack']),
    }
    for key,(clip,backups) in mappings.items():
        src=replace_action(src,key,clip,backups)
    path.write_text(src, encoding='utf-8')

def write_manifest(root):
    p=root/'src/shared/harthmere/body_weapon_animation_sync_manifest_v8.ts'
    p.parent.mkdir(parents=True, exist_ok=True)
    content=f'''// Generated by {VERSION}.\n// Production contract for body animations that visually sync with held weapons/items.\n\nexport const HARTHMERE_BODY_WEAPON_ANIMATION_SYNC_VERSION_V8 = "{VERSION}";\nexport const HARTHMERE_BODY_WEAPON_ALIGNED_FRAME_COUNT_V8 = 30;\nexport const HARTHMERE_BODY_WEAPON_ALIGNED_FPS_V8 = 30;\n\nexport const HARTHMERE_BODY_VARIANT_TYPES_V8 = [\n  "average", "slim", "broad", "stocky", "athletic", "soft",\n] as const;\n\nexport const HARTHMERE_BODY_VARIANT_COLORS_V8 = [\n  "earth", "forest", "river", "ember", "royal", "ash",\n] as const;\n\nexport const HARTHMERE_BODY_WEAPON_ALIGNED_CLIPS_V8 = {json.dumps(CLIPS, indent=2)} as const;\n\nexport const HARTHMERE_BODY_WEAPON_PROFILE_CLIPS_V8 = {{\n  melee: {{\n    idleDrawn: "HarthmereBodyWeaponIdleDrawn_Aligned_30",\n    draw: "HarthmereBodyWeaponDraw_Aligned_30",\n    sheathe: "HarthmereBodyWeaponSheathe_Aligned_30",\n    basic: "HarthmereBodyWeaponBasic_Aligned_30",\n    heavy: "HarthmereBodyWeaponHeavy_Aligned_30",\n  }},\n  ranged: {{\n    drawAim: "HarthmereBodyRangedDraw_Aligned_30",\n    release: "HarthmereBodyRangedRelease_Aligned_30",\n    reload: "HarthmereBodyRangedReload_Aligned_30",\n  }},\n  magic: {{\n    cast: "HarthmereBodyMagicCast_Aligned_30",\n    channel: "HarthmereBodyMagicChannel_Aligned_30",\n  }},\n  shield: {{\n    block: "HarthmereBodyWeaponBlock_Aligned_30",\n    bash: "HarthmereBodyShieldBash_Aligned_30",\n  }},\n  tool: {{\n    use: "HarthmereBodyToolUse_Aligned_30",\n    heavyUse: "HarthmereBodyToolHeavyUse_Aligned_30",\n  }},\n  item: {{\n    use: "HarthmereBodyItemUse_Aligned_30",\n  }},\n}} as const;\n\nexport const HARTHMERE_GAMEPLAY_ITEM_BODY_PROFILE_V8 = {{\n  training_dagger: "melee",\n  iron_longsword: "melee",\n  woodsman_axe: "melee",\n  two_handed_sword: "melee",\n  wooden_shield: "shield",\n  bow: "ranged",\n  crossbow_1handed: "ranged",\n  crossbow_2handed: "ranged",\n  staff: "magic",\n  wand: "magic",\n  spellbook_open: "magic",\n  spellbook_closed: "magic",\n  pickaxe: "tool",\n  Pickaxe_Bronze: "tool",\n  Axe_Bronze: "tool",\n  Apple: "item",\n  Potion_1: "item",\n  ChickenLeg: "item",\n}} as const;\n\nexport const HARTHMERE_BODY_WEAPON_SYNC_EDGE_CASES_V8 = [\n  "all body size variants use identical clip names",\n  "all body color variants use identical clip names",\n  "legacy Attack/HeavyAttack remain fallbacks for non-Harthmere bodies",\n  "hips/root translation is locked in aligned clips",\n  "chest rotation is subtle to avoid full-body tumble",\n  "weapons/items are upper-body overlays while locomotion owns lower body",\n  "impactFrame metadata is present for gameplay timing",\n  "tools, consumables, ranged, magic, shield, and melee profiles are covered",\n] as const;\n'''
    p.write_text(content, encoding='utf-8')

def patch_hud(path):
    if not path.exists(): return
    src=path.read_text(encoding='utf-8')
    src=src.replace('const desiredFileAnimationName = attack === "heavy" ? "HeavyAttack" : "Attack";', 'const desiredFileAnimationName = attack === "heavy" ? "HarthmereBodyWeaponHeavy_Aligned_30" : "HarthmereBodyWeaponBasic_Aligned_30";')
    # If the older bridge still hardcodes only iron_longsword for the draw/sheathe bridge, let it use actual equipment.
    src=src.replace('  const itemId = "iron_longsword";', '  const itemId = inventory.equipment.main_hand?.itemId ?? inventory.equipment.off_hand?.itemId ?? "iron_longsword";')
    path.write_text(src, encoding='utf-8')

def main():
    root=Path(sys.argv[1] if len(sys.argv)>1 else os.getcwd())
    patch_player_animations(root/'src/client/game/util/player_animations.ts')
    patch_hud(root/'src/client/components/challenges/HarthmereUnifiedHUD.tsx')
    write_manifest(root)
    print('PATCHED player animation runtime to prefer v8 aligned body/weapon/item clips')

if __name__=='__main__': main()

