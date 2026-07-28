import type { BiomesId } from "@/shared/ids";

const id = (value: number) => value as BiomesId;

/**
 * Stable identities for code-authored Harthmere quests and their trigger
 * nodes. These ids are data, not hashes: renaming a quest/objective requires an
 * explicit migration instead of silently orphaning Challenges/TriggerState.
 */
export const HARTHMERE_NATIVE_QUEST_ID_MANIFEST = {
  "grove:read-the-jobs-board": id(8760000000000000),
  "grove:building_system_intro_talk_to_mira": id(8760000000000001),
  "grove:fountain_buttons_first": id(8760000000000002),
  "grove:painted_path_language": id(8760000000000003),
  "grove:road_ready_bag_check": id(8760000000000004),
  "grove:tools_before_treasure": id(8760000000000005),
  "grove:safe_sparring_not_pvp": id(8760000000000006),
  "grove:ready_check_at_fountain": id(8760000000000007),
  "grove:lost_found_and_mail": id(8760000000000008),
  "grove:road_signs_and_small_lies": id(8760000000000009),
  "grove:build_repair_claim_lesson": id(8760000000000010),
  "grove:guilds_are_promises": id(8760000000000011),
  "grove:color_that_still_points_home": id(8760000000000012),
  "grove:cart_that_forgot_its_wheel": id(8760000000000013),
  "grove:road_ready_not_fancy": id(8760000000000014),
  "grove:moss_that_went_quiet": id(8760000000000015),
  "grove:songline_under_the_lawn": id(8760000000000016),
  "grove:sticky_medicine": id(8760000000000017),
  "grove:cove_keeps_pictures": id(8760000000000018),
  "grove:coops_key_hen": id(8760000000000019),
  "grove:tower_with_a_headache": id(8760000000000020),
  "grove:letter_for_the_north_gate": id(8760000000000021),
  "grove:antlers_for_the_watch": id(8760000000000022),
  "grove:toll_ledger_problem": id(8760000000000023),
  "grove:samples_for_the_chapel": id(8760000000000024),
  "grove:tone_beneath_the_road": id(8760000000000025),
  "grove:fountain_chat_channels": id(8760000000000026),
  "grove:fountain_food_keeps_you_moving": id(8760000000000027),
  "grove:fountain_first_aid_before_road": id(8760000000000028),
  "grove:fountain_hotbar_and_dropping": id(8760000000000029),
  "grove:fountain_first_recipe_torch": id(8760000000000030),
  "grove:fountain_trade_table_promises": id(8760000000000031),
  "grove:grove_road_graduation": id(8760000000000032),
  "grove:intro_alexis_lovely_locks": id(8760000000000033),
  "grove:intro_luis_crossroads_cart": id(8760000000000034),
  "grove:intro_jane_mosslawn_edge": id(8760000000000035),
  "grove:econ_billys_lost_lunch_pail": id(8760000000000036),
  "grove:econ_billys_roof_patch_run": id(8760000000000037),
  "grove:econ_billys_map_pin_run": id(8760000000000038),
  "grove:econ_merls_coin_sorting": id(8760000000000039),
  "grove:econ_merls_vault_inventory": id(8760000000000040),
  "grove:econ_gus_fresh_loaves_to_fountain": id(8760000000000041),
  "grove:econ_gus_grain_run": id(8760000000000042),
  "grove:econ_fern_water_the_sprout_beds": id(8760000000000043),
  "grove:econ_fern_berry_patch_harvest": id(8760000000000044),
  "grove:econ_kit_letters_around_fountain": id(8760000000000045),
  "grove:econ_kit_heavy_parcel_to_crossroads": id(8760000000000046),
  "grove:econ_mel_bench_repair": id(8760000000000047),
  "grove:econ_mel_broken_hinge_hunt": id(8760000000000048),
  "grove:econ_rin_mushroom_pickup": id(8760000000000049),
  "grove:econ_carlo_festival_skewers": id(8760000000000050),
  "bible:bellbound_q01_cracks_in_bridge": id(8760000000000051),
  "bible:bellbound_q02_whispers_at_well": id(8760000000000052),
  "bible:bellbound_q02_5_rat_girl_knows": id(8760000000000053),
  "bible:bellbound_q03_dreams_of_drowning": id(8760000000000054),
  "bible:bellbound_q04_sisters_letters": id(8760000000000055),
  "bible:bellbound_q05_beneath_the_stones": id(8760000000000056),
  "bible:bellbound_q06_hidden_door": id(8760000000000057),
  "bible:bellbound_q07_bellward_halls": id(8760000000000058),
  "bible:bellbound_q08_voices_in_stone": id(8760000000000059),
  "bible:bellbound_q09_veins_of_wyrm": id(8760000000000060),
  "bible:bellbound_q10_bellbinders_tomb": id(8760000000000061),
  "bible:bellbound_q11_last_ringing": id(8760000000000062),
  "bible:bellbound_q12_thaedryn_bellbound": id(8760000000000063),
  "bible:harthmere_sq_001_the_gate_ledger": id(8760000000000064),
  "bible:harthmere_sq_002_the_viddas_daughter": id(8760000000000065),
  "bible:harthmere_sq_003_strangers_at_the_gate": id(8760000000000066),
  "bible:harthmere_sq_004_the_drill_that_wouldnt_end": id(8760000000000067),
  "bible:harthmere_sq_005_patrol_route_seven": id(8760000000000068),
  "bible:harthmere_sq_006_tessens_choice": id(8760000000000069),
  "bible:harthmere_sq_007_the_crooked_scales": id(8760000000000070),
  "bible:harthmere_sq_008_a_friend_of_brees": id(8760000000000071),
  "bible:harthmere_sq_009_the_hoarder": id(8760000000000072),
  "bible:harthmere_sq_010_three_casks_short": id(8760000000000073),
  "bible:harthmere_sq_011_the_locked_room": id(8760000000000074),
  "bible:harthmere_sq_012_bard_night": id(8760000000000075),
  "bible:harthmere_sq_013_the_apprentices_burn": id(8760000000000076),
  "bible:harthmere_sq_014_the_rebels_blade": id(8760000000000077),
  "bible:harthmere_sq_015_the_masters_mark": id(8760000000000078),
  "bible:harthmere_sq_016_candles_for_the_forgotten": id(8760000000000079),
  "bible:harthmere_sq_017_sister_maelles_concern": id(8760000000000080),
  "bible:harthmere_sq_018_the_boy_who_saw_the_bell": id(8760000000000081),
  "bible:harthmere_sq_019_the_diplomats_dinner": id(8760000000000082),
  "bible:harthmere_sq_020_the_audit": id(8760000000000083),
  "bible:harthmere_sq_021_the_daughters_secret": id(8760000000000084),
  "bible:harthmere_sq_022_the_wrong_antidote": id(8760000000000085),
  "bible:harthmere_sq_023_the_garden_in_the_glade": id(8760000000000086),
  "bible:harthmere_sq_024_the_accusation": id(8760000000000087),
  "bible:harthmere_sq_025_the_manifest": id(8760000000000088),
  "bible:harthmere_sq_026_the_whispering_crate": id(8760000000000089),
  "bible:harthmere_sq_027_linas_promise": id(8760000000000090),
  "bible:harthmere_sq_028_rats_with_crowns": id(8760000000000091),
  "bible:harthmere_sq_029_the_missing_ones": id(8760000000000092),
  "bible:harthmere_sq_030_the_eviction": id(8760000000000093),
  "bible:harthmere_sq_031_the_last_letter": id(8760000000000094),
  "bible:harthmere_sq_032_the_marsh_guides_burden": id(8760000000000095),
  "bible:harthmere_sq_033_the_old_hunters_debt": id(8760000000000096),
  "bible:harthmere_sq_034_the_charcoal_burners_cough": id(8760000000000097),
  "bible:harthmere_sq_035_the_pilgrims_path": id(8760000000000098),
  "bible:harthmere_sq_036_tamsins_trial": id(8760000000000099),
  "bible:harthmere_sq_037_the_moss_womans_riddle": id(8760000000000100),
  "bible:harthmere_sq_038_the_brass_scales_books": id(8760000000000101),
  "bible:harthmere_sq_039_a_debt_to_settle": id(8760000000000102),
  "bible:harthmere_sq_040_the_buried_bell": id(8760000000000103),
  "bible:harthmere_sq_041_the_doorway_that_wasnt": id(8760000000000104),
  "bible:harthmere_sq_042_the_singing_in_the_walls": id(8760000000000105),
  "bible:starter_welcome_to_harthmere": id(8760000000000106),
  "bible:starter_apples_for_dawnloaf": id(8760000000000107),
  "bible:starter_missing_lockbox": id(8760000000000108),
  "bible:starter_cold_iron_hot_temper": id(8760000000000109),
  "bible:starter_fever_tea": id(8760000000000110),
  "bible:starter_rumor_has_it": id(8760000000000111),
  "bible:starter_loose_chickens": id(8760000000000112),
  "bible:starter_whispering_crate": id(8760000000000113),
  "bible:starter_the_missing_bell": id(8760000000000114),
  "bible:repeatable_watch_patrol_routes": id(8760000000000115),
  "bible:repeatable_watch_bounty_board": id(8760000000000116),
  "bible:repeatable_watch_gate_inspections": id(8760000000000117),
  "bible:repeatable_merchant_market_writs": id(8760000000000118),
  "bible:repeatable_merchant_cargo_escorts": id(8760000000000119),
  "bible:repeatable_chapel_charity_deliveries": id(8760000000000120),
  "bible:repeatable_chapel_candle_vigils": id(8760000000000121),
  "bible:repeatable_chapel_grave_tending": id(8760000000000122),
  "bible:repeatable_river_knots_information_drops": id(8760000000000123),
  "bible:repeatable_river_knots_small_smuggling_runs": id(8760000000000124),
  "bible:repeatable_mudden_rat_catching": id(8760000000000125),
  "bible:repeatable_mudden_food_distribution": id(8760000000000126),
  "bible:weekly_watch_town_defense_drill": id(8760000000000127),
  "bible:weekly_merchant_bridge_day_setup": id(8760000000000128),
  "bible:weekly_chapel_river_blessing_prep": id(8760000000000129),
  "bible:weekly_river_knots_cargo_heist": id(8760000000000130),
  "bible:weekly_mudden_ward_fair": id(8760000000000131),
  "bible:repeatable_wilds_resource_route": id(8760000000000132),
  "bible:repeatable_wilds_rescue_lost_traveler": id(8760000000000133),
  "bible:repeatable_wilds_road_bandits": id(8760000000000134),
  "bible:repeatable_briarfen_witchlights": id(8760000000000135),
} as const satisfies Readonly<Record<string, BiomesId>>;

export const HARTHMERE_NATIVE_QUEST_STEP_ID_MANIFEST = {
  "grove:read-the-jobs-board:root": id(8761000000000000),
  "grove:read-the-jobs-board:objective:0": id(8761000000000001),
  "grove:building_system_intro_talk_to_mira:root": id(8761000000000002),
  "grove:building_system_intro_talk_to_mira:objective:0": id(8761000000000003),
  "grove:fountain_buttons_first:root": id(8761000000000004),
  "grove:fountain_buttons_first:objective:0": id(8761000000000005),
  "grove:fountain_buttons_first:objective:1": id(8761000000000006),
  "grove:fountain_buttons_first:objective:2": id(8761000000000007),
  "grove:fountain_buttons_first:objective:3": id(8761000000000008),
  "grove:fountain_buttons_first:objective:4": id(8761000000000009),
  "grove:painted_path_language:root": id(8761000000000010),
  "grove:painted_path_language:objective:0": id(8761000000000011),
  "grove:painted_path_language:objective:1": id(8761000000000012),
  "grove:painted_path_language:objective:2": id(8761000000000013),
  "grove:painted_path_language:objective:3": id(8761000000000014),
  "grove:painted_path_language:objective:4": id(8761000000000015),
  "grove:painted_path_language:objective:5": id(8761000000000016),
  "grove:road_ready_bag_check:root": id(8761000000000017),
  "grove:road_ready_bag_check:objective:0": id(8761000000000018),
  "grove:road_ready_bag_check:objective:1": id(8761000000000019),
  "grove:road_ready_bag_check:objective:2": id(8761000000000020),
  "grove:road_ready_bag_check:objective:3": id(8761000000000021),
  "grove:road_ready_bag_check:objective:4": id(8761000000000022),
  "grove:road_ready_bag_check:objective:5": id(8761000000000023),
  "grove:tools_before_treasure:root": id(8761000000000024),
  "grove:tools_before_treasure:objective:0": id(8761000000000025),
  "grove:tools_before_treasure:objective:1": id(8761000000000026),
  "grove:tools_before_treasure:objective:2": id(8761000000000027),
  "grove:tools_before_treasure:objective:3": id(8761000000000028),
  "grove:tools_before_treasure:objective:4": id(8761000000000029),
  "grove:tools_before_treasure:objective:5": id(8761000000000030),
  "grove:tools_before_treasure:objective:6": id(8761000000000031),
  "grove:safe_sparring_not_pvp:root": id(8761000000000032),
  "grove:safe_sparring_not_pvp:objective:0": id(8761000000000033),
  "grove:safe_sparring_not_pvp:objective:1": id(8761000000000034),
  "grove:safe_sparring_not_pvp:objective:2": id(8761000000000035),
  "grove:safe_sparring_not_pvp:objective:3": id(8761000000000036),
  "grove:safe_sparring_not_pvp:objective:4": id(8761000000000037),
  "grove:safe_sparring_not_pvp:objective:5": id(8761000000000038),
  "grove:safe_sparring_not_pvp:objective:6": id(8761000000000039),
  "grove:ready_check_at_fountain:root": id(8761000000000040),
  "grove:ready_check_at_fountain:objective:0": id(8761000000000041),
  "grove:ready_check_at_fountain:objective:1": id(8761000000000042),
  "grove:ready_check_at_fountain:objective:2": id(8761000000000043),
  "grove:ready_check_at_fountain:objective:3": id(8761000000000044),
  "grove:ready_check_at_fountain:objective:4": id(8761000000000045),
  "grove:ready_check_at_fountain:objective:5": id(8761000000000046),
  "grove:ready_check_at_fountain:objective:6": id(8761000000000047),
  "grove:lost_found_and_mail:root": id(8761000000000048),
  "grove:lost_found_and_mail:objective:0": id(8761000000000049),
  "grove:lost_found_and_mail:objective:1": id(8761000000000050),
  "grove:lost_found_and_mail:objective:2": id(8761000000000051),
  "grove:lost_found_and_mail:objective:3": id(8761000000000052),
  "grove:lost_found_and_mail:objective:4": id(8761000000000053),
  "grove:lost_found_and_mail:objective:5": id(8761000000000054),
  "grove:road_signs_and_small_lies:root": id(8761000000000055),
  "grove:road_signs_and_small_lies:objective:0": id(8761000000000056),
  "grove:road_signs_and_small_lies:objective:1": id(8761000000000057),
  "grove:road_signs_and_small_lies:objective:2": id(8761000000000058),
  "grove:road_signs_and_small_lies:objective:3": id(8761000000000059),
  "grove:build_repair_claim_lesson:root": id(8761000000000060),
  "grove:build_repair_claim_lesson:objective:0": id(8761000000000061),
  "grove:build_repair_claim_lesson:objective:1": id(8761000000000062),
  "grove:build_repair_claim_lesson:objective:2": id(8761000000000063),
  "grove:build_repair_claim_lesson:objective:3": id(8761000000000064),
  "grove:build_repair_claim_lesson:objective:4": id(8761000000000065),
  "grove:build_repair_claim_lesson:objective:5": id(8761000000000066),
  "grove:build_repair_claim_lesson:objective:6": id(8761000000000067),
  "grove:build_repair_claim_lesson:objective:7": id(8761000000000068),
  "grove:guilds_are_promises:root": id(8761000000000069),
  "grove:guilds_are_promises:objective:0": id(8761000000000070),
  "grove:guilds_are_promises:objective:1": id(8761000000000071),
  "grove:guilds_are_promises:objective:2": id(8761000000000072),
  "grove:guilds_are_promises:objective:3": id(8761000000000073),
  "grove:guilds_are_promises:objective:4": id(8761000000000074),
  "grove:guilds_are_promises:objective:5": id(8761000000000075),
  "grove:guilds_are_promises:objective:6": id(8761000000000076),
  "grove:guilds_are_promises:objective:7": id(8761000000000077),
  "grove:color_that_still_points_home:root": id(8761000000000078),
  "grove:color_that_still_points_home:objective:0": id(8761000000000079),
  "grove:color_that_still_points_home:objective:1": id(8761000000000080),
  "grove:color_that_still_points_home:objective:2": id(8761000000000081),
  "grove:color_that_still_points_home:objective:3": id(8761000000000082),
  "grove:cart_that_forgot_its_wheel:root": id(8761000000000083),
  "grove:cart_that_forgot_its_wheel:objective:0": id(8761000000000084),
  "grove:cart_that_forgot_its_wheel:objective:1": id(8761000000000085),
  "grove:cart_that_forgot_its_wheel:objective:2": id(8761000000000086),
  "grove:cart_that_forgot_its_wheel:objective:3": id(8761000000000087),
  "grove:road_ready_not_fancy:root": id(8761000000000088),
  "grove:road_ready_not_fancy:objective:0": id(8761000000000089),
  "grove:road_ready_not_fancy:objective:1": id(8761000000000090),
  "grove:road_ready_not_fancy:objective:2": id(8761000000000091),
  "grove:road_ready_not_fancy:objective:3": id(8761000000000092),
  "grove:moss_that_went_quiet:root": id(8761000000000093),
  "grove:moss_that_went_quiet:objective:0": id(8761000000000094),
  "grove:moss_that_went_quiet:objective:1": id(8761000000000095),
  "grove:moss_that_went_quiet:objective:2": id(8761000000000096),
  "grove:moss_that_went_quiet:objective:3": id(8761000000000097),
  "grove:songline_under_the_lawn:root": id(8761000000000098),
  "grove:songline_under_the_lawn:objective:0": id(8761000000000099),
  "grove:songline_under_the_lawn:objective:1": id(8761000000000100),
  "grove:songline_under_the_lawn:objective:2": id(8761000000000101),
  "grove:songline_under_the_lawn:objective:3": id(8761000000000102),
  "grove:sticky_medicine:root": id(8761000000000103),
  "grove:sticky_medicine:objective:0": id(8761000000000104),
  "grove:sticky_medicine:objective:1": id(8761000000000105),
  "grove:sticky_medicine:objective:2": id(8761000000000106),
  "grove:sticky_medicine:objective:3": id(8761000000000107),
  "grove:cove_keeps_pictures:root": id(8761000000000108),
  "grove:cove_keeps_pictures:objective:0": id(8761000000000109),
  "grove:cove_keeps_pictures:objective:1": id(8761000000000110),
  "grove:cove_keeps_pictures:objective:2": id(8761000000000111),
  "grove:cove_keeps_pictures:objective:3": id(8761000000000112),
  "grove:cove_keeps_pictures:objective:4": id(8761000000000113),
  "grove:coops_key_hen:root": id(8761000000000114),
  "grove:coops_key_hen:objective:0": id(8761000000000115),
  "grove:coops_key_hen:objective:1": id(8761000000000116),
  "grove:coops_key_hen:objective:2": id(8761000000000117),
  "grove:coops_key_hen:objective:3": id(8761000000000118),
  "grove:tower_with_a_headache:root": id(8761000000000119),
  "grove:tower_with_a_headache:objective:0": id(8761000000000120),
  "grove:tower_with_a_headache:objective:1": id(8761000000000121),
  "grove:tower_with_a_headache:objective:2": id(8761000000000122),
  "grove:tower_with_a_headache:objective:3": id(8761000000000123),
  "grove:letter_for_the_north_gate:root": id(8761000000000124),
  "grove:letter_for_the_north_gate:objective:0": id(8761000000000125),
  "grove:letter_for_the_north_gate:objective:1": id(8761000000000126),
  "grove:letter_for_the_north_gate:objective:2": id(8761000000000127),
  "grove:letter_for_the_north_gate:objective:3": id(8761000000000128),
  "grove:antlers_for_the_watch:root": id(8761000000000129),
  "grove:antlers_for_the_watch:objective:0": id(8761000000000130),
  "grove:antlers_for_the_watch:objective:1": id(8761000000000131),
  "grove:antlers_for_the_watch:objective:2": id(8761000000000132),
  "grove:antlers_for_the_watch:objective:3": id(8761000000000133),
  "grove:toll_ledger_problem:root": id(8761000000000134),
  "grove:toll_ledger_problem:objective:0": id(8761000000000135),
  "grove:toll_ledger_problem:objective:1": id(8761000000000136),
  "grove:toll_ledger_problem:objective:2": id(8761000000000137),
  "grove:toll_ledger_problem:objective:3": id(8761000000000138),
  "grove:samples_for_the_chapel:root": id(8761000000000139),
  "grove:samples_for_the_chapel:objective:0": id(8761000000000140),
  "grove:samples_for_the_chapel:objective:1": id(8761000000000141),
  "grove:samples_for_the_chapel:objective:2": id(8761000000000142),
  "grove:samples_for_the_chapel:objective:3": id(8761000000000143),
  "grove:tone_beneath_the_road:root": id(8761000000000144),
  "grove:tone_beneath_the_road:objective:0": id(8761000000000145),
  "grove:tone_beneath_the_road:objective:1": id(8761000000000146),
  "grove:tone_beneath_the_road:objective:2": id(8761000000000147),
  "grove:tone_beneath_the_road:objective:3": id(8761000000000148),
  "grove:fountain_chat_channels:root": id(8761000000000149),
  "grove:fountain_chat_channels:objective:0": id(8761000000000150),
  "grove:fountain_chat_channels:objective:1": id(8761000000000151),
  "grove:fountain_chat_channels:objective:2": id(8761000000000152),
  "grove:fountain_chat_channels:objective:3": id(8761000000000153),
  "grove:fountain_chat_channels:objective:4": id(8761000000000154),
  "grove:fountain_chat_channels:objective:5": id(8761000000000155),
  "grove:fountain_food_keeps_you_moving:root": id(8761000000000156),
  "grove:fountain_food_keeps_you_moving:objective:0": id(8761000000000157),
  "grove:fountain_food_keeps_you_moving:objective:1": id(8761000000000158),
  "grove:fountain_food_keeps_you_moving:objective:2": id(8761000000000159),
  "grove:fountain_food_keeps_you_moving:objective:3": id(8761000000000160),
  "grove:fountain_food_keeps_you_moving:objective:4": id(8761000000000161),
  "grove:fountain_food_keeps_you_moving:objective:5": id(8761000000000162),
  "grove:fountain_first_aid_before_road:root": id(8761000000000163),
  "grove:fountain_first_aid_before_road:objective:0": id(8761000000000164),
  "grove:fountain_first_aid_before_road:objective:1": id(8761000000000165),
  "grove:fountain_first_aid_before_road:objective:2": id(8761000000000166),
  "grove:fountain_first_aid_before_road:objective:3": id(8761000000000167),
  "grove:fountain_first_aid_before_road:objective:4": id(8761000000000168),
  "grove:fountain_first_aid_before_road:objective:5": id(8761000000000169),
  "grove:fountain_hotbar_and_dropping:root": id(8761000000000170),
  "grove:fountain_hotbar_and_dropping:objective:0": id(8761000000000171),
  "grove:fountain_hotbar_and_dropping:objective:1": id(8761000000000172),
  "grove:fountain_hotbar_and_dropping:objective:2": id(8761000000000173),
  "grove:fountain_hotbar_and_dropping:objective:3": id(8761000000000174),
  "grove:fountain_hotbar_and_dropping:objective:4": id(8761000000000175),
  "grove:fountain_hotbar_and_dropping:objective:5": id(8761000000000176),
  "grove:fountain_first_recipe_torch:root": id(8761000000000177),
  "grove:fountain_first_recipe_torch:objective:0": id(8761000000000178),
  "grove:fountain_first_recipe_torch:objective:1": id(8761000000000179),
  "grove:fountain_first_recipe_torch:objective:2": id(8761000000000180),
  "grove:fountain_first_recipe_torch:objective:3": id(8761000000000181),
  "grove:fountain_first_recipe_torch:objective:4": id(8761000000000182),
  "grove:fountain_first_recipe_torch:objective:5": id(8761000000000183),
  "grove:fountain_trade_table_promises:root": id(8761000000000184),
  "grove:fountain_trade_table_promises:objective:0": id(8761000000000185),
  "grove:fountain_trade_table_promises:objective:1": id(8761000000000186),
  "grove:fountain_trade_table_promises:objective:2": id(8761000000000187),
  "grove:fountain_trade_table_promises:objective:3": id(8761000000000188),
  "grove:fountain_trade_table_promises:objective:4": id(8761000000000189),
  "grove:fountain_trade_table_promises:objective:5": id(8761000000000190),
  "grove:grove_road_graduation:root": id(8761000000000191),
  "grove:grove_road_graduation:objective:0": id(8761000000000192),
  "grove:grove_road_graduation:objective:1": id(8761000000000193),
  "grove:grove_road_graduation:objective:2": id(8761000000000194),
  "grove:grove_road_graduation:objective:3": id(8761000000000195),
  "grove:grove_road_graduation:objective:4": id(8761000000000196),
  "grove:intro_alexis_lovely_locks:root": id(8761000000000197),
  "grove:intro_alexis_lovely_locks:objective:0": id(8761000000000198),
  "grove:intro_alexis_lovely_locks:objective:1": id(8761000000000199),
  "grove:intro_alexis_lovely_locks:objective:2": id(8761000000000200),
  "grove:intro_alexis_lovely_locks:objective:3": id(8761000000000201),
  "grove:intro_alexis_lovely_locks:objective:4": id(8761000000000202),
  "grove:intro_luis_crossroads_cart:root": id(8761000000000203),
  "grove:intro_luis_crossroads_cart:objective:0": id(8761000000000204),
  "grove:intro_luis_crossroads_cart:objective:1": id(8761000000000205),
  "grove:intro_luis_crossroads_cart:objective:2": id(8761000000000206),
  "grove:intro_luis_crossroads_cart:objective:3": id(8761000000000207),
  "grove:intro_luis_crossroads_cart:objective:4": id(8761000000000208),
  "grove:intro_jane_mosslawn_edge:root": id(8761000000000209),
  "grove:intro_jane_mosslawn_edge:objective:0": id(8761000000000210),
  "grove:intro_jane_mosslawn_edge:objective:1": id(8761000000000211),
  "grove:intro_jane_mosslawn_edge:objective:2": id(8761000000000212),
  "grove:intro_jane_mosslawn_edge:objective:3": id(8761000000000213),
  "grove:intro_jane_mosslawn_edge:objective:4": id(8761000000000214),
  "grove:econ_billys_lost_lunch_pail:root": id(8761000000000215),
  "grove:econ_billys_lost_lunch_pail:objective:0": id(8761000000000216),
  "grove:econ_billys_lost_lunch_pail:objective:1": id(8761000000000217),
  "grove:econ_billys_lost_lunch_pail:objective:2": id(8761000000000218),
  "grove:econ_billys_lost_lunch_pail:objective:3": id(8761000000000219),
  "grove:econ_billys_roof_patch_run:root": id(8761000000000220),
  "grove:econ_billys_roof_patch_run:objective:0": id(8761000000000221),
  "grove:econ_billys_roof_patch_run:objective:1": id(8761000000000222),
  "grove:econ_billys_roof_patch_run:objective:2": id(8761000000000223),
  "grove:econ_billys_roof_patch_run:objective:3": id(8761000000000224),
  "grove:econ_billys_map_pin_run:root": id(8761000000000225),
  "grove:econ_billys_map_pin_run:objective:0": id(8761000000000226),
  "grove:econ_billys_map_pin_run:objective:1": id(8761000000000227),
  "grove:econ_billys_map_pin_run:objective:2": id(8761000000000228),
  "grove:econ_billys_map_pin_run:objective:3": id(8761000000000229),
  "grove:econ_merls_coin_sorting:root": id(8761000000000230),
  "grove:econ_merls_coin_sorting:objective:0": id(8761000000000231),
  "grove:econ_merls_coin_sorting:objective:1": id(8761000000000232),
  "grove:econ_merls_coin_sorting:objective:2": id(8761000000000233),
  "grove:econ_merls_coin_sorting:objective:3": id(8761000000000234),
  "grove:econ_merls_vault_inventory:root": id(8761000000000235),
  "grove:econ_merls_vault_inventory:objective:0": id(8761000000000236),
  "grove:econ_merls_vault_inventory:objective:1": id(8761000000000237),
  "grove:econ_merls_vault_inventory:objective:2": id(8761000000000238),
  "grove:econ_merls_vault_inventory:objective:3": id(8761000000000239),
  "grove:econ_gus_fresh_loaves_to_fountain:root": id(8761000000000240),
  "grove:econ_gus_fresh_loaves_to_fountain:objective:0": id(8761000000000241),
  "grove:econ_gus_fresh_loaves_to_fountain:objective:1": id(8761000000000242),
  "grove:econ_gus_fresh_loaves_to_fountain:objective:2": id(8761000000000243),
  "grove:econ_gus_fresh_loaves_to_fountain:objective:3": id(8761000000000244),
  "grove:econ_gus_grain_run:root": id(8761000000000245),
  "grove:econ_gus_grain_run:objective:0": id(8761000000000246),
  "grove:econ_gus_grain_run:objective:1": id(8761000000000247),
  "grove:econ_gus_grain_run:objective:2": id(8761000000000248),
  "grove:econ_gus_grain_run:objective:3": id(8761000000000249),
  "grove:econ_fern_water_the_sprout_beds:root": id(8761000000000250),
  "grove:econ_fern_water_the_sprout_beds:objective:0": id(8761000000000251),
  "grove:econ_fern_water_the_sprout_beds:objective:1": id(8761000000000252),
  "grove:econ_fern_water_the_sprout_beds:objective:2": id(8761000000000253),
  "grove:econ_fern_water_the_sprout_beds:objective:3": id(8761000000000254),
  "grove:econ_fern_berry_patch_harvest:root": id(8761000000000255),
  "grove:econ_fern_berry_patch_harvest:objective:0": id(8761000000000256),
  "grove:econ_fern_berry_patch_harvest:objective:1": id(8761000000000257),
  "grove:econ_fern_berry_patch_harvest:objective:2": id(8761000000000258),
  "grove:econ_fern_berry_patch_harvest:objective:3": id(8761000000000259),
  "grove:econ_kit_letters_around_fountain:root": id(8761000000000260),
  "grove:econ_kit_letters_around_fountain:objective:0": id(8761000000000261),
  "grove:econ_kit_letters_around_fountain:objective:1": id(8761000000000262),
  "grove:econ_kit_letters_around_fountain:objective:2": id(8761000000000263),
  "grove:econ_kit_letters_around_fountain:objective:3": id(8761000000000264),
  "grove:econ_kit_letters_around_fountain:objective:4": id(8761000000000265),
  "grove:econ_kit_heavy_parcel_to_crossroads:root": id(8761000000000266),
  "grove:econ_kit_heavy_parcel_to_crossroads:objective:0": id(8761000000000267),
  "grove:econ_kit_heavy_parcel_to_crossroads:objective:1": id(8761000000000268),
  "grove:econ_kit_heavy_parcel_to_crossroads:objective:2": id(8761000000000269),
  "grove:econ_kit_heavy_parcel_to_crossroads:objective:3": id(8761000000000270),
  "grove:econ_kit_heavy_parcel_to_crossroads:objective:4": id(8761000000000271),
  "grove:econ_mel_bench_repair:root": id(8761000000000272),
  "grove:econ_mel_bench_repair:objective:0": id(8761000000000273),
  "grove:econ_mel_bench_repair:objective:1": id(8761000000000274),
  "grove:econ_mel_bench_repair:objective:2": id(8761000000000275),
  "grove:econ_mel_bench_repair:objective:3": id(8761000000000276),
  "grove:econ_mel_broken_hinge_hunt:root": id(8761000000000277),
  "grove:econ_mel_broken_hinge_hunt:objective:0": id(8761000000000278),
  "grove:econ_mel_broken_hinge_hunt:objective:1": id(8761000000000279),
  "grove:econ_mel_broken_hinge_hunt:objective:2": id(8761000000000280),
  "grove:econ_mel_broken_hinge_hunt:objective:3": id(8761000000000281),
  "grove:econ_mel_broken_hinge_hunt:objective:4": id(8761000000000282),
  "grove:econ_rin_mushroom_pickup:root": id(8761000000000283),
  "grove:econ_rin_mushroom_pickup:objective:0": id(8761000000000284),
  "grove:econ_rin_mushroom_pickup:objective:1": id(8761000000000285),
  "grove:econ_rin_mushroom_pickup:objective:2": id(8761000000000286),
  "grove:econ_rin_mushroom_pickup:objective:3": id(8761000000000287),
  "grove:econ_carlo_festival_skewers:root": id(8761000000000288),
  "grove:econ_carlo_festival_skewers:objective:0": id(8761000000000289),
  "grove:econ_carlo_festival_skewers:objective:1": id(8761000000000290),
  "grove:econ_carlo_festival_skewers:objective:2": id(8761000000000291),
  "grove:econ_carlo_festival_skewers:objective:3": id(8761000000000292),
  "grove:econ_carlo_festival_skewers:objective:4": id(8761000000000293),
  // Required completion conversations added without renumbering any shipped
  // native challenge or Bible step id.
  "grove:read-the-jobs-board:objective:1": id(8761000000090001),
  "grove:color_that_still_points_home:objective:4": id(8761000000090002),
  "grove:cart_that_forgot_its_wheel:objective:4": id(8761000000090003),
  "grove:road_ready_not_fancy:objective:4": id(8761000000090004),
  "grove:moss_that_went_quiet:objective:4": id(8761000000090005),
  "grove:songline_under_the_lawn:objective:4": id(8761000000090006),
  "grove:sticky_medicine:objective:4": id(8761000000090007),
  "grove:coops_key_hen:objective:4": id(8761000000090008),
  "grove:tower_with_a_headache:objective:4": id(8761000000090009),
  "grove:antlers_for_the_watch:objective:4": id(8761000000090010),
  "grove:toll_ledger_problem:objective:4": id(8761000000090011),
  "grove:samples_for_the_chapel:objective:4": id(8761000000090012),
  "grove:tone_beneath_the_road:objective:4": id(8761000000090013),
  "bible:bellbound_q01_cracks_in_bridge:root": id(8761000000000294),
  "bible:bellbound_q01_cracks_in_bridge:objective:bellbound_q01_cracks_in_bridge_obj_01":
    id(8761000000000295),
  "bible:bellbound_q01_cracks_in_bridge:objective:bellbound_q01_cracks_in_bridge_obj_02":
    id(8761000000000296),
  "bible:bellbound_q01_cracks_in_bridge:objective:bellbound_q01_cracks_in_bridge_obj_03":
    id(8761000000000297),
  "bible:bellbound_q01_cracks_in_bridge:objective:bellbound_q01_cracks_in_bridge_obj_04":
    id(8761000000000298),
  "bible:bellbound_q02_whispers_at_well:root": id(8761000000000299),
  "bible:bellbound_q02_whispers_at_well:objective:bellbound_q02_whispers_at_well_obj_01":
    id(8761000000000300),
  "bible:bellbound_q02_whispers_at_well:objective:bellbound_q02_whispers_at_well_obj_02":
    id(8761000000000301),
  "bible:bellbound_q02_whispers_at_well:objective:bellbound_q02_whispers_at_well_obj_03":
    id(8761000000000302),
  "bible:bellbound_q02_whispers_at_well:objective:bellbound_q02_whispers_at_well_obj_04":
    id(8761000000000303),
  "bible:bellbound_q02_whispers_at_well:unlock:root": id(8761000000000304),
  "bible:bellbound_q02_whispers_at_well:unlock:bellbound_q01_cracks_in_bridge":
    id(8761000000000305),
  "bible:bellbound_q02_5_rat_girl_knows:root": id(8761000000000306),
  "bible:bellbound_q02_5_rat_girl_knows:objective:bellbound_q02_5_rat_girl_knows_obj_01":
    id(8761000000000307),
  "bible:bellbound_q02_5_rat_girl_knows:objective:bellbound_q02_5_rat_girl_knows_obj_02":
    id(8761000000000308),
  "bible:bellbound_q02_5_rat_girl_knows:objective:bellbound_q02_5_rat_girl_knows_obj_03":
    id(8761000000000309),
  "bible:bellbound_q02_5_rat_girl_knows:objective:bellbound_q02_5_rat_girl_knows_obj_04":
    id(8761000000000310),
  "bible:bellbound_q02_5_rat_girl_knows:unlock:root": id(8761000000000311),
  "bible:bellbound_q02_5_rat_girl_knows:unlock:bellbound_q02_whispers_at_well":
    id(8761000000000312),
  "bible:bellbound_q03_dreams_of_drowning:root": id(8761000000000313),
  "bible:bellbound_q03_dreams_of_drowning:objective:bellbound_q03_dreams_of_drowning_obj_01":
    id(8761000000000314),
  "bible:bellbound_q03_dreams_of_drowning:objective:bellbound_q03_dreams_of_drowning_obj_02":
    id(8761000000000315),
  "bible:bellbound_q03_dreams_of_drowning:objective:bellbound_q03_dreams_of_drowning_obj_03":
    id(8761000000000316),
  "bible:bellbound_q03_dreams_of_drowning:objective:bellbound_q03_dreams_of_drowning_obj_04":
    id(8761000000000317),
  "bible:bellbound_q03_dreams_of_drowning:unlock:root": id(8761000000000318),
  "bible:bellbound_q03_dreams_of_drowning:unlock:bellbound_q02_whispers_at_well":
    id(8761000000000319),
  "bible:bellbound_q04_sisters_letters:root": id(8761000000000320),
  "bible:bellbound_q04_sisters_letters:objective:bellbound_q04_sisters_letters_obj_01":
    id(8761000000000321),
  "bible:bellbound_q04_sisters_letters:objective:bellbound_q04_sisters_letters_obj_02":
    id(8761000000000322),
  "bible:bellbound_q04_sisters_letters:objective:bellbound_q04_sisters_letters_obj_03":
    id(8761000000000323),
  "bible:bellbound_q04_sisters_letters:objective:bellbound_q04_sisters_letters_obj_04":
    id(8761000000000324),
  "bible:bellbound_q04_sisters_letters:unlock:root": id(8761000000000325),
  "bible:bellbound_q04_sisters_letters:unlock:bellbound_q03_dreams_of_drowning":
    id(8761000000000326),
  "bible:bellbound_q05_beneath_the_stones:root": id(8761000000000327),
  "bible:bellbound_q05_beneath_the_stones:objective:bellbound_q05_beneath_the_stones_obj_01":
    id(8761000000000328),
  "bible:bellbound_q05_beneath_the_stones:objective:bellbound_q05_beneath_the_stones_obj_02":
    id(8761000000000329),
  "bible:bellbound_q05_beneath_the_stones:objective:bellbound_q05_beneath_the_stones_obj_03":
    id(8761000000000330),
  "bible:bellbound_q05_beneath_the_stones:objective:bellbound_q05_beneath_the_stones_obj_04":
    id(8761000000000331),
  "bible:bellbound_q05_beneath_the_stones:unlock:root": id(8761000000000332),
  "bible:bellbound_q05_beneath_the_stones:unlock:bellbound_q04_sisters_letters":
    id(8761000000000333),
  "bible:bellbound_q06_hidden_door:root": id(8761000000000334),
  "bible:bellbound_q06_hidden_door:objective:bellbound_q06_hidden_door_obj_01":
    id(8761000000000335),
  "bible:bellbound_q06_hidden_door:objective:bellbound_q06_hidden_door_obj_02":
    id(8761000000000336),
  "bible:bellbound_q06_hidden_door:objective:bellbound_q06_hidden_door_obj_03":
    id(8761000000000337),
  "bible:bellbound_q06_hidden_door:objective:bellbound_q06_hidden_door_obj_04":
    id(8761000000000338),
  "bible:bellbound_q06_hidden_door:unlock:root": id(8761000000000339),
  "bible:bellbound_q06_hidden_door:unlock:bellbound_q05_beneath_the_stones":
    id(8761000000000340),
  "bible:bellbound_q07_bellward_halls:root": id(8761000000000341),
  "bible:bellbound_q07_bellward_halls:objective:bellbound_q07_bellward_halls_obj_01":
    id(8761000000000342),
  "bible:bellbound_q07_bellward_halls:objective:bellbound_q07_bellward_halls_obj_02":
    id(8761000000000343),
  "bible:bellbound_q07_bellward_halls:objective:bellbound_q07_bellward_halls_obj_03":
    id(8761000000000344),
  "bible:bellbound_q07_bellward_halls:objective:bellbound_q07_bellward_halls_obj_04":
    id(8761000000000345),
  "bible:bellbound_q07_bellward_halls:unlock:root": id(8761000000000346),
  "bible:bellbound_q07_bellward_halls:unlock:bellbound_q06_hidden_door":
    id(8761000000000347),
  "bible:bellbound_q08_voices_in_stone:root": id(8761000000000348),
  "bible:bellbound_q08_voices_in_stone:objective:bellbound_q08_voices_in_stone_obj_01":
    id(8761000000000349),
  "bible:bellbound_q08_voices_in_stone:objective:bellbound_q08_voices_in_stone_obj_02":
    id(8761000000000350),
  "bible:bellbound_q08_voices_in_stone:objective:bellbound_q08_voices_in_stone_obj_03":
    id(8761000000000351),
  "bible:bellbound_q08_voices_in_stone:objective:bellbound_q08_voices_in_stone_obj_04":
    id(8761000000000352),
  "bible:bellbound_q08_voices_in_stone:unlock:root": id(8761000000000353),
  "bible:bellbound_q08_voices_in_stone:unlock:bellbound_q07_bellward_halls":
    id(8761000000000354),
  "bible:bellbound_q09_veins_of_wyrm:root": id(8761000000000355),
  "bible:bellbound_q09_veins_of_wyrm:objective:bellbound_q09_veins_of_wyrm_obj_01":
    id(8761000000000356),
  "bible:bellbound_q09_veins_of_wyrm:objective:bellbound_q09_veins_of_wyrm_obj_02":
    id(8761000000000357),
  "bible:bellbound_q09_veins_of_wyrm:objective:bellbound_q09_veins_of_wyrm_obj_03":
    id(8761000000000358),
  "bible:bellbound_q09_veins_of_wyrm:objective:bellbound_q09_veins_of_wyrm_obj_04":
    id(8761000000000359),
  "bible:bellbound_q09_veins_of_wyrm:unlock:root": id(8761000000000360),
  "bible:bellbound_q09_veins_of_wyrm:unlock:bellbound_q08_voices_in_stone":
    id(8761000000000361),
  "bible:bellbound_q10_bellbinders_tomb:root": id(8761000000000362),
  "bible:bellbound_q10_bellbinders_tomb:objective:bellbound_q10_bellbinders_tomb_obj_01":
    id(8761000000000363),
  "bible:bellbound_q10_bellbinders_tomb:objective:bellbound_q10_bellbinders_tomb_obj_02":
    id(8761000000000364),
  "bible:bellbound_q10_bellbinders_tomb:objective:bellbound_q10_bellbinders_tomb_obj_03":
    id(8761000000000365),
  "bible:bellbound_q10_bellbinders_tomb:objective:bellbound_q10_bellbinders_tomb_obj_04":
    id(8761000000000366),
  "bible:bellbound_q10_bellbinders_tomb:unlock:root": id(8761000000000367),
  "bible:bellbound_q10_bellbinders_tomb:unlock:bellbound_q09_veins_of_wyrm":
    id(8761000000000368),
  "bible:bellbound_q11_last_ringing:root": id(8761000000000369),
  "bible:bellbound_q11_last_ringing:objective:bellbound_q11_last_ringing_obj_01":
    id(8761000000000370),
  "bible:bellbound_q11_last_ringing:objective:bellbound_q11_last_ringing_obj_02":
    id(8761000000000371),
  "bible:bellbound_q11_last_ringing:objective:bellbound_q11_last_ringing_obj_03":
    id(8761000000000372),
  "bible:bellbound_q11_last_ringing:objective:bellbound_q11_last_ringing_obj_04":
    id(8761000000000373),
  "bible:bellbound_q11_last_ringing:unlock:root": id(8761000000000374),
  "bible:bellbound_q11_last_ringing:unlock:bellbound_q10_bellbinders_tomb":
    id(8761000000000375),
  "bible:bellbound_q12_thaedryn_bellbound:root": id(8761000000000376),
  "bible:bellbound_q12_thaedryn_bellbound:objective:bellbound_q12_thaedryn_bellbound_obj_01":
    id(8761000000000377),
  "bible:bellbound_q12_thaedryn_bellbound:objective:bellbound_q12_thaedryn_bellbound_obj_02":
    id(8761000000000378),
  "bible:bellbound_q12_thaedryn_bellbound:objective:bellbound_q12_thaedryn_bellbound_obj_03":
    id(8761000000000379),
  "bible:bellbound_q12_thaedryn_bellbound:objective:bellbound_q12_thaedryn_bellbound_obj_04":
    id(8761000000000380),
  "bible:bellbound_q12_thaedryn_bellbound:unlock:root": id(8761000000000381),
  "bible:bellbound_q12_thaedryn_bellbound:unlock:bellbound_q11_last_ringing":
    id(8761000000000382),
  "bible:harthmere_sq_001_the_gate_ledger:root": id(8761000000000383),
  "bible:harthmere_sq_001_the_gate_ledger:objective:harthmere_sq_001_the_gate_ledger_obj_01":
    id(8761000000000384),
  "bible:harthmere_sq_001_the_gate_ledger:objective:harthmere_sq_001_the_gate_ledger_obj_02":
    id(8761000000000385),
  "bible:harthmere_sq_001_the_gate_ledger:objective:harthmere_sq_001_the_gate_ledger_obj_03":
    id(8761000000000386),
  "bible:harthmere_sq_001_the_gate_ledger:objective:harthmere_sq_001_the_gate_ledger_obj_04":
    id(8761000000000387),
  "bible:harthmere_sq_002_the_viddas_daughter:root": id(8761000000000388),
  "bible:harthmere_sq_002_the_viddas_daughter:objective:harthmere_sq_002_the_viddas_daughter_obj_01":
    id(8761000000000389),
  "bible:harthmere_sq_002_the_viddas_daughter:objective:harthmere_sq_002_the_viddas_daughter_obj_02":
    id(8761000000000390),
  "bible:harthmere_sq_002_the_viddas_daughter:objective:harthmere_sq_002_the_viddas_daughter_obj_03":
    id(8761000000000391),
  "bible:harthmere_sq_002_the_viddas_daughter:objective:harthmere_sq_002_the_viddas_daughter_obj_04":
    id(8761000000000392),
  "bible:harthmere_sq_003_strangers_at_the_gate:root": id(8761000000000393),
  "bible:harthmere_sq_003_strangers_at_the_gate:objective:harthmere_sq_003_strangers_at_the_gate_obj_01":
    id(8761000000000394),
  "bible:harthmere_sq_003_strangers_at_the_gate:objective:harthmere_sq_003_strangers_at_the_gate_obj_02":
    id(8761000000000395),
  "bible:harthmere_sq_003_strangers_at_the_gate:objective:harthmere_sq_003_strangers_at_the_gate_obj_03":
    id(8761000000000396),
  "bible:harthmere_sq_003_strangers_at_the_gate:objective:harthmere_sq_003_strangers_at_the_gate_obj_04":
    id(8761000000000397),
  "bible:harthmere_sq_004_the_drill_that_wouldnt_end:root":
    id(8761000000000398),
  "bible:harthmere_sq_004_the_drill_that_wouldnt_end:objective:harthmere_sq_004_the_drill_that_wouldnt_end_obj_01":
    id(8761000000000399),
  "bible:harthmere_sq_004_the_drill_that_wouldnt_end:objective:harthmere_sq_004_the_drill_that_wouldnt_end_obj_02":
    id(8761000000000400),
  "bible:harthmere_sq_004_the_drill_that_wouldnt_end:objective:harthmere_sq_004_the_drill_that_wouldnt_end_obj_03":
    id(8761000000000401),
  "bible:harthmere_sq_004_the_drill_that_wouldnt_end:objective:harthmere_sq_004_the_drill_that_wouldnt_end_obj_04":
    id(8761000000000402),
  "bible:harthmere_sq_005_patrol_route_seven:root": id(8761000000000403),
  "bible:harthmere_sq_005_patrol_route_seven:objective:harthmere_sq_005_patrol_route_seven_obj_01":
    id(8761000000000404),
  "bible:harthmere_sq_005_patrol_route_seven:objective:harthmere_sq_005_patrol_route_seven_obj_02":
    id(8761000000000405),
  "bible:harthmere_sq_005_patrol_route_seven:objective:harthmere_sq_005_patrol_route_seven_obj_03":
    id(8761000000000406),
  "bible:harthmere_sq_005_patrol_route_seven:objective:harthmere_sq_005_patrol_route_seven_obj_04":
    id(8761000000000407),
  "bible:harthmere_sq_006_tessens_choice:root": id(8761000000000408),
  "bible:harthmere_sq_006_tessens_choice:objective:harthmere_sq_006_tessens_choice_obj_01":
    id(8761000000000409),
  "bible:harthmere_sq_006_tessens_choice:objective:harthmere_sq_006_tessens_choice_obj_02":
    id(8761000000000410),
  "bible:harthmere_sq_006_tessens_choice:objective:harthmere_sq_006_tessens_choice_obj_03":
    id(8761000000000411),
  "bible:harthmere_sq_006_tessens_choice:objective:harthmere_sq_006_tessens_choice_obj_04":
    id(8761000000000412),
  "bible:harthmere_sq_006_tessens_choice:unlock:root": id(8761000000000413),
  "bible:harthmere_sq_006_tessens_choice:unlock:harthmere_sq_001_the_gate_ledger":
    id(8761000000000414),
  "bible:harthmere_sq_007_the_crooked_scales:root": id(8761000000000415),
  "bible:harthmere_sq_007_the_crooked_scales:objective:harthmere_sq_007_the_crooked_scales_obj_01":
    id(8761000000000416),
  "bible:harthmere_sq_007_the_crooked_scales:objective:harthmere_sq_007_the_crooked_scales_obj_02":
    id(8761000000000417),
  "bible:harthmere_sq_007_the_crooked_scales:objective:harthmere_sq_007_the_crooked_scales_obj_03":
    id(8761000000000418),
  "bible:harthmere_sq_007_the_crooked_scales:objective:harthmere_sq_007_the_crooked_scales_obj_04":
    id(8761000000000419),
  "bible:harthmere_sq_008_a_friend_of_brees:root": id(8761000000000420),
  "bible:harthmere_sq_008_a_friend_of_brees:objective:harthmere_sq_008_a_friend_of_brees_obj_01":
    id(8761000000000421),
  "bible:harthmere_sq_008_a_friend_of_brees:objective:harthmere_sq_008_a_friend_of_brees_obj_02":
    id(8761000000000422),
  "bible:harthmere_sq_008_a_friend_of_brees:objective:harthmere_sq_008_a_friend_of_brees_obj_03":
    id(8761000000000423),
  "bible:harthmere_sq_008_a_friend_of_brees:objective:harthmere_sq_008_a_friend_of_brees_obj_04":
    id(8761000000000424),
  "bible:harthmere_sq_009_the_hoarder:root": id(8761000000000425),
  "bible:harthmere_sq_009_the_hoarder:objective:harthmere_sq_009_the_hoarder_obj_01":
    id(8761000000000426),
  "bible:harthmere_sq_009_the_hoarder:objective:harthmere_sq_009_the_hoarder_obj_02":
    id(8761000000000427),
  "bible:harthmere_sq_009_the_hoarder:objective:harthmere_sq_009_the_hoarder_obj_03":
    id(8761000000000428),
  "bible:harthmere_sq_009_the_hoarder:objective:harthmere_sq_009_the_hoarder_obj_04":
    id(8761000000000429),
  "bible:harthmere_sq_010_three_casks_short:root": id(8761000000000430),
  "bible:harthmere_sq_010_three_casks_short:objective:harthmere_sq_010_three_casks_short_obj_01":
    id(8761000000000431),
  "bible:harthmere_sq_010_three_casks_short:objective:harthmere_sq_010_three_casks_short_obj_02":
    id(8761000000000432),
  "bible:harthmere_sq_010_three_casks_short:objective:harthmere_sq_010_three_casks_short_obj_03":
    id(8761000000000433),
  "bible:harthmere_sq_010_three_casks_short:objective:harthmere_sq_010_three_casks_short_obj_04":
    id(8761000000000434),
  "bible:harthmere_sq_011_the_locked_room:root": id(8761000000000435),
  "bible:harthmere_sq_011_the_locked_room:objective:harthmere_sq_011_the_locked_room_obj_01":
    id(8761000000000436),
  "bible:harthmere_sq_011_the_locked_room:objective:harthmere_sq_011_the_locked_room_obj_02":
    id(8761000000000437),
  "bible:harthmere_sq_011_the_locked_room:objective:harthmere_sq_011_the_locked_room_obj_03":
    id(8761000000000438),
  "bible:harthmere_sq_011_the_locked_room:objective:harthmere_sq_011_the_locked_room_obj_04":
    id(8761000000000439),
  "bible:harthmere_sq_012_bard_night:root": id(8761000000000440),
  "bible:harthmere_sq_012_bard_night:objective:harthmere_sq_012_bard_night_obj_01":
    id(8761000000000441),
  "bible:harthmere_sq_012_bard_night:objective:harthmere_sq_012_bard_night_obj_02":
    id(8761000000000442),
  "bible:harthmere_sq_012_bard_night:objective:harthmere_sq_012_bard_night_obj_03":
    id(8761000000000443),
  "bible:harthmere_sq_012_bard_night:objective:harthmere_sq_012_bard_night_obj_04":
    id(8761000000000444),
  "bible:harthmere_sq_013_the_apprentices_burn:root": id(8761000000000445),
  "bible:harthmere_sq_013_the_apprentices_burn:objective:harthmere_sq_013_the_apprentices_burn_obj_01":
    id(8761000000000446),
  "bible:harthmere_sq_013_the_apprentices_burn:objective:harthmere_sq_013_the_apprentices_burn_obj_02":
    id(8761000000000447),
  "bible:harthmere_sq_013_the_apprentices_burn:objective:harthmere_sq_013_the_apprentices_burn_obj_03":
    id(8761000000000448),
  "bible:harthmere_sq_013_the_apprentices_burn:objective:harthmere_sq_013_the_apprentices_burn_obj_04":
    id(8761000000000449),
  "bible:harthmere_sq_014_the_rebels_blade:root": id(8761000000000450),
  "bible:harthmere_sq_014_the_rebels_blade:objective:harthmere_sq_014_the_rebels_blade_obj_01":
    id(8761000000000451),
  "bible:harthmere_sq_014_the_rebels_blade:objective:harthmere_sq_014_the_rebels_blade_obj_02":
    id(8761000000000452),
  "bible:harthmere_sq_014_the_rebels_blade:objective:harthmere_sq_014_the_rebels_blade_obj_03":
    id(8761000000000453),
  "bible:harthmere_sq_014_the_rebels_blade:objective:harthmere_sq_014_the_rebels_blade_obj_04":
    id(8761000000000454),
  "bible:harthmere_sq_015_the_masters_mark:root": id(8761000000000455),
  "bible:harthmere_sq_015_the_masters_mark:objective:harthmere_sq_015_the_masters_mark_obj_01":
    id(8761000000000456),
  "bible:harthmere_sq_015_the_masters_mark:objective:harthmere_sq_015_the_masters_mark_obj_02":
    id(8761000000000457),
  "bible:harthmere_sq_015_the_masters_mark:objective:harthmere_sq_015_the_masters_mark_obj_03":
    id(8761000000000458),
  "bible:harthmere_sq_015_the_masters_mark:objective:harthmere_sq_015_the_masters_mark_obj_04":
    id(8761000000000459),
  "bible:harthmere_sq_016_candles_for_the_forgotten:root": id(8761000000000460),
  "bible:harthmere_sq_016_candles_for_the_forgotten:objective:harthmere_sq_016_candles_for_the_forgotten_obj_01":
    id(8761000000000461),
  "bible:harthmere_sq_016_candles_for_the_forgotten:objective:harthmere_sq_016_candles_for_the_forgotten_obj_02":
    id(8761000000000462),
  "bible:harthmere_sq_016_candles_for_the_forgotten:objective:harthmere_sq_016_candles_for_the_forgotten_obj_03":
    id(8761000000000463),
  "bible:harthmere_sq_016_candles_for_the_forgotten:objective:harthmere_sq_016_candles_for_the_forgotten_obj_04":
    id(8761000000000464),
  "bible:harthmere_sq_017_sister_maelles_concern:root": id(8761000000000465),
  "bible:harthmere_sq_017_sister_maelles_concern:objective:harthmere_sq_017_sister_maelles_concern_obj_01":
    id(8761000000000466),
  "bible:harthmere_sq_017_sister_maelles_concern:objective:harthmere_sq_017_sister_maelles_concern_obj_02":
    id(8761000000000467),
  "bible:harthmere_sq_017_sister_maelles_concern:objective:harthmere_sq_017_sister_maelles_concern_obj_03":
    id(8761000000000468),
  "bible:harthmere_sq_017_sister_maelles_concern:objective:harthmere_sq_017_sister_maelles_concern_obj_04":
    id(8761000000000469),
  "bible:harthmere_sq_018_the_boy_who_saw_the_bell:root": id(8761000000000470),
  "bible:harthmere_sq_018_the_boy_who_saw_the_bell:objective:harthmere_sq_018_the_boy_who_saw_the_bell_obj_01":
    id(8761000000000471),
  "bible:harthmere_sq_018_the_boy_who_saw_the_bell:objective:harthmere_sq_018_the_boy_who_saw_the_bell_obj_02":
    id(8761000000000472),
  "bible:harthmere_sq_018_the_boy_who_saw_the_bell:objective:harthmere_sq_018_the_boy_who_saw_the_bell_obj_03":
    id(8761000000000473),
  "bible:harthmere_sq_018_the_boy_who_saw_the_bell:objective:harthmere_sq_018_the_boy_who_saw_the_bell_obj_04":
    id(8761000000000474),
  "bible:harthmere_sq_019_the_diplomats_dinner:root": id(8761000000000475),
  "bible:harthmere_sq_019_the_diplomats_dinner:objective:harthmere_sq_019_the_diplomats_dinner_obj_01":
    id(8761000000000476),
  "bible:harthmere_sq_019_the_diplomats_dinner:objective:harthmere_sq_019_the_diplomats_dinner_obj_02":
    id(8761000000000477),
  "bible:harthmere_sq_019_the_diplomats_dinner:objective:harthmere_sq_019_the_diplomats_dinner_obj_03":
    id(8761000000000478),
  "bible:harthmere_sq_019_the_diplomats_dinner:objective:harthmere_sq_019_the_diplomats_dinner_obj_04":
    id(8761000000000479),
  "bible:harthmere_sq_020_the_audit:root": id(8761000000000480),
  "bible:harthmere_sq_020_the_audit:objective:harthmere_sq_020_the_audit_obj_01":
    id(8761000000000481),
  "bible:harthmere_sq_020_the_audit:objective:harthmere_sq_020_the_audit_obj_02":
    id(8761000000000482),
  "bible:harthmere_sq_020_the_audit:objective:harthmere_sq_020_the_audit_obj_03":
    id(8761000000000483),
  "bible:harthmere_sq_020_the_audit:objective:harthmere_sq_020_the_audit_obj_04":
    id(8761000000000484),
  "bible:harthmere_sq_021_the_daughters_secret:root": id(8761000000000485),
  "bible:harthmere_sq_021_the_daughters_secret:objective:harthmere_sq_021_the_daughters_secret_obj_01":
    id(8761000000000486),
  "bible:harthmere_sq_021_the_daughters_secret:objective:harthmere_sq_021_the_daughters_secret_obj_02":
    id(8761000000000487),
  "bible:harthmere_sq_021_the_daughters_secret:objective:harthmere_sq_021_the_daughters_secret_obj_03":
    id(8761000000000488),
  "bible:harthmere_sq_021_the_daughters_secret:objective:harthmere_sq_021_the_daughters_secret_obj_04":
    id(8761000000000489),
  "bible:harthmere_sq_022_the_wrong_antidote:root": id(8761000000000490),
  "bible:harthmere_sq_022_the_wrong_antidote:objective:harthmere_sq_022_the_wrong_antidote_obj_01":
    id(8761000000000491),
  "bible:harthmere_sq_022_the_wrong_antidote:objective:harthmere_sq_022_the_wrong_antidote_obj_02":
    id(8761000000000492),
  "bible:harthmere_sq_022_the_wrong_antidote:objective:harthmere_sq_022_the_wrong_antidote_obj_03":
    id(8761000000000493),
  "bible:harthmere_sq_022_the_wrong_antidote:objective:harthmere_sq_022_the_wrong_antidote_obj_04":
    id(8761000000000494),
  "bible:harthmere_sq_023_the_garden_in_the_glade:root": id(8761000000000495),
  "bible:harthmere_sq_023_the_garden_in_the_glade:objective:harthmere_sq_023_the_garden_in_the_glade_obj_01":
    id(8761000000000496),
  "bible:harthmere_sq_023_the_garden_in_the_glade:objective:harthmere_sq_023_the_garden_in_the_glade_obj_02":
    id(8761000000000497),
  "bible:harthmere_sq_023_the_garden_in_the_glade:objective:harthmere_sq_023_the_garden_in_the_glade_obj_03":
    id(8761000000000498),
  "bible:harthmere_sq_023_the_garden_in_the_glade:objective:harthmere_sq_023_the_garden_in_the_glade_obj_04":
    id(8761000000000499),
  "bible:harthmere_sq_024_the_accusation:root": id(8761000000000500),
  "bible:harthmere_sq_024_the_accusation:objective:harthmere_sq_024_the_accusation_obj_01":
    id(8761000000000501),
  "bible:harthmere_sq_024_the_accusation:objective:harthmere_sq_024_the_accusation_obj_02":
    id(8761000000000502),
  "bible:harthmere_sq_024_the_accusation:objective:harthmere_sq_024_the_accusation_obj_03":
    id(8761000000000503),
  "bible:harthmere_sq_024_the_accusation:objective:harthmere_sq_024_the_accusation_obj_04":
    id(8761000000000504),
  "bible:harthmere_sq_025_the_manifest:root": id(8761000000000505),
  "bible:harthmere_sq_025_the_manifest:objective:harthmere_sq_025_the_manifest_obj_01":
    id(8761000000000506),
  "bible:harthmere_sq_025_the_manifest:objective:harthmere_sq_025_the_manifest_obj_02":
    id(8761000000000507),
  "bible:harthmere_sq_025_the_manifest:objective:harthmere_sq_025_the_manifest_obj_03":
    id(8761000000000508),
  "bible:harthmere_sq_025_the_manifest:objective:harthmere_sq_025_the_manifest_obj_04":
    id(8761000000000509),
  "bible:harthmere_sq_026_the_whispering_crate:root": id(8761000000000510),
  "bible:harthmere_sq_026_the_whispering_crate:objective:harthmere_sq_026_the_whispering_crate_obj_01":
    id(8761000000000511),
  "bible:harthmere_sq_026_the_whispering_crate:objective:harthmere_sq_026_the_whispering_crate_obj_02":
    id(8761000000000512),
  "bible:harthmere_sq_026_the_whispering_crate:objective:harthmere_sq_026_the_whispering_crate_obj_03":
    id(8761000000000513),
  "bible:harthmere_sq_026_the_whispering_crate:objective:harthmere_sq_026_the_whispering_crate_obj_04":
    id(8761000000000514),
  "bible:harthmere_sq_027_linas_promise:root": id(8761000000000515),
  "bible:harthmere_sq_027_linas_promise:objective:harthmere_sq_027_linas_promise_obj_01":
    id(8761000000000516),
  "bible:harthmere_sq_027_linas_promise:objective:harthmere_sq_027_linas_promise_obj_02":
    id(8761000000000517),
  "bible:harthmere_sq_027_linas_promise:objective:harthmere_sq_027_linas_promise_obj_03":
    id(8761000000000518),
  "bible:harthmere_sq_027_linas_promise:objective:harthmere_sq_027_linas_promise_obj_04":
    id(8761000000000519),
  "bible:harthmere_sq_028_rats_with_crowns:root": id(8761000000000520),
  "bible:harthmere_sq_028_rats_with_crowns:objective:harthmere_sq_028_rats_with_crowns_obj_01":
    id(8761000000000521),
  "bible:harthmere_sq_028_rats_with_crowns:objective:harthmere_sq_028_rats_with_crowns_obj_02":
    id(8761000000000522),
  "bible:harthmere_sq_028_rats_with_crowns:objective:harthmere_sq_028_rats_with_crowns_obj_03":
    id(8761000000000523),
  "bible:harthmere_sq_028_rats_with_crowns:objective:harthmere_sq_028_rats_with_crowns_obj_04":
    id(8761000000000524),
  "bible:harthmere_sq_029_the_missing_ones:root": id(8761000000000525),
  "bible:harthmere_sq_029_the_missing_ones:objective:harthmere_sq_029_the_missing_ones_obj_01":
    id(8761000000000526),
  "bible:harthmere_sq_029_the_missing_ones:objective:harthmere_sq_029_the_missing_ones_obj_02":
    id(8761000000000527),
  "bible:harthmere_sq_029_the_missing_ones:objective:harthmere_sq_029_the_missing_ones_obj_03":
    id(8761000000000528),
  "bible:harthmere_sq_029_the_missing_ones:objective:harthmere_sq_029_the_missing_ones_obj_04":
    id(8761000000000529),
  "bible:harthmere_sq_030_the_eviction:root": id(8761000000000530),
  "bible:harthmere_sq_030_the_eviction:objective:harthmere_sq_030_the_eviction_obj_01":
    id(8761000000000531),
  "bible:harthmere_sq_030_the_eviction:objective:harthmere_sq_030_the_eviction_obj_02":
    id(8761000000000532),
  "bible:harthmere_sq_030_the_eviction:objective:harthmere_sq_030_the_eviction_obj_03":
    id(8761000000000533),
  "bible:harthmere_sq_030_the_eviction:objective:harthmere_sq_030_the_eviction_obj_04":
    id(8761000000000534),
  "bible:harthmere_sq_031_the_last_letter:root": id(8761000000000535),
  "bible:harthmere_sq_031_the_last_letter:objective:harthmere_sq_031_the_last_letter_obj_01":
    id(8761000000000536),
  "bible:harthmere_sq_031_the_last_letter:objective:harthmere_sq_031_the_last_letter_obj_02":
    id(8761000000000537),
  "bible:harthmere_sq_031_the_last_letter:objective:harthmere_sq_031_the_last_letter_obj_03":
    id(8761000000000538),
  "bible:harthmere_sq_031_the_last_letter:objective:harthmere_sq_031_the_last_letter_obj_04":
    id(8761000000000539),
  "bible:harthmere_sq_032_the_marsh_guides_burden:root": id(8761000000000540),
  "bible:harthmere_sq_032_the_marsh_guides_burden:objective:harthmere_sq_032_the_marsh_guides_burden_obj_01":
    id(8761000000000541),
  "bible:harthmere_sq_032_the_marsh_guides_burden:objective:harthmere_sq_032_the_marsh_guides_burden_obj_02":
    id(8761000000000542),
  "bible:harthmere_sq_032_the_marsh_guides_burden:objective:harthmere_sq_032_the_marsh_guides_burden_obj_03":
    id(8761000000000543),
  "bible:harthmere_sq_032_the_marsh_guides_burden:objective:harthmere_sq_032_the_marsh_guides_burden_obj_04":
    id(8761000000000544),
  "bible:harthmere_sq_033_the_old_hunters_debt:root": id(8761000000000545),
  "bible:harthmere_sq_033_the_old_hunters_debt:objective:harthmere_sq_033_the_old_hunters_debt_obj_01":
    id(8761000000000546),
  "bible:harthmere_sq_033_the_old_hunters_debt:objective:harthmere_sq_033_the_old_hunters_debt_obj_02":
    id(8761000000000547),
  "bible:harthmere_sq_033_the_old_hunters_debt:objective:harthmere_sq_033_the_old_hunters_debt_obj_03":
    id(8761000000000548),
  "bible:harthmere_sq_033_the_old_hunters_debt:objective:harthmere_sq_033_the_old_hunters_debt_obj_04":
    id(8761000000000549),
  "bible:harthmere_sq_034_the_charcoal_burners_cough:root":
    id(8761000000000550),
  "bible:harthmere_sq_034_the_charcoal_burners_cough:objective:harthmere_sq_034_the_charcoal_burners_cough_obj_01":
    id(8761000000000551),
  "bible:harthmere_sq_034_the_charcoal_burners_cough:objective:harthmere_sq_034_the_charcoal_burners_cough_obj_02":
    id(8761000000000552),
  "bible:harthmere_sq_034_the_charcoal_burners_cough:objective:harthmere_sq_034_the_charcoal_burners_cough_obj_03":
    id(8761000000000553),
  "bible:harthmere_sq_034_the_charcoal_burners_cough:objective:harthmere_sq_034_the_charcoal_burners_cough_obj_04":
    id(8761000000000554),
  "bible:harthmere_sq_035_the_pilgrims_path:root": id(8761000000000555),
  "bible:harthmere_sq_035_the_pilgrims_path:objective:harthmere_sq_035_the_pilgrims_path_obj_01":
    id(8761000000000556),
  "bible:harthmere_sq_035_the_pilgrims_path:objective:harthmere_sq_035_the_pilgrims_path_obj_02":
    id(8761000000000557),
  "bible:harthmere_sq_035_the_pilgrims_path:objective:harthmere_sq_035_the_pilgrims_path_obj_03":
    id(8761000000000558),
  "bible:harthmere_sq_035_the_pilgrims_path:objective:harthmere_sq_035_the_pilgrims_path_obj_04":
    id(8761000000000559),
  "bible:harthmere_sq_036_tamsins_trial:root": id(8761000000000560),
  "bible:harthmere_sq_036_tamsins_trial:objective:harthmere_sq_036_tamsins_trial_obj_01":
    id(8761000000000561),
  "bible:harthmere_sq_036_tamsins_trial:objective:harthmere_sq_036_tamsins_trial_obj_02":
    id(8761000000000562),
  "bible:harthmere_sq_036_tamsins_trial:objective:harthmere_sq_036_tamsins_trial_obj_03":
    id(8761000000000563),
  "bible:harthmere_sq_036_tamsins_trial:objective:harthmere_sq_036_tamsins_trial_obj_04":
    id(8761000000000564),
  "bible:harthmere_sq_037_the_moss_womans_riddle:root": id(8761000000000565),
  "bible:harthmere_sq_037_the_moss_womans_riddle:objective:harthmere_sq_037_the_moss_womans_riddle_obj_01":
    id(8761000000000566),
  "bible:harthmere_sq_037_the_moss_womans_riddle:objective:harthmere_sq_037_the_moss_womans_riddle_obj_02":
    id(8761000000000567),
  "bible:harthmere_sq_037_the_moss_womans_riddle:objective:harthmere_sq_037_the_moss_womans_riddle_obj_03":
    id(8761000000000568),
  "bible:harthmere_sq_037_the_moss_womans_riddle:objective:harthmere_sq_037_the_moss_womans_riddle_obj_04":
    id(8761000000000569),
  "bible:harthmere_sq_038_the_brass_scales_books:root": id(8761000000000570),
  "bible:harthmere_sq_038_the_brass_scales_books:objective:harthmere_sq_038_the_brass_scales_books_obj_01":
    id(8761000000000571),
  "bible:harthmere_sq_038_the_brass_scales_books:objective:harthmere_sq_038_the_brass_scales_books_obj_02":
    id(8761000000000572),
  "bible:harthmere_sq_038_the_brass_scales_books:objective:harthmere_sq_038_the_brass_scales_books_obj_03":
    id(8761000000000573),
  "bible:harthmere_sq_038_the_brass_scales_books:objective:harthmere_sq_038_the_brass_scales_books_obj_04":
    id(8761000000000574),
  "bible:harthmere_sq_039_a_debt_to_settle:root": id(8761000000000575),
  "bible:harthmere_sq_039_a_debt_to_settle:objective:harthmere_sq_039_a_debt_to_settle_obj_01":
    id(8761000000000576),
  "bible:harthmere_sq_039_a_debt_to_settle:objective:harthmere_sq_039_a_debt_to_settle_obj_02":
    id(8761000000000577),
  "bible:harthmere_sq_039_a_debt_to_settle:objective:harthmere_sq_039_a_debt_to_settle_obj_03":
    id(8761000000000578),
  "bible:harthmere_sq_039_a_debt_to_settle:objective:harthmere_sq_039_a_debt_to_settle_obj_04":
    id(8761000000000579),
  "bible:harthmere_sq_040_the_buried_bell:root": id(8761000000000580),
  "bible:harthmere_sq_040_the_buried_bell:objective:harthmere_sq_040_the_buried_bell_obj_01":
    id(8761000000000581),
  "bible:harthmere_sq_040_the_buried_bell:objective:harthmere_sq_040_the_buried_bell_obj_02":
    id(8761000000000582),
  "bible:harthmere_sq_040_the_buried_bell:objective:harthmere_sq_040_the_buried_bell_obj_03":
    id(8761000000000583),
  "bible:harthmere_sq_040_the_buried_bell:objective:harthmere_sq_040_the_buried_bell_obj_04":
    id(8761000000000584),
  "bible:harthmere_sq_041_the_doorway_that_wasnt:root": id(8761000000000585),
  "bible:harthmere_sq_041_the_doorway_that_wasnt:objective:harthmere_sq_041_the_doorway_that_wasnt_obj_01":
    id(8761000000000586),
  "bible:harthmere_sq_041_the_doorway_that_wasnt:objective:harthmere_sq_041_the_doorway_that_wasnt_obj_02":
    id(8761000000000587),
  "bible:harthmere_sq_041_the_doorway_that_wasnt:objective:harthmere_sq_041_the_doorway_that_wasnt_obj_03":
    id(8761000000000588),
  "bible:harthmere_sq_041_the_doorway_that_wasnt:objective:harthmere_sq_041_the_doorway_that_wasnt_obj_04":
    id(8761000000000589),
  "bible:harthmere_sq_042_the_singing_in_the_walls:root": id(8761000000000590),
  "bible:harthmere_sq_042_the_singing_in_the_walls:objective:harthmere_sq_042_the_singing_in_the_walls_obj_01":
    id(8761000000000591),
  "bible:harthmere_sq_042_the_singing_in_the_walls:objective:harthmere_sq_042_the_singing_in_the_walls_obj_02":
    id(8761000000000592),
  "bible:harthmere_sq_042_the_singing_in_the_walls:objective:harthmere_sq_042_the_singing_in_the_walls_obj_03":
    id(8761000000000593),
  "bible:harthmere_sq_042_the_singing_in_the_walls:objective:harthmere_sq_042_the_singing_in_the_walls_obj_04":
    id(8761000000000594),
  "bible:starter_welcome_to_harthmere:root": id(8761000000000595),
  "bible:starter_welcome_to_harthmere:objective:starter_welcome_to_harthmere_obj_01":
    id(8761000000000596),
  "bible:starter_welcome_to_harthmere:objective:starter_welcome_to_harthmere_obj_02":
    id(8761000000000597),
  "bible:starter_welcome_to_harthmere:objective:starter_welcome_to_harthmere_obj_03":
    id(8761000000000598),
  "bible:starter_welcome_to_harthmere:objective:starter_welcome_to_harthmere_obj_04":
    id(8761000000000599),
  "bible:starter_apples_for_dawnloaf:root": id(8761000000000600),
  "bible:starter_apples_for_dawnloaf:objective:starter_apples_for_dawnloaf_obj_01":
    id(8761000000000601),
  "bible:starter_apples_for_dawnloaf:objective:starter_apples_for_dawnloaf_obj_02":
    id(8761000000000602),
  "bible:starter_apples_for_dawnloaf:objective:starter_apples_for_dawnloaf_obj_03":
    id(8761000000000603),
  "bible:starter_apples_for_dawnloaf:objective:starter_apples_for_dawnloaf_obj_04":
    id(8761000000000604),
  "bible:starter_missing_lockbox:root": id(8761000000000605),
  "bible:starter_missing_lockbox:objective:starter_missing_lockbox_obj_01":
    id(8761000000000606),
  "bible:starter_missing_lockbox:objective:starter_missing_lockbox_obj_02":
    id(8761000000000607),
  "bible:starter_missing_lockbox:objective:starter_missing_lockbox_obj_03":
    id(8761000000000608),
  "bible:starter_missing_lockbox:objective:starter_missing_lockbox_obj_04":
    id(8761000000000609),
  "bible:starter_cold_iron_hot_temper:root": id(8761000000000610),
  "bible:starter_cold_iron_hot_temper:objective:starter_cold_iron_hot_temper_obj_01":
    id(8761000000000611),
  "bible:starter_cold_iron_hot_temper:objective:starter_cold_iron_hot_temper_obj_02":
    id(8761000000000612),
  "bible:starter_cold_iron_hot_temper:objective:starter_cold_iron_hot_temper_obj_03":
    id(8761000000000613),
  "bible:starter_cold_iron_hot_temper:objective:starter_cold_iron_hot_temper_obj_04":
    id(8761000000000614),
  "bible:starter_fever_tea:root": id(8761000000000615),
  "bible:starter_fever_tea:objective:starter_fever_tea_obj_01":
    id(8761000000000616),
  "bible:starter_fever_tea:objective:starter_fever_tea_obj_02":
    id(8761000000000617),
  "bible:starter_fever_tea:objective:starter_fever_tea_obj_03":
    id(8761000000000618),
  "bible:starter_fever_tea:objective:starter_fever_tea_obj_04":
    id(8761000000000619),
  "bible:starter_rumor_has_it:root": id(8761000000000620),
  "bible:starter_rumor_has_it:objective:starter_rumor_has_it_obj_01":
    id(8761000000000621),
  "bible:starter_rumor_has_it:objective:starter_rumor_has_it_obj_02":
    id(8761000000000622),
  "bible:starter_rumor_has_it:objective:starter_rumor_has_it_obj_03":
    id(8761000000000623),
  "bible:starter_rumor_has_it:objective:starter_rumor_has_it_obj_04":
    id(8761000000000624),
  "bible:starter_loose_chickens:root": id(8761000000000625),
  "bible:starter_loose_chickens:objective:starter_loose_chickens_obj_01":
    id(8761000000000626),
  "bible:starter_loose_chickens:objective:starter_loose_chickens_obj_02":
    id(8761000000000627),
  "bible:starter_loose_chickens:objective:starter_loose_chickens_obj_03":
    id(8761000000000628),
  "bible:starter_loose_chickens:objective:starter_loose_chickens_obj_04":
    id(8761000000000629),
  "bible:starter_whispering_crate:root": id(8761000000000630),
  "bible:starter_whispering_crate:objective:starter_whispering_crate_obj_01":
    id(8761000000000631),
  "bible:starter_whispering_crate:objective:starter_whispering_crate_obj_02":
    id(8761000000000632),
  "bible:starter_whispering_crate:objective:starter_whispering_crate_obj_03":
    id(8761000000000633),
  "bible:starter_whispering_crate:objective:starter_whispering_crate_obj_04":
    id(8761000000000634),
  "bible:starter_the_missing_bell:root": id(8761000000000635),
  "bible:starter_the_missing_bell:objective:starter_the_missing_bell_obj_01":
    id(8761000000000636),
  "bible:starter_the_missing_bell:objective:starter_the_missing_bell_obj_02":
    id(8761000000000637),
  "bible:starter_the_missing_bell:objective:starter_the_missing_bell_obj_03":
    id(8761000000000638),
  "bible:starter_the_missing_bell:objective:starter_the_missing_bell_obj_04":
    id(8761000000000639),
  "bible:repeatable_watch_patrol_routes:root": id(8761000000000640),
  "bible:repeatable_watch_patrol_routes:objective:repeatable_watch_patrol_routes_obj_01":
    id(8761000000000641),
  "bible:repeatable_watch_patrol_routes:objective:repeatable_watch_patrol_routes_obj_02":
    id(8761000000000642),
  "bible:repeatable_watch_patrol_routes:objective:repeatable_watch_patrol_routes_obj_03":
    id(8761000000000643),
  "bible:repeatable_watch_patrol_routes:objective:repeatable_watch_patrol_routes_obj_04":
    id(8761000000000644),
  "bible:repeatable_watch_bounty_board:root": id(8761000000000645),
  "bible:repeatable_watch_bounty_board:objective:repeatable_watch_bounty_board_obj_01":
    id(8761000000000646),
  "bible:repeatable_watch_bounty_board:objective:repeatable_watch_bounty_board_obj_02":
    id(8761000000000647),
  "bible:repeatable_watch_bounty_board:objective:repeatable_watch_bounty_board_obj_03":
    id(8761000000000648),
  "bible:repeatable_watch_bounty_board:objective:repeatable_watch_bounty_board_obj_04":
    id(8761000000000649),
  "bible:repeatable_watch_gate_inspections:root": id(8761000000000650),
  "bible:repeatable_watch_gate_inspections:objective:repeatable_watch_gate_inspections_obj_01":
    id(8761000000000651),
  "bible:repeatable_watch_gate_inspections:objective:repeatable_watch_gate_inspections_obj_02":
    id(8761000000000652),
  "bible:repeatable_watch_gate_inspections:objective:repeatable_watch_gate_inspections_obj_03":
    id(8761000000000653),
  "bible:repeatable_watch_gate_inspections:objective:repeatable_watch_gate_inspections_obj_04":
    id(8761000000000654),
  "bible:repeatable_merchant_market_writs:root": id(8761000000000655),
  "bible:repeatable_merchant_market_writs:objective:repeatable_merchant_market_writs_obj_01":
    id(8761000000000656),
  "bible:repeatable_merchant_market_writs:objective:repeatable_merchant_market_writs_obj_02":
    id(8761000000000657),
  "bible:repeatable_merchant_market_writs:objective:repeatable_merchant_market_writs_obj_03":
    id(8761000000000658),
  "bible:repeatable_merchant_market_writs:objective:repeatable_merchant_market_writs_obj_04":
    id(8761000000000659),
  "bible:repeatable_merchant_cargo_escorts:root": id(8761000000000660),
  "bible:repeatable_merchant_cargo_escorts:objective:repeatable_merchant_cargo_escorts_obj_01":
    id(8761000000000661),
  "bible:repeatable_merchant_cargo_escorts:objective:repeatable_merchant_cargo_escorts_obj_02":
    id(8761000000000662),
  "bible:repeatable_merchant_cargo_escorts:objective:repeatable_merchant_cargo_escorts_obj_03":
    id(8761000000000663),
  "bible:repeatable_merchant_cargo_escorts:objective:repeatable_merchant_cargo_escorts_obj_04":
    id(8761000000000664),
  "bible:repeatable_chapel_charity_deliveries:root": id(8761000000000665),
  "bible:repeatable_chapel_charity_deliveries:objective:repeatable_chapel_charity_deliveries_obj_01":
    id(8761000000000666),
  "bible:repeatable_chapel_charity_deliveries:objective:repeatable_chapel_charity_deliveries_obj_02":
    id(8761000000000667),
  "bible:repeatable_chapel_charity_deliveries:objective:repeatable_chapel_charity_deliveries_obj_03":
    id(8761000000000668),
  "bible:repeatable_chapel_charity_deliveries:objective:repeatable_chapel_charity_deliveries_obj_04":
    id(8761000000000669),
  "bible:repeatable_chapel_candle_vigils:root": id(8761000000000670),
  "bible:repeatable_chapel_candle_vigils:objective:repeatable_chapel_candle_vigils_obj_01":
    id(8761000000000671),
  "bible:repeatable_chapel_candle_vigils:objective:repeatable_chapel_candle_vigils_obj_02":
    id(8761000000000672),
  "bible:repeatable_chapel_candle_vigils:objective:repeatable_chapel_candle_vigils_obj_03":
    id(8761000000000673),
  "bible:repeatable_chapel_candle_vigils:objective:repeatable_chapel_candle_vigils_obj_04":
    id(8761000000000674),
  "bible:repeatable_chapel_grave_tending:root": id(8761000000000675),
  "bible:repeatable_chapel_grave_tending:objective:repeatable_chapel_grave_tending_obj_01":
    id(8761000000000676),
  "bible:repeatable_chapel_grave_tending:objective:repeatable_chapel_grave_tending_obj_02":
    id(8761000000000677),
  "bible:repeatable_chapel_grave_tending:objective:repeatable_chapel_grave_tending_obj_03":
    id(8761000000000678),
  "bible:repeatable_chapel_grave_tending:objective:repeatable_chapel_grave_tending_obj_04":
    id(8761000000000679),
  "bible:repeatable_river_knots_information_drops:root": id(8761000000000680),
  "bible:repeatable_river_knots_information_drops:objective:repeatable_river_knots_information_drops_obj_01":
    id(8761000000000681),
  "bible:repeatable_river_knots_information_drops:objective:repeatable_river_knots_information_drops_obj_02":
    id(8761000000000682),
  "bible:repeatable_river_knots_information_drops:objective:repeatable_river_knots_information_drops_obj_03":
    id(8761000000000683),
  "bible:repeatable_river_knots_information_drops:objective:repeatable_river_knots_information_drops_obj_04":
    id(8761000000000684),
  "bible:repeatable_river_knots_small_smuggling_runs:root":
    id(8761000000000685),
  "bible:repeatable_river_knots_small_smuggling_runs:objective:repeatable_river_knots_small_smuggling_runs_obj_01":
    id(8761000000000686),
  "bible:repeatable_river_knots_small_smuggling_runs:objective:repeatable_river_knots_small_smuggling_runs_obj_02":
    id(8761000000000687),
  "bible:repeatable_river_knots_small_smuggling_runs:objective:repeatable_river_knots_small_smuggling_runs_obj_03":
    id(8761000000000688),
  "bible:repeatable_river_knots_small_smuggling_runs:objective:repeatable_river_knots_small_smuggling_runs_obj_04":
    id(8761000000000689),
  "bible:repeatable_mudden_rat_catching:root": id(8761000000000690),
  "bible:repeatable_mudden_rat_catching:objective:repeatable_mudden_rat_catching_obj_01":
    id(8761000000000691),
  "bible:repeatable_mudden_rat_catching:objective:repeatable_mudden_rat_catching_obj_02":
    id(8761000000000692),
  "bible:repeatable_mudden_rat_catching:objective:repeatable_mudden_rat_catching_obj_03":
    id(8761000000000693),
  "bible:repeatable_mudden_rat_catching:objective:repeatable_mudden_rat_catching_obj_04":
    id(8761000000000694),
  "bible:repeatable_mudden_food_distribution:root": id(8761000000000695),
  "bible:repeatable_mudden_food_distribution:objective:repeatable_mudden_food_distribution_obj_01":
    id(8761000000000696),
  "bible:repeatable_mudden_food_distribution:objective:repeatable_mudden_food_distribution_obj_02":
    id(8761000000000697),
  "bible:repeatable_mudden_food_distribution:objective:repeatable_mudden_food_distribution_obj_03":
    id(8761000000000698),
  "bible:repeatable_mudden_food_distribution:objective:repeatable_mudden_food_distribution_obj_04":
    id(8761000000000699),
  "bible:weekly_watch_town_defense_drill:root": id(8761000000000700),
  "bible:weekly_watch_town_defense_drill:objective:weekly_watch_town_defense_drill_obj_01":
    id(8761000000000701),
  "bible:weekly_watch_town_defense_drill:objective:weekly_watch_town_defense_drill_obj_02":
    id(8761000000000702),
  "bible:weekly_watch_town_defense_drill:objective:weekly_watch_town_defense_drill_obj_03":
    id(8761000000000703),
  "bible:weekly_watch_town_defense_drill:objective:weekly_watch_town_defense_drill_obj_04":
    id(8761000000000704),
  "bible:weekly_merchant_bridge_day_setup:root": id(8761000000000705),
  "bible:weekly_merchant_bridge_day_setup:objective:weekly_merchant_bridge_day_setup_obj_01":
    id(8761000000000706),
  "bible:weekly_merchant_bridge_day_setup:objective:weekly_merchant_bridge_day_setup_obj_02":
    id(8761000000000707),
  "bible:weekly_merchant_bridge_day_setup:objective:weekly_merchant_bridge_day_setup_obj_03":
    id(8761000000000708),
  "bible:weekly_merchant_bridge_day_setup:objective:weekly_merchant_bridge_day_setup_obj_04":
    id(8761000000000709),
  "bible:weekly_chapel_river_blessing_prep:root": id(8761000000000710),
  "bible:weekly_chapel_river_blessing_prep:objective:weekly_chapel_river_blessing_prep_obj_01":
    id(8761000000000711),
  "bible:weekly_chapel_river_blessing_prep:objective:weekly_chapel_river_blessing_prep_obj_02":
    id(8761000000000712),
  "bible:weekly_chapel_river_blessing_prep:objective:weekly_chapel_river_blessing_prep_obj_03":
    id(8761000000000713),
  "bible:weekly_chapel_river_blessing_prep:objective:weekly_chapel_river_blessing_prep_obj_04":
    id(8761000000000714),
  "bible:weekly_river_knots_cargo_heist:root": id(8761000000000715),
  "bible:weekly_river_knots_cargo_heist:objective:weekly_river_knots_cargo_heist_obj_01":
    id(8761000000000716),
  "bible:weekly_river_knots_cargo_heist:objective:weekly_river_knots_cargo_heist_obj_02":
    id(8761000000000717),
  "bible:weekly_river_knots_cargo_heist:objective:weekly_river_knots_cargo_heist_obj_03":
    id(8761000000000718),
  "bible:weekly_river_knots_cargo_heist:objective:weekly_river_knots_cargo_heist_obj_04":
    id(8761000000000719),
  "bible:weekly_mudden_ward_fair:root": id(8761000000000720),
  "bible:weekly_mudden_ward_fair:objective:weekly_mudden_ward_fair_obj_01":
    id(8761000000000721),
  "bible:weekly_mudden_ward_fair:objective:weekly_mudden_ward_fair_obj_02":
    id(8761000000000722),
  "bible:weekly_mudden_ward_fair:objective:weekly_mudden_ward_fair_obj_03":
    id(8761000000000723),
  "bible:weekly_mudden_ward_fair:objective:weekly_mudden_ward_fair_obj_04":
    id(8761000000000724),
  "bible:repeatable_wilds_resource_route:root": id(8761000000000725),
  "bible:repeatable_wilds_resource_route:objective:repeatable_wilds_resource_route_obj_01":
    id(8761000000000726),
  "bible:repeatable_wilds_resource_route:objective:repeatable_wilds_resource_route_obj_02":
    id(8761000000000727),
  "bible:repeatable_wilds_resource_route:objective:repeatable_wilds_resource_route_obj_03":
    id(8761000000000728),
  "bible:repeatable_wilds_resource_route:objective:repeatable_wilds_resource_route_obj_04":
    id(8761000000000729),
  "bible:repeatable_wilds_rescue_lost_traveler:root": id(8761000000000730),
  "bible:repeatable_wilds_rescue_lost_traveler:objective:repeatable_wilds_rescue_lost_traveler_obj_01":
    id(8761000000000731),
  "bible:repeatable_wilds_rescue_lost_traveler:objective:repeatable_wilds_rescue_lost_traveler_obj_02":
    id(8761000000000732),
  "bible:repeatable_wilds_rescue_lost_traveler:objective:repeatable_wilds_rescue_lost_traveler_obj_03":
    id(8761000000000733),
  "bible:repeatable_wilds_rescue_lost_traveler:objective:repeatable_wilds_rescue_lost_traveler_obj_04":
    id(8761000000000734),
  "bible:repeatable_wilds_road_bandits:root": id(8761000000000735),
  "bible:repeatable_wilds_road_bandits:objective:repeatable_wilds_road_bandits_obj_01":
    id(8761000000000736),
  "bible:repeatable_wilds_road_bandits:objective:repeatable_wilds_road_bandits_obj_02":
    id(8761000000000737),
  "bible:repeatable_wilds_road_bandits:objective:repeatable_wilds_road_bandits_obj_03":
    id(8761000000000738),
  "bible:repeatable_wilds_road_bandits:objective:repeatable_wilds_road_bandits_obj_04":
    id(8761000000000739),
  "bible:repeatable_briarfen_witchlights:root": id(8761000000000740),
  "bible:repeatable_briarfen_witchlights:objective:repeatable_briarfen_witchlights_obj_01":
    id(8761000000000741),
  "bible:repeatable_briarfen_witchlights:objective:repeatable_briarfen_witchlights_obj_02":
    id(8761000000000742),
  "bible:repeatable_briarfen_witchlights:objective:repeatable_briarfen_witchlights_obj_03":
    id(8761000000000743),
  "bible:repeatable_briarfen_witchlights:objective:repeatable_briarfen_witchlights_obj_04":
    id(8761000000000744),
} as const satisfies Readonly<Record<string, BiomesId>>;

export interface HarthmereNativeQuestGiverSeed {
  entityId: BiomesId;
  displayName: string;
  position: readonly [number, number, number];
  needsSeed: boolean;
}

/**
 * Existing Grove/town NPC ids are preserved. Missing Bible givers receive a
 * reserved entity id and are seeded as native quest-giver NPCs by the shim.
 */
export const HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST = {
  jackie: {
    entityId: id(8810000000019301),
    displayName: "Jackie",
    position: [496, 53, -126] as const,
    needsSeed: false,
  },
  mira_grove_land_steward: {
    entityId: id(8810000000019315),
    displayName: "Mira Thatch, Grove Land Steward",
    position: [501, 53, -132] as const,
    needsSeed: false,
  },
  taye: {
    entityId: id(8810000000019305),
    displayName: "Taye",
    position: [491, 53, -124] as const,
    needsSeed: false,
  },
  rosalyn: {
    entityId: id(8810000000019314),
    displayName: "Rosalyn",
    position: [499, 53, -128] as const,
    needsSeed: false,
  },
  guild_clerk_nia: {
    entityId: id(8810000000019313),
    displayName: "Nia, Guild Clerk",
    position: [502, 53, -123] as const,
    needsSeed: false,
  },
  luis: {
    entityId: id(8810000000019304),
    displayName: "Luis",
    position: [486, 53, -209] as const,
    needsSeed: false,
  },
  alexis: {
    entityId: id(8810000000019306),
    displayName: "Alexis",
    position: [405, 53, -128] as const,
    needsSeed: false,
  },
  ranger_jane: {
    entityId: id(8810000000019303),
    displayName: "Ranger Jane",
    position: [450, 53, -260] as const,
    needsSeed: false,
  },
  sil: {
    entityId: id(8810000000019307),
    displayName: "Sil",
    position: [462, 53, -252] as const,
    needsSeed: false,
  },
  doc: {
    entityId: id(8810000000019309),
    displayName: "Doc",
    position: [512, 53, -152] as const,
    needsSeed: false,
  },
  dimmi: {
    entityId: id(8810000000019308),
    displayName: "Dimmi",
    position: [560, 53, -182] as const,
    needsSeed: false,
  },
  old_coop: {
    entityId: id(8810000000019310),
    displayName: "Old Coop",
    position: [380, 53, -202] as const,
    needsSeed: false,
  },
  buddy: {
    entityId: id(8810000000019311),
    displayName: "Buddy",
    position: [494, 53, -213] as const,
    needsSeed: false,
  },
  billy: {
    entityId: id(8810000000019302),
    displayName: "Billy",
    position: [500, 53, -140] as const,
    needsSeed: false,
  },
  grove_banker_merl: {
    entityId: id(8810000000019316),
    displayName: "Merl Voss, Grove Banker",
    position: [490, 53, -120] as const,
    needsSeed: false,
  },
  gus_the_baker: {
    entityId: id(8810000000019320),
    displayName: "Gus the Baker",
    position: [486, 53, -126] as const,
    needsSeed: false,
  },
  fern_the_grower: {
    entityId: id(8810000000019321),
    displayName: "Fern the Grower",
    position: [496, 53, -118] as const,
    needsSeed: false,
  },
  kit_the_courier: {
    entityId: id(8810000000019322),
    displayName: "Kit the Courier",
    position: [504, 53, -118] as const,
    needsSeed: false,
  },
  mel_the_handyman: {
    entityId: id(8810000000019323),
    displayName: "Mel the Handyman",
    position: [488, 53, -218] as const,
    needsSeed: false,
  },
  rin_the_forager: {
    entityId: id(8810000000019324),
    displayName: "Rin the Forager",
    position: [510, 53, -155] as const,
    needsSeed: false,
  },
  carlo_the_cook: {
    entityId: id(8810000000019325),
    displayName: "Carlo the Cook",
    position: [498, 53, -133] as const,
    needsSeed: false,
  },
  reeve_caldus_merrow: {
    entityId: id(8810000000010032),
    displayName: "Reeve Caldus Merrow",
    position: [476, 0, -212] as const,
    needsSeed: false,
  },
  father_aldren_mell: {
    entityId: id(8810000000010031),
    displayName: "Father Aldren",
    position: [484, 0, -151] as const,
    needsSeed: false,
  },
  nessa_crowe: {
    entityId: id(8810000000010033),
    displayName: "Nessa Crowe",
    position: [416, 0, -158] as const,
    needsSeed: false,
  },
  master_osric_vale: {
    entityId: id(8810000000010029),
    displayName: "Master Osric Vale",
    position: [530, 0, -232] as const,
    needsSeed: false,
  },
  sergeant_bram_holt: {
    entityId: id(8810000000010027),
    displayName: "Sergeant Bram Holt",
    position: [486, 0, -266] as const,
    needsSeed: false,
  },
  walt_ormsby: {
    entityId: id(8810000000012000),
    displayName: "Walt Ormsby",
    position: [512, 0, -264] as const,
    needsSeed: true,
  },
  mara_thistle: {
    entityId: id(8810000000010028),
    displayName: "Mara Thistle",
    position: [476, 0, -212] as const,
    needsSeed: false,
  },
  elowen_pike: {
    entityId: id(8810000000010030),
    displayName: "Elowen Pike",
    position: [552, 0, -194] as const,
    needsSeed: false,
  },
  ysabet_fenlow: {
    entityId: id(8810000000010047),
    displayName: "Ysabet Fenlow",
    position: [476, 0, -212] as const,
    needsSeed: false,
  },
  tovin_reed: {
    entityId: id(8810000000010034),
    displayName: "Tovin Reed",
    position: [596, 0, -172] as const,
    needsSeed: false,
  },
  veska_reed: {
    entityId: id(8810000000012001),
    displayName: "Veska Reed",
    position: [596, 0, -172] as const,
    needsSeed: true,
  },
  sella_reedfoot: {
    entityId: id(8810000000012002),
    displayName: "Sella Reedfoot",
    position: [650, 0, -296] as const,
    needsSeed: true,
  },
  edda_wren: {
    entityId: id(8810000000012003),
    displayName: "Edda Wren",
    position: [532, 0, -388] as const,
    needsSeed: true,
  },
  merrit_bracken: {
    entityId: id(8810000000012004),
    displayName: "Merrit Bracken",
    position: [476, 0, -212] as const,
    needsSeed: true,
  },
  brother_cael_marsen: {
    entityId: id(8810000000012005),
    displayName: "Brother Cael Marsen",
    position: [536, 0, -119] as const,
    needsSeed: true,
  },
  tamsin_vale: {
    entityId: id(8810000000012006),
    displayName: "Tamsin Vale",
    position: [440, 0, -448] as const,
    needsSeed: true,
  },
  veneth_moss_woman: {
    entityId: id(8810000000012007),
    displayName: "Veneth the Moss-Woman",
    position: [620, 0, -505] as const,
    needsSeed: true,
  },
  edrik_vane: {
    entityId: id(8810000000012008),
    displayName: "Edrik Vane",
    position: [562, 0, -262] as const,
    needsSeed: true,
  },
  dawn_loaf: {
    entityId: id(8810000000012009),
    displayName: "Dawn Loaf",
    position: [476, 0, -212] as const,
    needsSeed: true,
  },
  banker_merl_voss: {
    entityId: id(8810000000010006),
    displayName: "Banker Merl Voss",
    position: [556, 0, -224] as const,
    needsSeed: false,
  },
  sister_maelle_frenn: {
    entityId: id(8810000000010046),
    displayName: "Sister Maelle",
    position: [480, 0, -137] as const,
    needsSeed: false,
  },
} as const satisfies Readonly<Record<string, HarthmereNativeQuestGiverSeed>>;
