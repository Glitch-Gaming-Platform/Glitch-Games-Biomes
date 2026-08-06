import type { BiomesId } from "@/shared/ids";

const id = (value: number) => value as BiomesId;

/**
 * Stable native identities for every code-authored Harthmere item.
 *
 * These values intentionally preserve the ids that were used before the native
 * ECS cutover. Adding an item now requires an explicit manifest entry and code
 * review; a typo or rename must never mint a second inventory/quest identity at
 * runtime.
 */
export const HARTHMERE_NATIVE_ITEM_ID_MANIFEST = {
  alcubierre_drive_core: id(8662997956527471),
  anchor_core: id(8686198352602935),
  antiboron_block: id(8689191551408642),
  antidote: id(8688751013772660),
  antihelium_block: id(8689413923797930),
  antihydrogen_block: id(8677016841056860),
  antineutron_capsule: id(8681255924465949),
  antiproton_capsule: id(8679429202882650),
  apple_tart: id(8663913356199566),
  arcane_dust: id(8664235291150125),
  arcane_extractor: id(8654095675685531),
  asphalt: id(8679533968919977),
  baker_apron: id(8669630480891496),
  bandage: id(8685211642600484),
  basalt: id(8666275241204991),
  basalt_brick: id(8677638564034237),
  basalt_carved: id(8687524615296905),
  basalt_polished: id(8687226333929252),
  basalt_shingles: id(8666288361047355),
  bear_fat: id(8679652776895480),
  bear_hide: id(8669132651091785),
  beeswax: id(8651707928499797),
  bell_bronze_ingot: id(8663636393087428),
  bell_gold_flake: id(8674767087785176),
  bell_metal_fragment: id(8671817842100208),
  bell_woken_ash: id(8658670021818579),
  bellbinders_voice: id(8652812094653265),
  bench: id(8652742465608356),
  berry_leaf: id(8657542856925151),
  berry_tart: id(8687649082876690),
  birch_bark: id(8659168215083895),
  birch_log: id(8674123021019573),
  birch_lumber: id(8657758752996042),
  birch_reinforced: id(8679888551121982),
  birch_stripped: id(8664384503207486),
  black_bear_claw: id(8681174612339354),
  black_iron_shard: id(8685828403708559),
  blackwater_clay: id(8660076480161332),
  blue_glass_shard: id(8668909023954598),
  boar_hide: id(8683476746584259),
  boar_tusk: id(8689103280319638),
  boiled_leather: id(8667037536418579),
  bone_fragment: id(8662064552227461),
  boombox: id(8654609682175178),
  bright_silver_nugget: id(8656298772954025),
  business_service_counter: id(8650152815610139),
  cargo_crate: id(8667075368143994),
  certified_portal_fuel: id(8677535635504771),
  chapel_candle: id(8668190276754859),
  clay: id(8669622504860963),
  clay_brick: id(8661898953123833),
  clay_carved: id(8663668388979013),
  clay_polished: id(8656959125642488),
  clay_shingles: id(8682117757519775),
  clay_shovel: id(8667573937059507),
  clean_antler: id(8661875920025496),
  clean_birch_strip: id(8676494435903359),
  clean_flax_bundle: id(8686251281822568),
  cleaning_reagent: id(8690000000000001),
  clean_water: id(8660732475922643),
  cloth_scrap: id(8677384532551552),
  coal: id(8680649876498765),
  compost: id(8690000000000002),
  cobblestone: id(8659683858351124),
  cobblestone_brick: id(8660103443717630),
  cobblestone_carved: id(8686541342026912),
  cobblestone_polished: id(8662232529723705),
  cobblestone_shingles: id(8678988208253990),
  containment_filter: id(8650721498625329),
  coolant: id(8652257166896484),
  copper: id(8685645971407575),
  crop_bundle: id(8690000000000003),
  copper_ingot: id(8679576077752891),
  copper_kettle_token: id(8669345516116309),
  copper_ore: id(8666853698418496),
  cotton_fabric: id(8661198362027763),
  crystal_shard: id(8686374491763275),
  damp_moss: id(8689431815879235),
  deer_hide: id(8662711917141943),
  dense_coal_lump: id(8657952252137716),
  destination_crystal: id(8687003160103195),
  diamond: id(8670859065404678),
  diamond_ore: id(8688127216160413),
  diamond_shard: id(8673775224890245),
  display_shelf: id(8656787170929551),
  emberstone: id(8678319335534562),
  exotic_matter_power_cell: id(8686608909238263),
  fancy_bed: id(8663929079988359),
  field_medkit: id(8661382716397521),
  field_revival_scroll: id(8683640327641206),
  field_trousers: id(8687107199413258),
  field_wheat: id(8668992526082706),
  fine_peacebloom: id(8680613426308450),
  fish: id(8684955744086544),
  fish_wall_mount: id(8684440959040087),
  fishing_lure: id(8671034869617447),
  flax_fiber: id(8672936408265856),
  flax_stalk: id(8661646851723653),
  flexible_willow: id(8659912972076400),
  flood_lotus: id(8663577047465202),
  flood_willow_sap: id(8656282064446674),
  forest_mushroom: id(8669864163002842),
  fresh_carrot: id(8661079630390004),
  fresh_egg: id(8661382399516188),
  fresh_milk: id(8655049565152688),
  garden_planter_box: id(8684413098613392),
  ghost_ash: id(8664822768398254),
  ghost_pearl: id(8679892126033554),
  gold: id(8656430360449844),
  gold_frame: id(8675797418377730),
  gold_ingot: id(8677093721605980),
  gold_ore: id(8662078824084551),
  golden_carrot: id(8663917158577271),
  grain_flour: id(8674373589347486),
  grain_seed: id(8673995046336707),
  granite: id(8680951439062768),
  granite_brick: id(8678360078563234),
  granite_carved: id(8683618319656372),
  granite_polished: id(8673765996729493),
  granite_shingles: id(8681201237505170),
  grave_dust: id(8671531829454452),
  grave_moss: id(8677348996611526),
  grave_stone_chip: id(8653049447822212),
  gravel: id(8653910117509529),
  grilled_meat: id(8656361548765827),
  grove_festival_skewer: id(8690000000000009),
  grove_festival_skewer_ingredients: id(8690000000000010),
  grove_road_torch: id(8690000000000011),
  harthmere_station_alchemy_bench: id(8659445730056240),
  harthmere_station_forge: id(8688395000786061),
  harthmere_station_kiln: id(8680490094834712),
  harthmere_station_loom: id(8679201340724847),
  harthmere_station_stonecutter: id(8673751865167832),
  health_potion: id(8688497353431638),
  hearth_lamp: id(8659171838418401),
  hearty_stew: id(8666905846745693),
  heavy_boar_bristle: id(8651306594582894),
  herb_bundle: id(8690000000000004),
  herbal_extract: id(8683717200771438),
  herbalist_sickle: id(8687922258662048),
  helix_projector: id(8770000000000151),
  home_storage_cabinet: id(8677896090964400),
  honeycomb: id(8662461601962704),
  hunter_bow: id(8682561595062631),
  ice: id(8683961423703581),
  iron_ingot: id(8681469189153624),
  iron_key_blank: id(8657999515096941),
  iron_longsword: id(8666849849541136),
  iron_ore: id(8681655317169139),
  iron_sword: id(8686589963594454),
  iron_sword_reinforced: id(8680959933055104),
  item_augur9_core_cell: id(8761900000000001),
  item_bulls_core: id(8761900000000002),
  item_ch1_compound_a: id(8761900000000003),
  item_ch1_compound_b: id(8761900000000004),
  item_ch1_breakfast_tea: id(8761900000000015),
  item_custodian_key_3: id(8761900000000005),
  item_first_grain: id(8761900000000006),
  item_grey_card: id(8761900000000007),
  item_hnefatafl_piece: id(8761900000000008),
  item_iris_button: id(8761900000000009),
  item_jackies_tin: id(8761900000000010),
  item_lou_case_notes: id(8761900000000011),
  item_marrow_collar: id(8761900000000012),
  item_rook_bell_iron_token: id(8761900000000013),
  item_sorrel_field_ledger: id(8761900000000014),
  large_oak_frame: id(8662483897047697),
  leather_armor: id(8662030926044651),
  led: id(8659138313773103),
  led_panel: id(8680127028125214),
  lightwood_log: id(8686434539637078),
  limestone: id(8653973848197708),
  limestone_brick: id(8679022630828102),
  limestone_carved: id(8663780405351896),
  limestone_polished: id(8673710222383217),
  limestone_shingles: id(8675172581311934),
  linen_bundle: id(8690000000000005),
  linen_cloth: id(8675884622588285),
  loaf_bread: id(8679450855365197),
  lockbox: id(8670453932440206),
  mailbox: id(8674159175854258),
  mana_crystal_shard: id(8658134993588535),
  mana_draught: id(8655032255643979),
  mana_essence: id(8660176285067576),
  medicine: id(8667763455336110),
  medium_oak_frame: id(8671244880879933),
  meteoric_trace: id(8668100144611620),
  minor_healing_salve: id(8665897012157812),
  mixed_waste: id(8690000000000006),
  mooncap_mushroom: id(8652290168414316),
  moonstone: id(8652644728870896),
  muck_boss_trophy: id(8671131082392461),
  muck_rake: id(8668696029471666),
  muckwad: id(4603863378554668),
  muckwad_voxel_block: id(4603863378554668),
  mudroot: id(8669432349163136),
  mushroom_leather: id(8681111922997814),
  neptunium: id(8679936692842833),
  neptunium_ore: id(8670763918588054),
  neptunium_shard: id(8657010717212942),
  nightshade: id(8682718856913313),
  nova_cannon: id(8770000000000152),
  oak_branch: id(8670656471354320),
  oak_log: id(8685934723529442),
  oak_lumber: id(8663884036756943),
  oak_reinforced: id(8663020889520975),
  oak_stripped: id(8679301999252659),
  oak_tray: id(8685453595286264),
  old_bone_button: id(8674996696647215),
  old_coin: id(8676949969231729),
  padded_chair: id(8674257683831074),
  patched_cloak: id(8662202963826214),
  peacebloom: id(8675132286524019),
  photon_sidearm: id(8770000000000149),
  pine_log: id(8663914641364417),
  pine_pitch: id(8650696578409089),
  plant_fiber: id(8666013467275318),
  portal_fuel: id(8668411749341817),
  positron_capsule: id(8667860717813768),
  pulse_carbine: id(8770000000000150),
  quartzite: id(8674066090338247),
  quartzite_brick: id(8660932861800213),
  quartzite_carved: id(8663791338517137),
  quartzite_polished: id(8674102555456844),
  quartzite_shingles: id(8687097205028291),
  queen_honey: id(8673901638764972),
  raw_exotic_matter: id(8664028080417173),
  raw_meat: id(8674761821305706),
  recipe_book_advanced_station_schematics: id(8664825245312295),
  recipe_book_anglers_tackle_notes: id(8668456319017808),
  recipe_book_apprentice_workshop_manual: id(8666036073406113),
  recipe_book_bellfounders_lost_pages: id(8684196105696896),
  recipe_book_carpenters_block_book: id(8680176507978898),
  recipe_book_ceramic_glass_kiln_guide: id(8655505215276748),
  recipe_book_exotic_matter_treatise_i: id(8651507907020609),
  recipe_book_exotic_matter_treatise_ii: id(8677130304334072),
  recipe_book_exotic_matter_treatise_iii: id(8662246311865955),
  recipe_book_field_alchemists_notebook: id(8689269494399887),
  recipe_book_home_decor_catalogue: id(8655986508969786),
  recipe_book_hunters_bow_pattern: id(8685849139565514),
  recipe_book_masons_pattern_book: id(8659291496789301),
  recipe_book_metal_block_foundry_guide: id(8666351326508259),
  recipe_book_millers_kitchen_slip: id(8657695014790581),
  recipe_book_refiners_ledger: id(8675957514462829),
  recipe_book_smiths_primer: id(8662629074346013),
  recipe_book_tailor_leatherworker_folio: id(8687027413313556),
  recipe_book_weavers_material_sampler: id(8677351451734605),
  record_player: id(8671573537805177),
  reed_bundle: id(8657095996135671),
  relic_fragment: id(8671231800971038),
  repair_mallet: id(8664740698822359),
  repair_part: id(8657643049739017),
  repair_tool: id(8690000000000007),
  repair_voucher: id(8679672543047498),
  river_clay: id(8653058417488696),
  river_knot_marker: id(8651488367370082),
  river_pearl: id(8653907444860067),
  river_reed: id(8667510754748161),
  river_trout: id(8667690219150789),
  road_ration: id(8655485053367986),
  road_repair_kit: id(8689613082917031),
  rope: id(8654198296963114),
  rough_garnet: id(8683957064733121),
  rough_herb: id(8652754207479347),
  rough_hide: id(8683867678564372),
  rough_stone: id(8674148442917057),
  rubber_log: id(8657532077169361),
  rubber_lumber: id(8681009307459494),
  rubber_reinforced: id(8664651907118010),
  rubber_stripped: id(8682648554604114),
  runic_stone_light: id(8676680367606398),
  rusty_pickaxe: id(8659219899856215),
  saint_coin: id(8673446986908465),
  sakura_log: id(8665701170281094),
  sakura_lumber: id(8670990552068611),
  sand: id(8666556575733320),
  sand_lump: id(8660238531586607),
  scavenger_hook: id(8688210892461192),
  scrap_metal: id(8674950302765583),
  scroll_of_spark: id(8658819181251487),
  sealed_package: id(8799000000000001),
  seed_carrot: id(8669183240997535),
  seed_muckroot: id(8678408564150492),
  seed_wheat: id(8657983184297459),
  shelf: id(8672509810674070),
  silver: id(8682027042193891),
  silver_frame: id(8677854510145809),
  silver_ingot: id(8668860352037375),
  silver_ore: id(8652468903860804),
  simple_fishing_rod: id(8687129035135851),
  simple_glass: id(8673039149268295),
  singularity_lance: id(8770000000000153),
  skinning_knife: id(8670429651997459),
  small_bed: id(8673540314513797),
  small_oak_frame: id(8652800132465893),
  small_oak_sign: id(8672659230565193),
  snow: id(8687650101286729),
  softwood_log: id(8658996953111790),
  spent_filter: id(8661139318299793),
  stabilized_exotic_matter: id(8670494512923320),
  stabilizing_crystal: id(8665658901157541),
  stone: id(8684974871845179),
  stone_brick: id(8667583583419297),
  stone_carved: id(8688913346344861),
  stone_polished: id(8686440330109968),
  stone_shingles: id(8673591447339447),
  straight_pine_heartwood: id(8660918622598189),
  sunstone: id(8674725965471157),
  sweet_greenmere_berry: id(8660044799734418),
  t_table: id(8681232936359773),
  table: id(8650810163852202),
  teleport_fuel: id(8671361915149842),
  thatch: id(8657234272793940),
  tin_ingot: id(8654007112932117),
  training_dagger: id(8653941593309919),
  travel_cloak: id(8663861342816389),
  treasure_chest: id(8657552308646665),
  tree_resin: id(8682034969808132),
  town_chapel_altar: id(8771000000000012),
  town_chapel_pew: id(8771000000000011),
  town_cookpot: id(8771000000000015),
  town_firewood_stack: id(8771000000000014),
  town_forge_anvil: id(8771000000000001),
  town_grave_tool_rack: id(8771000000000013),
  town_produce_crate: id(8771000000000005),
  town_reagent_shelf: id(8771000000000009),
  town_record_stack: id(8771000000000008),
  town_rope_rack: id(8771000000000004),
  town_oven_range: id(8771000000000016),
  town_textile_drape: id(8771000000000007),
  town_tool_rack: id(8771000000000003),
  town_ward_focus: id(8771000000000010),
  town_wash_tub: id(8771000000000006),
  town_workbench: id(8771000000000002),
  two_handed_sword: id(8662503986090291),
  upgrade_crystal: id(8684127264939903),
  utility_core: id(8666192637716588),
  venison: id(8659572754055378),
  wall_lantern: id(8656273202062989),
  warded_iron_sword: id(8668341279340498),
  wardrobe_storage: id(8684145230437756),
  wild_berries: id(8677929649833465),
  wild_meat: id(8690000000000008),
  willow_bark: id(8669552073939463),
  wolf_fang: id(8674174365396021),
  wolf_hide: id(8683694876086175),
  wood_container: id(8668463750426951),
  wood_log: id(8666396152199490),
  wood_plank: id(8675751209843272),
  woodcutters_axe: id(8673959584806178),
  wooden_chair: id(8687881856622114),
  wooden_shield: id(8676509152107944),
  woodsman_axe: id(8662232338104371),
  worker_meal: id(8667165404073050),
  amber_bead_case_token: id(8754000000000000),
  anti_muck_poultice: id(8754000000000001),
  antidote_recipe_note: id(8754000000000002),
  basic_salves: id(8754000000000003),
  bell_fragment_quest_item: id(8754000000000004),
  bellbinder_robe_cosmetic: id(8754000000000005),
  bellbinders_antechamber_lore: id(8754000000000006),
  bellbinders_voice_handbell: id(8754000000000007),
  bellward_robe_cosmetic: id(8754000000000008),
  black_anvil_marked_strip: id(8754000000000009),
  bolt_crates: id(8754000000000010),
  bolt_order: id(8754000000000011),
  bounty_chit: id(8754000000000012),
  brams_stamped_pass: id(8754000000000013),
  brams_token: id(8754000000000014),
  bridge_day_ribbon: id(8754000000000015),
  bridgewalkers_eye_passive: id(8754000000000016),
  buddy_memory_fragment: id(8754000000000017),
  buried_bell_fragment: id(8754000000000018),
  caldus_debt_note_or_favor: id(8754000000000019),
  cellar_dust_cloak_cosmetic: id(8754000000000020),
  chapel_bell_notice_copy: id(8754000000000021),
  chapel_lore_note: id(8754000000000022),
  chapel_receipt: id(8754000000000023),
  charcoal_supply_contract: id(8754000000000024),
  coded_river_note: id(8754000000000025),
  copper_kettle_songbook_page: id(8754000000000026),
  cosmetic_marker_decal: id(8754000000000027),
  cove_photo_frame: id(8754000000000028),
  crate_rune_splinter: id(8754000000000029),
  crones_veil_or_gray_hood: id(8754000000000030),
  defense_drill_badge: id(8754000000000031),
  dock_manifest_copy: id(8754000000000032),
  dreams_of_the_bell_codex: id(8754000000000033),
  drill_square_emote: id(8754000000000034),
  first_choir_achievement: id(8754000000000035),
  forge_apprentice_brand_cosmetic: id(8754000000000036),
  founders_seal: id(8754000000000037),
  free_copper_kettle_room_week: id(8754000000000038),
  free_dawn_loaf_meal: id(8754000000000039),
  fresh_egg_bundle: id(8754000000000040),
  gate_ledger: id(8754000000000041),
  glade_herb_satchel: id(8754000000000042),
  grave_moss_sample: id(8754000000000043),
  grove_travel_bottoms: id(8754000000000044),
  grove_travel_top: id(8754000000000045),
  halene_letters_codex: id(8754000000000046),
  harthmere_arrival_note: id(8754000000000047),
  harths_memory_pin: id(8754000000000048),
  heard_the_well_persistent_buff: id(8754000000000049),
  heatproof_work_gloves: id(8754000000000050),
  heist_share: id(8754000000000051),
  jackies_sealed_letter: id(8754000000000052),
  lilas_confidence_token: id(8754000000000053),
  lina_river_ribbon: id(8754000000000054),
  loose_sign_nail: id(8754000000000055),
  luis_repair_note: id(8754000000000056),
  masters_mark_stamp: id(8754000000000057),
  moss_marked_permanent_buff: id(8754000000000058),
  mosslawn_songline_recording: id(8754000000000059),
  navigation_beam_upgrade: id(8754000000000060),
  old_route_clue: id(8754000000000061),
  path_legendary_reward_set: id(8754000000000062),
  pilgrims_mark: id(8754000000000063),
  "quest_objective_item:bellbound_q01_cracks_in_bridge:bellbound_q01_cracks_in_bridge_obj_01":
    id(8754000000000064),
  "quest_objective_item:bellbound_q01_cracks_in_bridge:bellbound_q01_cracks_in_bridge_obj_02":
    id(8754000000000065),
  "quest_objective_item:bellbound_q01_cracks_in_bridge:bellbound_q01_cracks_in_bridge_obj_03":
    id(8754000000000066),
  "quest_objective_item:bellbound_q01_cracks_in_bridge:bellbound_q01_cracks_in_bridge_obj_04":
    id(8754000000000067),
  "quest_objective_item:bellbound_q02_5_rat_girl_knows:bellbound_q02_5_rat_girl_knows_obj_01":
    id(8754000000000068),
  "quest_objective_item:bellbound_q02_5_rat_girl_knows:bellbound_q02_5_rat_girl_knows_obj_02":
    id(8754000000000069),
  "quest_objective_item:bellbound_q02_5_rat_girl_knows:bellbound_q02_5_rat_girl_knows_obj_03":
    id(8754000000000070),
  "quest_objective_item:bellbound_q02_5_rat_girl_knows:bellbound_q02_5_rat_girl_knows_obj_04":
    id(8754000000000071),
  "quest_objective_item:bellbound_q02_whispers_at_well:bellbound_q02_whispers_at_well_obj_01":
    id(8754000000000072),
  "quest_objective_item:bellbound_q02_whispers_at_well:bellbound_q02_whispers_at_well_obj_02":
    id(8754000000000073),
  "quest_objective_item:bellbound_q02_whispers_at_well:bellbound_q02_whispers_at_well_obj_03":
    id(8754000000000074),
  "quest_objective_item:bellbound_q02_whispers_at_well:bellbound_q02_whispers_at_well_obj_04":
    id(8754000000000075),
  "quest_objective_item:bellbound_q03_dreams_of_drowning:bellbound_q03_dreams_of_drowning_obj_01":
    id(8754000000000076),
  "quest_objective_item:bellbound_q03_dreams_of_drowning:bellbound_q03_dreams_of_drowning_obj_02":
    id(8754000000000077),
  "quest_objective_item:bellbound_q03_dreams_of_drowning:bellbound_q03_dreams_of_drowning_obj_03":
    id(8754000000000078),
  "quest_objective_item:bellbound_q03_dreams_of_drowning:bellbound_q03_dreams_of_drowning_obj_04":
    id(8754000000000079),
  "quest_objective_item:bellbound_q04_sisters_letters:bellbound_q04_sisters_letters_obj_01":
    id(8754000000000080),
  "quest_objective_item:bellbound_q04_sisters_letters:bellbound_q04_sisters_letters_obj_02":
    id(8754000000000081),
  "quest_objective_item:bellbound_q04_sisters_letters:bellbound_q04_sisters_letters_obj_03":
    id(8754000000000082),
  "quest_objective_item:bellbound_q04_sisters_letters:bellbound_q04_sisters_letters_obj_04":
    id(8754000000000083),
  "quest_objective_item:bellbound_q05_beneath_the_stones:bellbound_q05_beneath_the_stones_obj_01":
    id(8754000000000084),
  "quest_objective_item:bellbound_q05_beneath_the_stones:bellbound_q05_beneath_the_stones_obj_02":
    id(8754000000000085),
  "quest_objective_item:bellbound_q05_beneath_the_stones:bellbound_q05_beneath_the_stones_obj_03":
    id(8754000000000086),
  "quest_objective_item:bellbound_q05_beneath_the_stones:bellbound_q05_beneath_the_stones_obj_04":
    id(8754000000000087),
  "quest_objective_item:bellbound_q06_hidden_door:bellbound_q06_hidden_door_obj_01":
    id(8754000000000088),
  "quest_objective_item:bellbound_q06_hidden_door:bellbound_q06_hidden_door_obj_02":
    id(8754000000000089),
  "quest_objective_item:bellbound_q06_hidden_door:bellbound_q06_hidden_door_obj_03":
    id(8754000000000090),
  "quest_objective_item:bellbound_q06_hidden_door:bellbound_q06_hidden_door_obj_04":
    id(8754000000000091),
  "quest_objective_item:bellbound_q07_bellward_halls:bellbound_q07_bellward_halls_obj_01":
    id(8754000000000092),
  "quest_objective_item:bellbound_q07_bellward_halls:bellbound_q07_bellward_halls_obj_02":
    id(8754000000000093),
  "quest_objective_item:bellbound_q07_bellward_halls:bellbound_q07_bellward_halls_obj_03":
    id(8754000000000094),
  "quest_objective_item:bellbound_q07_bellward_halls:bellbound_q07_bellward_halls_obj_04":
    id(8754000000000095),
  "quest_objective_item:bellbound_q08_voices_in_stone:bellbound_q08_voices_in_stone_obj_01":
    id(8754000000000096),
  "quest_objective_item:bellbound_q08_voices_in_stone:bellbound_q08_voices_in_stone_obj_02":
    id(8754000000000097),
  "quest_objective_item:bellbound_q08_voices_in_stone:bellbound_q08_voices_in_stone_obj_03":
    id(8754000000000098),
  "quest_objective_item:bellbound_q08_voices_in_stone:bellbound_q08_voices_in_stone_obj_04":
    id(8754000000000099),
  "quest_objective_item:bellbound_q09_veins_of_wyrm:bellbound_q09_veins_of_wyrm_obj_01":
    id(8754000000000100),
  "quest_objective_item:bellbound_q09_veins_of_wyrm:bellbound_q09_veins_of_wyrm_obj_02":
    id(8754000000000101),
  "quest_objective_item:bellbound_q09_veins_of_wyrm:bellbound_q09_veins_of_wyrm_obj_03":
    id(8754000000000102),
  "quest_objective_item:bellbound_q09_veins_of_wyrm:bellbound_q09_veins_of_wyrm_obj_04":
    id(8754000000000103),
  "quest_objective_item:bellbound_q10_bellbinders_tomb:bellbound_q10_bellbinders_tomb_obj_01":
    id(8754000000000104),
  "quest_objective_item:bellbound_q10_bellbinders_tomb:bellbound_q10_bellbinders_tomb_obj_02":
    id(8754000000000105),
  "quest_objective_item:bellbound_q10_bellbinders_tomb:bellbound_q10_bellbinders_tomb_obj_03":
    id(8754000000000106),
  "quest_objective_item:bellbound_q10_bellbinders_tomb:bellbound_q10_bellbinders_tomb_obj_04":
    id(8754000000000107),
  "quest_objective_item:bellbound_q11_last_ringing:bellbound_q11_last_ringing_obj_01":
    id(8754000000000108),
  "quest_objective_item:bellbound_q11_last_ringing:bellbound_q11_last_ringing_obj_02":
    id(8754000000000109),
  "quest_objective_item:bellbound_q11_last_ringing:bellbound_q11_last_ringing_obj_03":
    id(8754000000000110),
  "quest_objective_item:bellbound_q11_last_ringing:bellbound_q11_last_ringing_obj_04":
    id(8754000000000111),
  "quest_objective_item:bellbound_q12_thaedryn_bellbound:bellbound_q12_thaedryn_bellbound_obj_01":
    id(8754000000000112),
  "quest_objective_item:bellbound_q12_thaedryn_bellbound:bellbound_q12_thaedryn_bellbound_obj_02":
    id(8754000000000113),
  "quest_objective_item:bellbound_q12_thaedryn_bellbound:bellbound_q12_thaedryn_bellbound_obj_03":
    id(8754000000000114),
  "quest_objective_item:bellbound_q12_thaedryn_bellbound:bellbound_q12_thaedryn_bellbound_obj_04":
    id(8754000000000115),
  "quest_objective_item:harthmere_sq_001_the_gate_ledger:harthmere_sq_001_the_gate_ledger_obj_01":
    id(8754000000000116),
  "quest_objective_item:harthmere_sq_001_the_gate_ledger:harthmere_sq_001_the_gate_ledger_obj_02":
    id(8754000000000117),
  "quest_objective_item:harthmere_sq_001_the_gate_ledger:harthmere_sq_001_the_gate_ledger_obj_03":
    id(8754000000000118),
  "quest_objective_item:harthmere_sq_001_the_gate_ledger:harthmere_sq_001_the_gate_ledger_obj_04":
    id(8754000000000119),
  "quest_objective_item:harthmere_sq_002_the_viddas_daughter:harthmere_sq_002_the_viddas_daughter_obj_01":
    id(8754000000000120),
  "quest_objective_item:harthmere_sq_002_the_viddas_daughter:harthmere_sq_002_the_viddas_daughter_obj_02":
    id(8754000000000121),
  "quest_objective_item:harthmere_sq_002_the_viddas_daughter:harthmere_sq_002_the_viddas_daughter_obj_03":
    id(8754000000000122),
  "quest_objective_item:harthmere_sq_002_the_viddas_daughter:harthmere_sq_002_the_viddas_daughter_obj_04":
    id(8754000000000123),
  "quest_objective_item:harthmere_sq_003_strangers_at_the_gate:harthmere_sq_003_strangers_at_the_gate_obj_01":
    id(8754000000000124),
  "quest_objective_item:harthmere_sq_003_strangers_at_the_gate:harthmere_sq_003_strangers_at_the_gate_obj_02":
    id(8754000000000125),
  "quest_objective_item:harthmere_sq_003_strangers_at_the_gate:harthmere_sq_003_strangers_at_the_gate_obj_03":
    id(8754000000000126),
  "quest_objective_item:harthmere_sq_003_strangers_at_the_gate:harthmere_sq_003_strangers_at_the_gate_obj_04":
    id(8754000000000127),
  "quest_objective_item:harthmere_sq_004_the_drill_that_wouldnt_end:harthmere_sq_004_the_drill_that_wouldnt_end_obj_01":
    id(8754000000000128),
  "quest_objective_item:harthmere_sq_004_the_drill_that_wouldnt_end:harthmere_sq_004_the_drill_that_wouldnt_end_obj_02":
    id(8754000000000129),
  "quest_objective_item:harthmere_sq_004_the_drill_that_wouldnt_end:harthmere_sq_004_the_drill_that_wouldnt_end_obj_03":
    id(8754000000000130),
  "quest_objective_item:harthmere_sq_004_the_drill_that_wouldnt_end:harthmere_sq_004_the_drill_that_wouldnt_end_obj_04":
    id(8754000000000131),
  "quest_objective_item:harthmere_sq_005_patrol_route_seven:harthmere_sq_005_patrol_route_seven_obj_01":
    id(8754000000000132),
  "quest_objective_item:harthmere_sq_005_patrol_route_seven:harthmere_sq_005_patrol_route_seven_obj_02":
    id(8754000000000133),
  "quest_objective_item:harthmere_sq_005_patrol_route_seven:harthmere_sq_005_patrol_route_seven_obj_03":
    id(8754000000000134),
  "quest_objective_item:harthmere_sq_005_patrol_route_seven:harthmere_sq_005_patrol_route_seven_obj_04":
    id(8754000000000135),
  "quest_objective_item:harthmere_sq_006_tessens_choice:harthmere_sq_006_tessens_choice_obj_01":
    id(8754000000000136),
  "quest_objective_item:harthmere_sq_006_tessens_choice:harthmere_sq_006_tessens_choice_obj_02":
    id(8754000000000137),
  "quest_objective_item:harthmere_sq_006_tessens_choice:harthmere_sq_006_tessens_choice_obj_03":
    id(8754000000000138),
  "quest_objective_item:harthmere_sq_006_tessens_choice:harthmere_sq_006_tessens_choice_obj_04":
    id(8754000000000139),
  "quest_objective_item:harthmere_sq_007_the_crooked_scales:harthmere_sq_007_the_crooked_scales_obj_01":
    id(8754000000000140),
  "quest_objective_item:harthmere_sq_007_the_crooked_scales:harthmere_sq_007_the_crooked_scales_obj_02":
    id(8754000000000141),
  "quest_objective_item:harthmere_sq_007_the_crooked_scales:harthmere_sq_007_the_crooked_scales_obj_03":
    id(8754000000000142),
  "quest_objective_item:harthmere_sq_007_the_crooked_scales:harthmere_sq_007_the_crooked_scales_obj_04":
    id(8754000000000143),
  "quest_objective_item:harthmere_sq_008_a_friend_of_brees:harthmere_sq_008_a_friend_of_brees_obj_01":
    id(8754000000000144),
  "quest_objective_item:harthmere_sq_008_a_friend_of_brees:harthmere_sq_008_a_friend_of_brees_obj_02":
    id(8754000000000145),
  "quest_objective_item:harthmere_sq_008_a_friend_of_brees:harthmere_sq_008_a_friend_of_brees_obj_03":
    id(8754000000000146),
  "quest_objective_item:harthmere_sq_008_a_friend_of_brees:harthmere_sq_008_a_friend_of_brees_obj_04":
    id(8754000000000147),
  "quest_objective_item:harthmere_sq_009_the_hoarder:harthmere_sq_009_the_hoarder_obj_01":
    id(8754000000000148),
  "quest_objective_item:harthmere_sq_009_the_hoarder:harthmere_sq_009_the_hoarder_obj_02":
    id(8754000000000149),
  "quest_objective_item:harthmere_sq_009_the_hoarder:harthmere_sq_009_the_hoarder_obj_03":
    id(8754000000000150),
  "quest_objective_item:harthmere_sq_009_the_hoarder:harthmere_sq_009_the_hoarder_obj_04":
    id(8754000000000151),
  "quest_objective_item:harthmere_sq_010_three_casks_short:harthmere_sq_010_three_casks_short_obj_01":
    id(8754000000000152),
  "quest_objective_item:harthmere_sq_010_three_casks_short:harthmere_sq_010_three_casks_short_obj_02":
    id(8754000000000153),
  "quest_objective_item:harthmere_sq_010_three_casks_short:harthmere_sq_010_three_casks_short_obj_03":
    id(8754000000000154),
  "quest_objective_item:harthmere_sq_010_three_casks_short:harthmere_sq_010_three_casks_short_obj_04":
    id(8754000000000155),
  "quest_objective_item:harthmere_sq_011_the_locked_room:harthmere_sq_011_the_locked_room_obj_01":
    id(8754000000000156),
  "quest_objective_item:harthmere_sq_011_the_locked_room:harthmere_sq_011_the_locked_room_obj_02":
    id(8754000000000157),
  "quest_objective_item:harthmere_sq_011_the_locked_room:harthmere_sq_011_the_locked_room_obj_03":
    id(8754000000000158),
  "quest_objective_item:harthmere_sq_011_the_locked_room:harthmere_sq_011_the_locked_room_obj_04":
    id(8754000000000159),
  "quest_objective_item:harthmere_sq_012_bard_night:harthmere_sq_012_bard_night_obj_01":
    id(8754000000000160),
  "quest_objective_item:harthmere_sq_012_bard_night:harthmere_sq_012_bard_night_obj_02":
    id(8754000000000161),
  "quest_objective_item:harthmere_sq_012_bard_night:harthmere_sq_012_bard_night_obj_03":
    id(8754000000000162),
  "quest_objective_item:harthmere_sq_012_bard_night:harthmere_sq_012_bard_night_obj_04":
    id(8754000000000163),
  "quest_objective_item:harthmere_sq_013_the_apprentices_burn:harthmere_sq_013_the_apprentices_burn_obj_01":
    id(8754000000000164),
  "quest_objective_item:harthmere_sq_013_the_apprentices_burn:harthmere_sq_013_the_apprentices_burn_obj_02":
    id(8754000000000165),
  "quest_objective_item:harthmere_sq_013_the_apprentices_burn:harthmere_sq_013_the_apprentices_burn_obj_03":
    id(8754000000000166),
  "quest_objective_item:harthmere_sq_013_the_apprentices_burn:harthmere_sq_013_the_apprentices_burn_obj_04":
    id(8754000000000167),
  "quest_objective_item:harthmere_sq_014_the_rebels_blade:harthmere_sq_014_the_rebels_blade_obj_01":
    id(8754000000000168),
  "quest_objective_item:harthmere_sq_014_the_rebels_blade:harthmere_sq_014_the_rebels_blade_obj_02":
    id(8754000000000169),
  "quest_objective_item:harthmere_sq_014_the_rebels_blade:harthmere_sq_014_the_rebels_blade_obj_03":
    id(8754000000000170),
  "quest_objective_item:harthmere_sq_014_the_rebels_blade:harthmere_sq_014_the_rebels_blade_obj_04":
    id(8754000000000171),
  "quest_objective_item:harthmere_sq_015_the_masters_mark:harthmere_sq_015_the_masters_mark_obj_01":
    id(8754000000000172),
  "quest_objective_item:harthmere_sq_015_the_masters_mark:harthmere_sq_015_the_masters_mark_obj_02":
    id(8754000000000173),
  "quest_objective_item:harthmere_sq_015_the_masters_mark:harthmere_sq_015_the_masters_mark_obj_03":
    id(8754000000000174),
  "quest_objective_item:harthmere_sq_015_the_masters_mark:harthmere_sq_015_the_masters_mark_obj_04":
    id(8754000000000175),
  "quest_objective_item:harthmere_sq_016_candles_for_the_forgotten:harthmere_sq_016_candles_for_the_forgotten_obj_01":
    id(8754000000000176),
  "quest_objective_item:harthmere_sq_016_candles_for_the_forgotten:harthmere_sq_016_candles_for_the_forgotten_obj_02":
    id(8754000000000177),
  "quest_objective_item:harthmere_sq_016_candles_for_the_forgotten:harthmere_sq_016_candles_for_the_forgotten_obj_03":
    id(8754000000000178),
  "quest_objective_item:harthmere_sq_016_candles_for_the_forgotten:harthmere_sq_016_candles_for_the_forgotten_obj_04":
    id(8754000000000179),
  "quest_objective_item:harthmere_sq_017_sister_maelles_concern:harthmere_sq_017_sister_maelles_concern_obj_01":
    id(8754000000000180),
  "quest_objective_item:harthmere_sq_017_sister_maelles_concern:harthmere_sq_017_sister_maelles_concern_obj_02":
    id(8754000000000181),
  "quest_objective_item:harthmere_sq_017_sister_maelles_concern:harthmere_sq_017_sister_maelles_concern_obj_03":
    id(8754000000000182),
  "quest_objective_item:harthmere_sq_017_sister_maelles_concern:harthmere_sq_017_sister_maelles_concern_obj_04":
    id(8754000000000183),
  "quest_objective_item:harthmere_sq_018_the_boy_who_saw_the_bell:harthmere_sq_018_the_boy_who_saw_the_bell_obj_01":
    id(8754000000000184),
  "quest_objective_item:harthmere_sq_018_the_boy_who_saw_the_bell:harthmere_sq_018_the_boy_who_saw_the_bell_obj_02":
    id(8754000000000185),
  "quest_objective_item:harthmere_sq_018_the_boy_who_saw_the_bell:harthmere_sq_018_the_boy_who_saw_the_bell_obj_03":
    id(8754000000000186),
  "quest_objective_item:harthmere_sq_018_the_boy_who_saw_the_bell:harthmere_sq_018_the_boy_who_saw_the_bell_obj_04":
    id(8754000000000187),
  "quest_objective_item:harthmere_sq_019_the_diplomats_dinner:harthmere_sq_019_the_diplomats_dinner_obj_01":
    id(8754000000000188),
  "quest_objective_item:harthmere_sq_019_the_diplomats_dinner:harthmere_sq_019_the_diplomats_dinner_obj_02":
    id(8754000000000189),
  "quest_objective_item:harthmere_sq_019_the_diplomats_dinner:harthmere_sq_019_the_diplomats_dinner_obj_03":
    id(8754000000000190),
  "quest_objective_item:harthmere_sq_019_the_diplomats_dinner:harthmere_sq_019_the_diplomats_dinner_obj_04":
    id(8754000000000191),
  "quest_objective_item:harthmere_sq_020_the_audit:harthmere_sq_020_the_audit_obj_01":
    id(8754000000000192),
  "quest_objective_item:harthmere_sq_020_the_audit:harthmere_sq_020_the_audit_obj_02":
    id(8754000000000193),
  "quest_objective_item:harthmere_sq_020_the_audit:harthmere_sq_020_the_audit_obj_03":
    id(8754000000000194),
  "quest_objective_item:harthmere_sq_020_the_audit:harthmere_sq_020_the_audit_obj_04":
    id(8754000000000195),
  "quest_objective_item:harthmere_sq_021_the_daughters_secret:harthmere_sq_021_the_daughters_secret_obj_01":
    id(8754000000000196),
  "quest_objective_item:harthmere_sq_021_the_daughters_secret:harthmere_sq_021_the_daughters_secret_obj_02":
    id(8754000000000197),
  "quest_objective_item:harthmere_sq_021_the_daughters_secret:harthmere_sq_021_the_daughters_secret_obj_03":
    id(8754000000000198),
  "quest_objective_item:harthmere_sq_021_the_daughters_secret:harthmere_sq_021_the_daughters_secret_obj_04":
    id(8754000000000199),
  "quest_objective_item:harthmere_sq_022_the_wrong_antidote:harthmere_sq_022_the_wrong_antidote_obj_01":
    id(8754000000000200),
  "quest_objective_item:harthmere_sq_022_the_wrong_antidote:harthmere_sq_022_the_wrong_antidote_obj_02":
    id(8754000000000201),
  "quest_objective_item:harthmere_sq_022_the_wrong_antidote:harthmere_sq_022_the_wrong_antidote_obj_03":
    id(8754000000000202),
  "quest_objective_item:harthmere_sq_022_the_wrong_antidote:harthmere_sq_022_the_wrong_antidote_obj_04":
    id(8754000000000203),
  "quest_objective_item:harthmere_sq_023_the_garden_in_the_glade:harthmere_sq_023_the_garden_in_the_glade_obj_01":
    id(8754000000000204),
  "quest_objective_item:harthmere_sq_023_the_garden_in_the_glade:harthmere_sq_023_the_garden_in_the_glade_obj_02":
    id(8754000000000205),
  "quest_objective_item:harthmere_sq_023_the_garden_in_the_glade:harthmere_sq_023_the_garden_in_the_glade_obj_03":
    id(8754000000000206),
  "quest_objective_item:harthmere_sq_023_the_garden_in_the_glade:harthmere_sq_023_the_garden_in_the_glade_obj_04":
    id(8754000000000207),
  "quest_objective_item:harthmere_sq_024_the_accusation:harthmere_sq_024_the_accusation_obj_01":
    id(8754000000000208),
  "quest_objective_item:harthmere_sq_024_the_accusation:harthmere_sq_024_the_accusation_obj_02":
    id(8754000000000209),
  "quest_objective_item:harthmere_sq_024_the_accusation:harthmere_sq_024_the_accusation_obj_03":
    id(8754000000000210),
  "quest_objective_item:harthmere_sq_024_the_accusation:harthmere_sq_024_the_accusation_obj_04":
    id(8754000000000211),
  "quest_objective_item:harthmere_sq_025_the_manifest:harthmere_sq_025_the_manifest_obj_01":
    id(8754000000000212),
  "quest_objective_item:harthmere_sq_025_the_manifest:harthmere_sq_025_the_manifest_obj_02":
    id(8754000000000213),
  "quest_objective_item:harthmere_sq_025_the_manifest:harthmere_sq_025_the_manifest_obj_03":
    id(8754000000000214),
  "quest_objective_item:harthmere_sq_025_the_manifest:harthmere_sq_025_the_manifest_obj_04":
    id(8754000000000215),
  "quest_objective_item:harthmere_sq_026_the_whispering_crate:harthmere_sq_026_the_whispering_crate_obj_01":
    id(8754000000000216),
  "quest_objective_item:harthmere_sq_026_the_whispering_crate:harthmere_sq_026_the_whispering_crate_obj_02":
    id(8754000000000217),
  "quest_objective_item:harthmere_sq_026_the_whispering_crate:harthmere_sq_026_the_whispering_crate_obj_03":
    id(8754000000000218),
  "quest_objective_item:harthmere_sq_026_the_whispering_crate:harthmere_sq_026_the_whispering_crate_obj_04":
    id(8754000000000219),
  "quest_objective_item:harthmere_sq_027_linas_promise:harthmere_sq_027_linas_promise_obj_01":
    id(8754000000000220),
  "quest_objective_item:harthmere_sq_027_linas_promise:harthmere_sq_027_linas_promise_obj_02":
    id(8754000000000221),
  "quest_objective_item:harthmere_sq_027_linas_promise:harthmere_sq_027_linas_promise_obj_03":
    id(8754000000000222),
  "quest_objective_item:harthmere_sq_027_linas_promise:harthmere_sq_027_linas_promise_obj_04":
    id(8754000000000223),
  "quest_objective_item:harthmere_sq_028_rats_with_crowns:harthmere_sq_028_rats_with_crowns_obj_01":
    id(8754000000000224),
  "quest_objective_item:harthmere_sq_028_rats_with_crowns:harthmere_sq_028_rats_with_crowns_obj_02":
    id(8754000000000225),
  "quest_objective_item:harthmere_sq_028_rats_with_crowns:harthmere_sq_028_rats_with_crowns_obj_03":
    id(8754000000000226),
  "quest_objective_item:harthmere_sq_028_rats_with_crowns:harthmere_sq_028_rats_with_crowns_obj_04":
    id(8754000000000227),
  "quest_objective_item:harthmere_sq_029_the_missing_ones:harthmere_sq_029_the_missing_ones_obj_01":
    id(8754000000000228),
  "quest_objective_item:harthmere_sq_029_the_missing_ones:harthmere_sq_029_the_missing_ones_obj_02":
    id(8754000000000229),
  "quest_objective_item:harthmere_sq_029_the_missing_ones:harthmere_sq_029_the_missing_ones_obj_03":
    id(8754000000000230),
  "quest_objective_item:harthmere_sq_029_the_missing_ones:harthmere_sq_029_the_missing_ones_obj_04":
    id(8754000000000231),
  "quest_objective_item:harthmere_sq_030_the_eviction:harthmere_sq_030_the_eviction_obj_01":
    id(8754000000000232),
  "quest_objective_item:harthmere_sq_030_the_eviction:harthmere_sq_030_the_eviction_obj_02":
    id(8754000000000233),
  "quest_objective_item:harthmere_sq_030_the_eviction:harthmere_sq_030_the_eviction_obj_03":
    id(8754000000000234),
  "quest_objective_item:harthmere_sq_030_the_eviction:harthmere_sq_030_the_eviction_obj_04":
    id(8754000000000235),
  "quest_objective_item:harthmere_sq_031_the_last_letter:harthmere_sq_031_the_last_letter_obj_01":
    id(8754000000000236),
  "quest_objective_item:harthmere_sq_031_the_last_letter:harthmere_sq_031_the_last_letter_obj_02":
    id(8754000000000237),
  "quest_objective_item:harthmere_sq_031_the_last_letter:harthmere_sq_031_the_last_letter_obj_03":
    id(8754000000000238),
  "quest_objective_item:harthmere_sq_031_the_last_letter:harthmere_sq_031_the_last_letter_obj_04":
    id(8754000000000239),
  "quest_objective_item:harthmere_sq_032_the_marsh_guides_burden:harthmere_sq_032_the_marsh_guides_burden_obj_01":
    id(8754000000000240),
  "quest_objective_item:harthmere_sq_032_the_marsh_guides_burden:harthmere_sq_032_the_marsh_guides_burden_obj_02":
    id(8754000000000241),
  "quest_objective_item:harthmere_sq_032_the_marsh_guides_burden:harthmere_sq_032_the_marsh_guides_burden_obj_03":
    id(8754000000000242),
  "quest_objective_item:harthmere_sq_032_the_marsh_guides_burden:harthmere_sq_032_the_marsh_guides_burden_obj_04":
    id(8754000000000243),
  "quest_objective_item:harthmere_sq_033_the_old_hunters_debt:harthmere_sq_033_the_old_hunters_debt_obj_01":
    id(8754000000000244),
  "quest_objective_item:harthmere_sq_033_the_old_hunters_debt:harthmere_sq_033_the_old_hunters_debt_obj_02":
    id(8754000000000245),
  "quest_objective_item:harthmere_sq_033_the_old_hunters_debt:harthmere_sq_033_the_old_hunters_debt_obj_03":
    id(8754000000000246),
  "quest_objective_item:harthmere_sq_033_the_old_hunters_debt:harthmere_sq_033_the_old_hunters_debt_obj_04":
    id(8754000000000247),
  "quest_objective_item:harthmere_sq_034_the_charcoal_burners_cough:harthmere_sq_034_the_charcoal_burners_cough_obj_01":
    id(8754000000000248),
  "quest_objective_item:harthmere_sq_034_the_charcoal_burners_cough:harthmere_sq_034_the_charcoal_burners_cough_obj_02":
    id(8754000000000249),
  "quest_objective_item:harthmere_sq_034_the_charcoal_burners_cough:harthmere_sq_034_the_charcoal_burners_cough_obj_03":
    id(8754000000000250),
  "quest_objective_item:harthmere_sq_034_the_charcoal_burners_cough:harthmere_sq_034_the_charcoal_burners_cough_obj_04":
    id(8754000000000251),
  "quest_objective_item:harthmere_sq_035_the_pilgrims_path:harthmere_sq_035_the_pilgrims_path_obj_01":
    id(8754000000000252),
  "quest_objective_item:harthmere_sq_035_the_pilgrims_path:harthmere_sq_035_the_pilgrims_path_obj_02":
    id(8754000000000253),
  "quest_objective_item:harthmere_sq_035_the_pilgrims_path:harthmere_sq_035_the_pilgrims_path_obj_03":
    id(8754000000000254),
  "quest_objective_item:harthmere_sq_035_the_pilgrims_path:harthmere_sq_035_the_pilgrims_path_obj_04":
    id(8754000000000255),
  "quest_objective_item:harthmere_sq_036_tamsins_trial:harthmere_sq_036_tamsins_trial_obj_01":
    id(8754000000000256),
  "quest_objective_item:harthmere_sq_036_tamsins_trial:harthmere_sq_036_tamsins_trial_obj_02":
    id(8754000000000257),
  "quest_objective_item:harthmere_sq_036_tamsins_trial:harthmere_sq_036_tamsins_trial_obj_03":
    id(8754000000000258),
  "quest_objective_item:harthmere_sq_036_tamsins_trial:harthmere_sq_036_tamsins_trial_obj_04":
    id(8754000000000259),
  "quest_objective_item:harthmere_sq_037_the_moss_womans_riddle:harthmere_sq_037_the_moss_womans_riddle_obj_01":
    id(8754000000000260),
  "quest_objective_item:harthmere_sq_037_the_moss_womans_riddle:harthmere_sq_037_the_moss_womans_riddle_obj_02":
    id(8754000000000261),
  "quest_objective_item:harthmere_sq_037_the_moss_womans_riddle:harthmere_sq_037_the_moss_womans_riddle_obj_03":
    id(8754000000000262),
  "quest_objective_item:harthmere_sq_037_the_moss_womans_riddle:harthmere_sq_037_the_moss_womans_riddle_obj_04":
    id(8754000000000263),
  "quest_objective_item:harthmere_sq_038_the_brass_scales_books:harthmere_sq_038_the_brass_scales_books_obj_01":
    id(8754000000000264),
  "quest_objective_item:harthmere_sq_038_the_brass_scales_books:harthmere_sq_038_the_brass_scales_books_obj_02":
    id(8754000000000265),
  "quest_objective_item:harthmere_sq_038_the_brass_scales_books:harthmere_sq_038_the_brass_scales_books_obj_03":
    id(8754000000000266),
  "quest_objective_item:harthmere_sq_038_the_brass_scales_books:harthmere_sq_038_the_brass_scales_books_obj_04":
    id(8754000000000267),
  "quest_objective_item:harthmere_sq_039_a_debt_to_settle:harthmere_sq_039_a_debt_to_settle_obj_01":
    id(8754000000000268),
  "quest_objective_item:harthmere_sq_039_a_debt_to_settle:harthmere_sq_039_a_debt_to_settle_obj_02":
    id(8754000000000269),
  "quest_objective_item:harthmere_sq_039_a_debt_to_settle:harthmere_sq_039_a_debt_to_settle_obj_03":
    id(8754000000000270),
  "quest_objective_item:harthmere_sq_039_a_debt_to_settle:harthmere_sq_039_a_debt_to_settle_obj_04":
    id(8754000000000271),
  "quest_objective_item:harthmere_sq_040_the_buried_bell:harthmere_sq_040_the_buried_bell_obj_01":
    id(8754000000000272),
  "quest_objective_item:harthmere_sq_040_the_buried_bell:harthmere_sq_040_the_buried_bell_obj_02":
    id(8754000000000273),
  "quest_objective_item:harthmere_sq_040_the_buried_bell:harthmere_sq_040_the_buried_bell_obj_03":
    id(8754000000000274),
  "quest_objective_item:harthmere_sq_040_the_buried_bell:harthmere_sq_040_the_buried_bell_obj_04":
    id(8754000000000275),
  "quest_objective_item:harthmere_sq_041_the_doorway_that_wasnt:harthmere_sq_041_the_doorway_that_wasnt_obj_01":
    id(8754000000000276),
  "quest_objective_item:harthmere_sq_041_the_doorway_that_wasnt:harthmere_sq_041_the_doorway_that_wasnt_obj_02":
    id(8754000000000277),
  "quest_objective_item:harthmere_sq_041_the_doorway_that_wasnt:harthmere_sq_041_the_doorway_that_wasnt_obj_03":
    id(8754000000000278),
  "quest_objective_item:harthmere_sq_041_the_doorway_that_wasnt:harthmere_sq_041_the_doorway_that_wasnt_obj_04":
    id(8754000000000279),
  "quest_objective_item:harthmere_sq_042_the_singing_in_the_walls:harthmere_sq_042_the_singing_in_the_walls_obj_01":
    id(8754000000000280),
  "quest_objective_item:harthmere_sq_042_the_singing_in_the_walls:harthmere_sq_042_the_singing_in_the_walls_obj_02":
    id(8754000000000281),
  "quest_objective_item:harthmere_sq_042_the_singing_in_the_walls:harthmere_sq_042_the_singing_in_the_walls_obj_03":
    id(8754000000000282),
  "quest_objective_item:harthmere_sq_042_the_singing_in_the_walls:harthmere_sq_042_the_singing_in_the_walls_obj_04":
    id(8754000000000283),
  "quest_objective_item:repeatable_briarfen_witchlights:repeatable_briarfen_witchlights_obj_01":
    id(8754000000000284),
  "quest_objective_item:repeatable_briarfen_witchlights:repeatable_briarfen_witchlights_obj_02":
    id(8754000000000285),
  "quest_objective_item:repeatable_briarfen_witchlights:repeatable_briarfen_witchlights_obj_03":
    id(8754000000000286),
  "quest_objective_item:repeatable_briarfen_witchlights:repeatable_briarfen_witchlights_obj_04":
    id(8754000000000287),
  "quest_objective_item:repeatable_chapel_candle_vigils:repeatable_chapel_candle_vigils_obj_01":
    id(8754000000000288),
  "quest_objective_item:repeatable_chapel_candle_vigils:repeatable_chapel_candle_vigils_obj_02":
    id(8754000000000289),
  "quest_objective_item:repeatable_chapel_candle_vigils:repeatable_chapel_candle_vigils_obj_03":
    id(8754000000000290),
  "quest_objective_item:repeatable_chapel_candle_vigils:repeatable_chapel_candle_vigils_obj_04":
    id(8754000000000291),
  "quest_objective_item:repeatable_chapel_charity_deliveries:repeatable_chapel_charity_deliveries_obj_01":
    id(8754000000000292),
  "quest_objective_item:repeatable_chapel_charity_deliveries:repeatable_chapel_charity_deliveries_obj_02":
    id(8754000000000293),
  "quest_objective_item:repeatable_chapel_charity_deliveries:repeatable_chapel_charity_deliveries_obj_03":
    id(8754000000000294),
  "quest_objective_item:repeatable_chapel_charity_deliveries:repeatable_chapel_charity_deliveries_obj_04":
    id(8754000000000295),
  "quest_objective_item:repeatable_chapel_grave_tending:repeatable_chapel_grave_tending_obj_01":
    id(8754000000000296),
  "quest_objective_item:repeatable_chapel_grave_tending:repeatable_chapel_grave_tending_obj_02":
    id(8754000000000297),
  "quest_objective_item:repeatable_chapel_grave_tending:repeatable_chapel_grave_tending_obj_03":
    id(8754000000000298),
  "quest_objective_item:repeatable_chapel_grave_tending:repeatable_chapel_grave_tending_obj_04":
    id(8754000000000299),
  "quest_objective_item:repeatable_merchant_cargo_escorts:repeatable_merchant_cargo_escorts_obj_01":
    id(8754000000000300),
  "quest_objective_item:repeatable_merchant_cargo_escorts:repeatable_merchant_cargo_escorts_obj_02":
    id(8754000000000301),
  "quest_objective_item:repeatable_merchant_cargo_escorts:repeatable_merchant_cargo_escorts_obj_03":
    id(8754000000000302),
  "quest_objective_item:repeatable_merchant_cargo_escorts:repeatable_merchant_cargo_escorts_obj_04":
    id(8754000000000303),
  "quest_objective_item:repeatable_merchant_market_writs:repeatable_merchant_market_writs_obj_01":
    id(8754000000000304),
  "quest_objective_item:repeatable_merchant_market_writs:repeatable_merchant_market_writs_obj_02":
    id(8754000000000305),
  "quest_objective_item:repeatable_merchant_market_writs:repeatable_merchant_market_writs_obj_03":
    id(8754000000000306),
  "quest_objective_item:repeatable_merchant_market_writs:repeatable_merchant_market_writs_obj_04":
    id(8754000000000307),
  "quest_objective_item:repeatable_mudden_food_distribution:repeatable_mudden_food_distribution_obj_01":
    id(8754000000000308),
  "quest_objective_item:repeatable_mudden_food_distribution:repeatable_mudden_food_distribution_obj_02":
    id(8754000000000309),
  "quest_objective_item:repeatable_mudden_food_distribution:repeatable_mudden_food_distribution_obj_03":
    id(8754000000000310),
  "quest_objective_item:repeatable_mudden_food_distribution:repeatable_mudden_food_distribution_obj_04":
    id(8754000000000311),
  "quest_objective_item:repeatable_mudden_rat_catching:repeatable_mudden_rat_catching_obj_01":
    id(8754000000000312),
  "quest_objective_item:repeatable_mudden_rat_catching:repeatable_mudden_rat_catching_obj_02":
    id(8754000000000313),
  "quest_objective_item:repeatable_mudden_rat_catching:repeatable_mudden_rat_catching_obj_03":
    id(8754000000000314),
  "quest_objective_item:repeatable_mudden_rat_catching:repeatable_mudden_rat_catching_obj_04":
    id(8754000000000315),
  "quest_objective_item:repeatable_river_knots_information_drops:repeatable_river_knots_information_drops_obj_01":
    id(8754000000000316),
  "quest_objective_item:repeatable_river_knots_information_drops:repeatable_river_knots_information_drops_obj_02":
    id(8754000000000317),
  "quest_objective_item:repeatable_river_knots_information_drops:repeatable_river_knots_information_drops_obj_03":
    id(8754000000000318),
  "quest_objective_item:repeatable_river_knots_information_drops:repeatable_river_knots_information_drops_obj_04":
    id(8754000000000319),
  "quest_objective_item:repeatable_river_knots_small_smuggling_runs:repeatable_river_knots_small_smuggling_runs_obj_01":
    id(8754000000000320),
  "quest_objective_item:repeatable_river_knots_small_smuggling_runs:repeatable_river_knots_small_smuggling_runs_obj_02":
    id(8754000000000321),
  "quest_objective_item:repeatable_river_knots_small_smuggling_runs:repeatable_river_knots_small_smuggling_runs_obj_03":
    id(8754000000000322),
  "quest_objective_item:repeatable_river_knots_small_smuggling_runs:repeatable_river_knots_small_smuggling_runs_obj_04":
    id(8754000000000323),
  "quest_objective_item:repeatable_watch_bounty_board:repeatable_watch_bounty_board_obj_01":
    id(8754000000000324),
  "quest_objective_item:repeatable_watch_bounty_board:repeatable_watch_bounty_board_obj_02":
    id(8754000000000325),
  "quest_objective_item:repeatable_watch_bounty_board:repeatable_watch_bounty_board_obj_03":
    id(8754000000000326),
  "quest_objective_item:repeatable_watch_bounty_board:repeatable_watch_bounty_board_obj_04":
    id(8754000000000327),
  "quest_objective_item:repeatable_watch_gate_inspections:repeatable_watch_gate_inspections_obj_01":
    id(8754000000000328),
  "quest_objective_item:repeatable_watch_gate_inspections:repeatable_watch_gate_inspections_obj_02":
    id(8754000000000329),
  "quest_objective_item:repeatable_watch_gate_inspections:repeatable_watch_gate_inspections_obj_03":
    id(8754000000000330),
  "quest_objective_item:repeatable_watch_gate_inspections:repeatable_watch_gate_inspections_obj_04":
    id(8754000000000331),
  "quest_objective_item:repeatable_watch_patrol_routes:repeatable_watch_patrol_routes_obj_01":
    id(8754000000000332),
  "quest_objective_item:repeatable_watch_patrol_routes:repeatable_watch_patrol_routes_obj_02":
    id(8754000000000333),
  "quest_objective_item:repeatable_watch_patrol_routes:repeatable_watch_patrol_routes_obj_03":
    id(8754000000000334),
  "quest_objective_item:repeatable_watch_patrol_routes:repeatable_watch_patrol_routes_obj_04":
    id(8754000000000335),
  "quest_objective_item:repeatable_wilds_rescue_lost_traveler:repeatable_wilds_rescue_lost_traveler_obj_01":
    id(8754000000000336),
  "quest_objective_item:repeatable_wilds_rescue_lost_traveler:repeatable_wilds_rescue_lost_traveler_obj_02":
    id(8754000000000337),
  "quest_objective_item:repeatable_wilds_rescue_lost_traveler:repeatable_wilds_rescue_lost_traveler_obj_03":
    id(8754000000000338),
  "quest_objective_item:repeatable_wilds_rescue_lost_traveler:repeatable_wilds_rescue_lost_traveler_obj_04":
    id(8754000000000339),
  "quest_objective_item:repeatable_wilds_resource_route:repeatable_wilds_resource_route_obj_01":
    id(8754000000000340),
  "quest_objective_item:repeatable_wilds_resource_route:repeatable_wilds_resource_route_obj_02":
    id(8754000000000341),
  "quest_objective_item:repeatable_wilds_resource_route:repeatable_wilds_resource_route_obj_03":
    id(8754000000000342),
  "quest_objective_item:repeatable_wilds_resource_route:repeatable_wilds_resource_route_obj_04":
    id(8754000000000343),
  "quest_objective_item:repeatable_wilds_road_bandits:repeatable_wilds_road_bandits_obj_01":
    id(8754000000000344),
  "quest_objective_item:repeatable_wilds_road_bandits:repeatable_wilds_road_bandits_obj_02":
    id(8754000000000345),
  "quest_objective_item:repeatable_wilds_road_bandits:repeatable_wilds_road_bandits_obj_03":
    id(8754000000000346),
  "quest_objective_item:repeatable_wilds_road_bandits:repeatable_wilds_road_bandits_obj_04":
    id(8754000000000347),
  "quest_objective_item:starter_apples_for_dawnloaf:starter_apples_for_dawnloaf_obj_01":
    id(8754000000000348),
  "quest_objective_item:starter_apples_for_dawnloaf:starter_apples_for_dawnloaf_obj_02":
    id(8754000000000349),
  "quest_objective_item:starter_apples_for_dawnloaf:starter_apples_for_dawnloaf_obj_03":
    id(8754000000000350),
  "quest_objective_item:starter_apples_for_dawnloaf:starter_apples_for_dawnloaf_obj_04":
    id(8754000000000351),
  "quest_objective_item:starter_cold_iron_hot_temper:starter_cold_iron_hot_temper_obj_01":
    id(8754000000000352),
  "quest_objective_item:starter_cold_iron_hot_temper:starter_cold_iron_hot_temper_obj_02":
    id(8754000000000353),
  "quest_objective_item:starter_cold_iron_hot_temper:starter_cold_iron_hot_temper_obj_03":
    id(8754000000000354),
  "quest_objective_item:starter_cold_iron_hot_temper:starter_cold_iron_hot_temper_obj_04":
    id(8754000000000355),
  "quest_objective_item:starter_fever_tea:starter_fever_tea_obj_01":
    id(8754000000000356),
  "quest_objective_item:starter_fever_tea:starter_fever_tea_obj_02":
    id(8754000000000357),
  "quest_objective_item:starter_fever_tea:starter_fever_tea_obj_03":
    id(8754000000000358),
  "quest_objective_item:starter_fever_tea:starter_fever_tea_obj_04":
    id(8754000000000359),
  "quest_objective_item:starter_loose_chickens:starter_loose_chickens_obj_01":
    id(8754000000000360),
  "quest_objective_item:starter_loose_chickens:starter_loose_chickens_obj_02":
    id(8754000000000361),
  "quest_objective_item:starter_loose_chickens:starter_loose_chickens_obj_03":
    id(8754000000000362),
  "quest_objective_item:starter_loose_chickens:starter_loose_chickens_obj_04":
    id(8754000000000363),
  "quest_objective_item:starter_missing_lockbox:starter_missing_lockbox_obj_01":
    id(8754000000000364),
  "quest_objective_item:starter_missing_lockbox:starter_missing_lockbox_obj_02":
    id(8754000000000365),
  "quest_objective_item:starter_missing_lockbox:starter_missing_lockbox_obj_03":
    id(8754000000000366),
  "quest_objective_item:starter_missing_lockbox:starter_missing_lockbox_obj_04":
    id(8754000000000367),
  "quest_objective_item:starter_rumor_has_it:starter_rumor_has_it_obj_01":
    id(8754000000000368),
  "quest_objective_item:starter_rumor_has_it:starter_rumor_has_it_obj_02":
    id(8754000000000369),
  "quest_objective_item:starter_rumor_has_it:starter_rumor_has_it_obj_03":
    id(8754000000000370),
  "quest_objective_item:starter_rumor_has_it:starter_rumor_has_it_obj_04":
    id(8754000000000371),
  "quest_objective_item:starter_the_missing_bell:starter_the_missing_bell_obj_01":
    id(8754000000000372),
  "quest_objective_item:starter_the_missing_bell:starter_the_missing_bell_obj_02":
    id(8754000000000373),
  "quest_objective_item:starter_the_missing_bell:starter_the_missing_bell_obj_03":
    id(8754000000000374),
  "quest_objective_item:starter_the_missing_bell:starter_the_missing_bell_obj_04":
    id(8754000000000375),
  "quest_objective_item:starter_welcome_to_harthmere:starter_welcome_to_harthmere_obj_01":
    id(8754000000000376),
  "quest_objective_item:starter_welcome_to_harthmere:starter_welcome_to_harthmere_obj_02":
    id(8754000000000377),
  "quest_objective_item:starter_welcome_to_harthmere:starter_welcome_to_harthmere_obj_03":
    id(8754000000000378),
  "quest_objective_item:starter_welcome_to_harthmere:starter_welcome_to_harthmere_obj_04":
    id(8754000000000379),
  "quest_objective_item:starter_whispering_crate:starter_whispering_crate_obj_01":
    id(8754000000000380),
  "quest_objective_item:starter_whispering_crate:starter_whispering_crate_obj_02":
    id(8754000000000381),
  "quest_objective_item:starter_whispering_crate:starter_whispering_crate_obj_03":
    id(8754000000000382),
  "quest_objective_item:starter_whispering_crate:starter_whispering_crate_obj_04":
    id(8754000000000383),
  "quest_objective_item:weekly_chapel_river_blessing_prep:weekly_chapel_river_blessing_prep_obj_01":
    id(8754000000000384),
  "quest_objective_item:weekly_chapel_river_blessing_prep:weekly_chapel_river_blessing_prep_obj_02":
    id(8754000000000385),
  "quest_objective_item:weekly_chapel_river_blessing_prep:weekly_chapel_river_blessing_prep_obj_03":
    id(8754000000000386),
  "quest_objective_item:weekly_chapel_river_blessing_prep:weekly_chapel_river_blessing_prep_obj_04":
    id(8754000000000387),
  "quest_objective_item:weekly_merchant_bridge_day_setup:weekly_merchant_bridge_day_setup_obj_01":
    id(8754000000000388),
  "quest_objective_item:weekly_merchant_bridge_day_setup:weekly_merchant_bridge_day_setup_obj_02":
    id(8754000000000389),
  "quest_objective_item:weekly_merchant_bridge_day_setup:weekly_merchant_bridge_day_setup_obj_03":
    id(8754000000000390),
  "quest_objective_item:weekly_merchant_bridge_day_setup:weekly_merchant_bridge_day_setup_obj_04":
    id(8754000000000391),
  "quest_objective_item:weekly_mudden_ward_fair:weekly_mudden_ward_fair_obj_01":
    id(8754000000000392),
  "quest_objective_item:weekly_mudden_ward_fair:weekly_mudden_ward_fair_obj_02":
    id(8754000000000393),
  "quest_objective_item:weekly_mudden_ward_fair:weekly_mudden_ward_fair_obj_03":
    id(8754000000000394),
  "quest_objective_item:weekly_mudden_ward_fair:weekly_mudden_ward_fair_obj_04":
    id(8754000000000395),
  "quest_objective_item:weekly_river_knots_cargo_heist:weekly_river_knots_cargo_heist_obj_01":
    id(8754000000000396),
  "quest_objective_item:weekly_river_knots_cargo_heist:weekly_river_knots_cargo_heist_obj_02":
    id(8754000000000397),
  "quest_objective_item:weekly_river_knots_cargo_heist:weekly_river_knots_cargo_heist_obj_03":
    id(8754000000000398),
  "quest_objective_item:weekly_river_knots_cargo_heist:weekly_river_knots_cargo_heist_obj_04":
    id(8754000000000399),
  "quest_objective_item:weekly_watch_town_defense_drill:weekly_watch_town_defense_drill_obj_01":
    id(8754000000000400),
  "quest_objective_item:weekly_watch_town_defense_drill:weekly_watch_town_defense_drill_obj_02":
    id(8754000000000401),
  "quest_objective_item:weekly_watch_town_defense_drill:weekly_watch_town_defense_drill_obj_03":
    id(8754000000000402),
  "quest_objective_item:weekly_watch_town_defense_drill:weekly_watch_town_defense_drill_obj_04":
    id(8754000000000403),
  ranger_token: id(8754000000000404),
  rare_cooking_recipe: id(8754000000000405),
  rat_crown_cosmetic: id(8754000000000406),
  rat_girls_token: id(8754000000000407),
  rat_tail_bundle: id(8754000000000408),
  rebels_blade_pattern: id(8754000000000409),
  resource_route_receipt: id(8754000000000410),
  river_blessing_candle: id(8754000000000411),
  road_ahead_map_layer: id(8754000000000412),
  road_blocks_x5: id(8754000000000413),
  road_snacks: id(8754000000000414),
  sealed_muck_sample: id(8754000000000415),
  sils_tuning_strip: id(8754000000000416),
  simple_repair_kit: id(8754000000000417),
  six_bellbinder_regalia: id(8754000000000418),
  small_verena_charm: id(8754000000000419),
  smuggler_token: id(8754000000000420),
  storage_voucher_small: id(8754000000000421),
  tams_bell_clue: id(8754000000000422),
  trackers_eye_passive: id(8754000000000423),
  trapper_mentor_token: id(8754000000000424),
  travel_boots: id(8754000000000425),
  vein_keepers_scale: id(8754000000000426),
  vera_harth_journal_lore: id(8754000000000427),
  verena_cellar_blessing: id(8754000000000428),
  veskas_last_letter: id(8754000000000429),
  ward_fair_token: id(8754000000000430),
  warm_apple_roll: id(8754000000000431),
  watch_patrol_mark: id(8754000000000432),
  watch_ranger_report: id(8754000000000433),
  watch_tabard_pin_or_merchant_favor_token: id(8754000000000434),
  whispering_crate_splinter: id(8754000000000435),
  witchlight_sample: id(8754000000000436),
  billys_lunch_pail: id(8754000000000437),
  containment_tongs: id(8754000000000438),
  anchor_wrench: id(8754000000000439),
  drafting_compass: id(8754000000000440),
  ward_hammer: id(8754000000000441),
  portal_calibrator: id(8754000000000442),
  field_surgeon_kit: id(8754000000000443),
  beacon_attuner: id(8754000000000444),
  carving_cleaver: id(8754000000000445),
  hearth_broom: id(8754000000000446),
  // HARTHMERE_PREMIUM_VOXEL_WEAPONS: stable identities for the Blender-authored
  // hotbar/equipment weapon collection.
  one_handed_axe: id(8791000000000001),
  two_handed_axe: id(8791000000000002),
  double_axe: id(8791000000000003),
  golden_double_axe: id(8791000000000004),
  small_axe: id(8791000000000005),
  golden_small_axe: id(8791000000000006),
  steel_dagger: id(8791000000000007),
  golden_dagger: id(8791000000000008),
  double_headed_hammer: id(8791000000000009),
  golden_double_headed_hammer: id(8791000000000010),
  colored_two_handed_sword: id(8791000000000011),
  standard_sword: id(8791000000000012),
  golden_sword: id(8791000000000013),
  great_sword: id(8791000000000014),
  golden_great_sword: id(8791000000000015),
  golden_bow: id(8791000000000016),
  strung_bow: id(8791000000000017),
  one_handed_crossbow: id(8791000000000018),
  two_handed_crossbow: id(8791000000000019),
  steel_dart: id(8791000000000020),
  golden_dart: id(8791000000000021),
  arcane_staff: id(8791000000000022),
  arcane_wand: id(8791000000000023),
  arcane_spellbook_closed: id(8791000000000024),
  arcane_spellbook_open: id(8791000000000025),
  sealed_scroll: id(8791000000000026),
  crystal_focus: id(8791000000000027),
  star_focus: id(8791000000000028),
  snowflake_focus: id(8791000000000029),
  smoke_bomb: id(8791000000000030),
  round_shield: id(8791000000000031),
  barbarian_round_shield: id(8791000000000032),
  spiked_shield: id(8791000000000033),
  square_shield: id(8791000000000034),
  badge_shield: id(8791000000000035),
  colored_round_shield: id(8791000000000036),
  colored_spiked_shield: id(8791000000000037),
  colored_square_shield: id(8791000000000038),
  colored_badge_shield: id(8791000000000039),
  // HARTHMERE_BOW_AMMO: one physical stack identity consumed only from the
  // backpack by server-authorized bow releases.
  hunting_arrow: id(8791000000000040),
} as const satisfies Readonly<Record<string, BiomesId>>;

/**
 * Stable native identities for code-authored NPC type biscuits. Seeded entity
 * ids and NPC type ids are separate contracts; this table owns only the type
 * identity used by combat, drops, and native quest triggers.
 */
export const HARTHMERE_NATIVE_NPC_ID_MANIFEST = {
  robot_sentinel: id(8729590142407321),
  monster_west_breach_muckling: id(8700372047004309),
  monster_west_breach_lesser_hexer: id(8709113277315222),
  monster_road_muckwad: id(8712043166868610),
  monster_road_lesser_hexer: id(8713402732122585),
  monster_watchtower_mucker: id(8705291174133871),
  monster_watchtower_lesser_hexer: id(8739130166316931),
  monster_watchtower_clearing_mucker: id(8737549504084587),
  monster_watchtower_clearing_hexer: id(8719822603888094),
  monster_old_wood_mucker: id(8739066710671030),
  monster_old_wood_lesser_hexer: id(8714407162947998),
  monster_old_wood_copse_mucker: id(8705983851194909),
  monster_old_wood_copse_hexer: id(8713485215284492),
  monster_gravewood_pale_muckling: id(8722418610125863),
  monster_gravewood_pale_hexer: id(8727777100064767),
  livestock_cow: id(8707341327526888),
  livestock_sheep: id(8729474387653580),
  livestock_rabbit: id(8711637540792493),
  boss_muck_scarred_helix: id(8722087466111622),
  boss_thaedryn_bellbound: id(8722087466111623),
  // Open-wilds mixed groups were added after the original fixed combat
  // manifest. They still need checked-in type identities; otherwise the
  // Bikkie overlay emits an NPC biscuit with an undefined id and prevents a
  // clean snapshot-backed server boot.
  monster_open_wilds_mucker: id(8722087466111624),
  monster_open_wilds_hex: id(8722087466111625),
  // The six scattered mixed encounters added 2026-07-26. Same reasoning as the
  // open-wilds pair above: all six groups share one monster name so they share
  // one checked-in type identity each.
  monster_wilds_pack_mucker: id(8722087466111626),
  monster_wilds_pack_hex: id(8722087466111627),
  // HARTHMERE_ROAD_TO_HARTHMERE_GROUPS (2026-07-27): the four road packs share
  // one display name per creature kind across all four groups, for the same
  // reason as the pairs above — the native type key is
  // `monster_${slug(displayName)}`, so a per-group name would need a per-group
  // entry here, and a missing entry ships a biscuit with an undefined id.
  monster_road_pack_muckling: id(8722087466111628),
  monster_road_pack_hex: id(8722087466111629),
  bandit_scout: id(8722087466111630),
  bandit_archer: id(8722087466111631),
  bandit_skirmisher: id(8722087466111632),
  bandit_brute: id(8722087466111633),
  bandit_captain: id(8722087466111634),
  bandit_prisoner: id(8722087466111635),
  // HARTHMERE_MUCK_PACK_RELOCATION / HARTHMERE_MOSSY_MUCKLING_HUNT (2026-07-28).
  // Two new display names, so two new checked-in type identities:
  //   * the single pack left in the Watchtower Muck Clearing is now a Muckling
  //     family ("Watchtower Muckling") rather than a Mucker + Hexer mix;
  //   * "Get the Muck Out" asks for six Mossy Mucklings, and until now no
  //     creature in the world carried that name.
  // A missing entry here emits an NPC biscuit with an undefined id, which fails
  // the Bikkie overlay and blocks a clean snapshot-backed boot.
  monster_watchtower_muckling: id(8722087466111636),
  monster_mossy_muckling: id(8722087466111637),
  // HARTHMERE_COBBLED_MUCKLING_HUNT (2026-07-29): "In Storage" asks for six
  // Mucker Teeth from Cobbled Mucklings, and no creature in the restored world
  // carried that name or dropped that item. One new display name, so one new
  // checked-in type identity — a missing entry here emits an NPC biscuit with
  // an undefined id, which fails the Bikkie overlay and blocks a clean
  // snapshot-backed boot.
  //
  // NOTE: this is deliberately NOT the original snapshot's Cobbled Muckling
  // type id (8997551883502319). That legacy type keeps its own identity and its
  // own kill-count aliases in `native_combat_quest_routing.ts`; the restored
  // pack is a Harthmere-native creature with Harthmere stats, respawn and
  // visuals, exactly like the restored Mossy Muckling pack.
  monster_cobbled_muckling: id(8722087466111638),
  // Human-scale deep-cavern predator. All sixty authored pack members share
  // one native type; their increasing cavern difficulty lives in per-entity
  // creature progression rather than minting one type per cave.
  monster_indisworm: id(8722087466111639),
  // Four isolated level-30 corner encounters share one type per boss species.
  // Their per-entity progression supplies the high-level scaling while these
  // distinct type identities preserve the wider apex aggro/leash contract
  // without changing the quest-gated Helix or the existing bounty Alpha.
  boss_muck_scarred_helix_apex: id(8722087466111640),
  boss_alpha_mucker_apex: id(8722087466111641),
} as const satisfies Readonly<Record<string, BiomesId>>;

/**
 * Stable recipe biscuit identities. These ids are deliberately checked in
 * rather than derived from recipe names so renaming presentation copy cannot
 * orphan a player's native RecipeBook or invalidate a craft trigger.
 */
export const HARTHMERE_NATIVE_RECIPE_ID_MANIFEST = {
  harthmere_alchemy_antidote: id(8770000000000000),
  harthmere_alchemy_health_potion: id(8770000000000001),
  harthmere_alchemy_herbal_extract: id(8770000000000002),
  harthmere_angler_fishing_lure: id(8770000000000003),
  harthmere_bell_bronze_ingot: id(8770000000000004),
  harthmere_bellbinders_voice: id(8770000000000005),
  harthmere_blacksmith_iron_ingot: id(8770000000000006),
  harthmere_blacksmith_iron_sword: id(8770000000000007),
  harthmere_blacksmith_repair_iron_sword: id(8770000000000008),
  harthmere_blacksmith_salvage_iron_sword: id(8770000000000009),
  harthmere_blacksmith_upgrade_iron_sword: id(8770000000000010),
  harthmere_block_asphalt: id(8770000000000011),
  harthmere_block_basalt_brick: id(8770000000000012),
  harthmere_block_basalt_carved: id(8770000000000013),
  harthmere_block_basalt_polished: id(8770000000000014),
  harthmere_block_basalt_shingles: id(8770000000000015),
  harthmere_block_birch_lumber: id(8770000000000016),
  harthmere_block_birch_reinforced: id(8770000000000017),
  harthmere_block_birch_stripped: id(8770000000000018),
  harthmere_block_clay_brick: id(8770000000000019),
  harthmere_block_clay_carved: id(8770000000000020),
  harthmere_block_clay_polished: id(8770000000000021),
  harthmere_block_clay_shingles: id(8770000000000022),
  harthmere_block_cobblestone_brick: id(8770000000000023),
  harthmere_block_cobblestone_carved: id(8770000000000024),
  harthmere_block_cobblestone_polished: id(8770000000000025),
  harthmere_block_cobblestone_shingles: id(8770000000000026),
  harthmere_block_copper: id(8770000000000027),
  harthmere_block_cotton_fabric: id(8770000000000028),
  harthmere_block_diamond: id(8770000000000029),
  harthmere_block_emberstone: id(8770000000000030),
  harthmere_block_gold: id(8770000000000031),
  harthmere_block_granite_brick: id(8770000000000032),
  harthmere_block_granite_carved: id(8770000000000033),
  harthmere_block_granite_polished: id(8770000000000034),
  harthmere_block_granite_shingles: id(8770000000000035),
  harthmere_block_ice: id(8770000000000036),
  harthmere_block_led: id(8770000000000037),
  harthmere_block_limestone_brick: id(8770000000000038),
  harthmere_block_limestone_carved: id(8770000000000039),
  harthmere_block_limestone_polished: id(8770000000000040),
  harthmere_block_limestone_shingles: id(8770000000000041),
  harthmere_block_moonstone: id(8770000000000042),
  harthmere_block_mushroom_leather: id(8770000000000043),
  harthmere_block_neptunium: id(8770000000000044),
  harthmere_block_oak_lumber: id(8770000000000045),
  harthmere_block_oak_reinforced: id(8770000000000046),
  harthmere_block_oak_stripped: id(8770000000000047),
  harthmere_block_quartzite_brick: id(8770000000000048),
  harthmere_block_quartzite_carved: id(8770000000000049),
  harthmere_block_quartzite_polished: id(8770000000000050),
  harthmere_block_quartzite_shingles: id(8770000000000051),
  harthmere_block_rubber_lumber: id(8770000000000052),
  harthmere_block_rubber_reinforced: id(8770000000000053),
  harthmere_block_rubber_stripped: id(8770000000000054),
  harthmere_block_sakura_lumber: id(8770000000000055),
  harthmere_block_silver: id(8770000000000056),
  harthmere_block_simple_glass: id(8770000000000057),
  harthmere_block_stone_brick: id(8770000000000058),
  harthmere_block_stone_carved: id(8770000000000059),
  harthmere_block_stone_polished: id(8770000000000060),
  harthmere_block_stone_shingles: id(8770000000000061),
  harthmere_block_sunstone: id(8770000000000062),
  harthmere_block_thatch: id(8770000000000063),
  harthmere_carpentry_hunter_bow: id(8770000000000064),
  harthmere_carpentry_road_repair_kit: id(8770000000000065),
  harthmere_carpentry_wood_plank: id(8770000000000066),
  harthmere_decor_business_service_counter: id(8770000000000067),
  harthmere_decor_garden_planter_box: id(8770000000000068),
  harthmere_decor_hearth_lamp: id(8770000000000069),
  harthmere_decor_place_4537020877769721: id(8770000000000070),
  harthmere_decor_place_bench: id(8770000000000071),
  harthmere_decor_place_boombox: id(8770000000000072),
  harthmere_decor_place_cargo_crate: id(8770000000000073),
  harthmere_decor_place_display_shelf: id(8770000000000074),
  harthmere_decor_place_fancy_bed: id(8770000000000075),
  harthmere_decor_place_fish_wall_mount: id(8770000000000076),
  harthmere_decor_place_gold_frame: id(8770000000000077),
  harthmere_decor_place_large_oak_frame: id(8770000000000078),
  harthmere_decor_place_led_panel: id(8770000000000079),
  harthmere_decor_place_lockbox: id(8770000000000080),
  harthmere_decor_place_mailbox: id(8770000000000081),
  harthmere_decor_place_medium_oak_frame: id(8770000000000082),
  harthmere_decor_place_oak_tray: id(8770000000000083),
  harthmere_decor_place_padded_chair: id(8770000000000084),
  harthmere_decor_place_record_player: id(8770000000000085),
  harthmere_decor_place_runic_stone_light: id(8770000000000086),
  harthmere_decor_place_shelf: id(8770000000000087),
  harthmere_decor_place_silver_frame: id(8770000000000088),
  harthmere_decor_place_small_bed: id(8770000000000089),
  harthmere_decor_place_small_oak_frame: id(8770000000000090),
  harthmere_decor_place_small_oak_sign: id(8770000000000091),
  harthmere_decor_place_t_table: id(8770000000000092),
  harthmere_decor_place_table: id(8770000000000093),
  harthmere_decor_place_treasure_chest: id(8770000000000094),
  harthmere_decor_place_wall_lantern: id(8770000000000095),
  harthmere_decor_place_wardrobe_storage: id(8770000000000096),
  harthmere_decor_place_wood_container: id(8770000000000097),
  harthmere_decor_place_wooden_chair: id(8770000000000098),
  harthmere_decor_place_town_chapel_altar: id(8770000000000165),
  harthmere_decor_place_town_chapel_pew: id(8770000000000164),
  harthmere_decor_place_town_cookpot: id(8770000000000168),
  harthmere_decor_place_town_firewood_stack: id(8770000000000167),
  harthmere_decor_place_town_forge_anvil: id(8770000000000154),
  harthmere_decor_place_town_grave_tool_rack: id(8770000000000166),
  harthmere_decor_place_town_produce_crate: id(8770000000000158),
  harthmere_decor_place_town_reagent_shelf: id(8770000000000162),
  harthmere_decor_place_town_record_stack: id(8770000000000161),
  harthmere_decor_place_town_rope_rack: id(8770000000000157),
  harthmere_decor_place_town_oven_range: id(8770000000000169),
  harthmere_decor_place_town_textile_drape: id(8770000000000160),
  harthmere_decor_place_town_tool_rack: id(8770000000000156),
  harthmere_decor_place_town_ward_focus: id(8770000000000163),
  harthmere_decor_place_town_wash_tub: id(8770000000000159),
  harthmere_decor_place_town_workbench: id(8770000000000155),
  harthmere_decor_storage_cabinet: id(8770000000000099),
  harthmere_enchant_warded_iron_sword: id(8770000000000100),
  harthmere_exotic_alcubierre_drive_core: id(8770000000000101),
  harthmere_exotic_anchor_core: id(8770000000000102),
  harthmere_exotic_antiboron_block: id(8770000000000103),
  harthmere_exotic_antihelium_block: id(8770000000000104),
  harthmere_exotic_antihydrogen_block: id(8770000000000105),
  harthmere_exotic_certified_portal_fuel: id(8770000000000106),
  harthmere_exotic_destination_crystal: id(8770000000000148),
  harthmere_exotic_portal_fuel_cell: id(8770000000000107),
  harthmere_exotic_power_cell: id(8770000000000108),
  harthmere_exotic_raw_matter_block: id(8770000000000109),
  harthmere_exotic_stabilized_matter_block: id(8770000000000110),
  harthmere_exotic_teleport_fuel: id(8770000000000111),
  harthmere_exotic_utility_core: id(8770000000000112),
  harthmere_grove_festival_skewer: id(8770000000000142),
  harthmere_grove_road_torch: id(8770000000000143),
  // HARTHMERE_JOB_MATERIAL_RECIPES: native identities for the Jobs Board
  // bundle recipes, so crafting them goes through the signed ECS inventory
  // transaction like every other Harthmere recipe.
  harthmere_job_crop_bundle: id(8770000000000144),
  harthmere_job_herb_bundle: id(8770000000000145),
  harthmere_job_linen_bundle: id(8770000000000146),
  harthmere_job_repair_part: id(8770000000000147),
  harthmere_leatherworking_armor: id(8770000000000113),
  harthmere_leatherworking_boiled_leather: id(8770000000000114),
  harthmere_refine_copper_ingot: id(8770000000000115),
  harthmere_refine_diamond_shard: id(8770000000000116),
  harthmere_refine_gold_ingot: id(8770000000000117),
  harthmere_refine_neptunium_shard: id(8770000000000118),
  harthmere_refine_silver_ingot: id(8770000000000119),
  harthmere_refine_tree_resin: id(8770000000000120),
  harthmere_seed_mill_grain_flour: id(8770000000000121),
  harthmere_station_alchemyBench: id(8770000000000122),
  harthmere_station_anglers_table: id(8770000000000123),
  harthmere_station_composter: id(8770000000000124),
  harthmere_station_dye_o_matic: id(8770000000000125),
  harthmere_station_forge: id(8770000000000126),
  harthmere_station_kiln: id(8770000000000127),
  harthmere_station_kitchen: id(8770000000000128),
  harthmere_station_loom: id(8770000000000129),
  harthmere_station_seed_mill: id(8770000000000130),
  harthmere_station_stonecutter: id(8770000000000131),
  harthmere_station_tailoring_booth: id(8770000000000132),
  harthmere_station_thermoblaster: id(8770000000000133),
  harthmere_station_thermolite: id(8770000000000134),
  harthmere_station_workbench: id(8770000000000135),
  harthmere_tailoring_linen_cloth: id(8770000000000136),
  harthmere_tailoring_travel_cloak: id(8770000000000137),
  harthmere_tool_bucket_recipe: id(8770000000000138),
  harthmere_tool_hoe_recipe: id(8770000000000139),
  harthmere_tool_muck_buster_recipe: id(8770000000000140),
  harthmere_tool_watering_can_recipe: id(8770000000000141),
} as const satisfies Readonly<Record<string, BiomesId>>;
