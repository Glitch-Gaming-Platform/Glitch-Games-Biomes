// GENERATED: This file is generated from types.ts.j2. Do not modify directly.
// Content Hash: d2847c364de93ccbed7031dcca544ed1

export type { Item, ReadonlyItem } from "@/shared/ecs/extern";
export {
  zItem,
  defaultItem,
  serializeItem,
  deserializeItem,
} from "@/shared/ecs/extern";
import {
  Item,
  ReadonlyItem,
  zItem,
  defaultItem,
  serializeItem,
  deserializeItem,
} from "@/shared/ecs/extern";
import { ReadonlyBiomesId, BiomesId, zBiomesId } from "@/shared/ids";
import {
  defaultBiomesId,
  serializeBiomesId,
  deserializeBiomesId,
} from "@/shared/ecs/extern";
export {
  defaultBiomesId,
  serializeBiomesId,
  deserializeBiomesId,
} from "@/shared/ecs/extern";
export type { ItemAndCount, ReadonlyItemAndCount } from "@/shared/ecs/extern";
export {
  zItemAndCount,
  defaultItemAndCount,
  serializeItemAndCount,
  deserializeItemAndCount,
} from "@/shared/ecs/extern";
import {
  ItemAndCount,
  ReadonlyItemAndCount,
  zItemAndCount,
  defaultItemAndCount,
  serializeItemAndCount,
  deserializeItemAndCount,
} from "@/shared/ecs/extern";
export type {
  TriggerStateMap,
  ReadonlyTriggerStateMap,
} from "@/shared/ecs/extern";
export {
  zTriggerStateMap,
  defaultTriggerStateMap,
  serializeTriggerStateMap,
  deserializeTriggerStateMap,
} from "@/shared/ecs/extern";
import {
  TriggerStateMap,
  ReadonlyTriggerStateMap,
  zTriggerStateMap,
  defaultTriggerStateMap,
  serializeTriggerStateMap,
  deserializeTriggerStateMap,
} from "@/shared/ecs/extern";
export type { ShardId, ReadonlyShardId } from "@/shared/ecs/extern";
export {
  zShardId,
  defaultShardId,
  serializeShardId,
  deserializeShardId,
} from "@/shared/ecs/extern";
import {
  ShardId,
  ReadonlyShardId,
  zShardId,
  defaultShardId,
  serializeShardId,
  deserializeShardId,
} from "@/shared/ecs/extern";
import { z } from "zod";
import { isInteger } from "lodash";
import { ok } from "assert";

// ================
// Type schema
// ================

export const zBuffer = z.instanceof(Uint8Array);
export const zString = z.string();
export const zBool = z.boolean();
export const zI8 = z.number();
export const zI16 = z.number();
export const zI32 = z.number();
export const zI64 = z.bigint();
export const zU8 = z.number();
export const zU16 = z.number();
export const zU32 = z.number();
export const zU64 = z.bigint();
export const zF32 = z.number();
export const zF64 = z.number();
export const zTensorBlob = z.string();
export const zConsumptionAction = z.enum(["drink", "eat"]);
export const zEmoteType = z.enum([
  "attack1",
  "attack2",
  "destroy",
  "place",
  "applause",
  "dance",
  "drink",
  "eat",
  "flex",
  "laugh",
  "point",
  "rock",
  "sick",
  "sit",
  "splash",
  "warp",
  "warpHome",
  "wave",
  "fishingCastPull",
  "fishingCastRelease",
  "fishingIdle",
  "fishingReel",
  "fishingShow",
  "diggingHand",
  "diggingTool",
  "watering",
  "equip",
  "unequip",
  "sadness",
  "depression",
  "crying",
  "shame",
  "fear",
  "terror",
  "cowering",
  "nervousness",
  "surprise",
  "shock",
  "recoil",
  "curiosity",
  "thinking",
  "confusion",
  "uncertainty",
  "embarrassment",
  "shyness",
  "boredom",
  "impatience",
  "annoyance",
  "frustration",
  "facepalm",
  "anger",
  "fury",
  "threatening",
  "determined",
  "ready",
  "tiredness",
  "exhaustion",
  "yawning",
  "stretching",
  "injury",
  "limping",
  "dizziness",
  "shivering",
  "relief",
  "disgust",
  "love",
  "flirting",
  "gratitude",
  "apology",
  "bow",
  "salute",
  "kneel",
  "pray",
  "meditate",
  "surrender",
  "beckon",
  "stop",
  "comeHere",
  "hug",
  "handshake",
  "highFive",
  "thumbsUp",
  "thumbsDown",
  "guard",
  "block",
  "taunt",
  "stagger",
  "knockdown",
  "getUp",
  "retreat",
  "rally",
  "victory",
  "defeat",
  "footTapping",
  "scratchingHead",
  "checkingEquipment",
  "pacing",
  "sighing",
  "cleaningWeapon",
]);
export const zMovementActionType = z.enum(["dodge", "evade"]);
export const zWarpHomeReason = z.enum(["respawn", "homestone", "admin"]);
export const zCameraMode = z.enum([
  "normal",
  "selfie",
  "fps",
  "isometric",
  "iso_ne",
  "iso_nw",
  "iso_sw",
  "iso_se",
]);
export const zAclAction = z.enum([
  "shape",
  "place",
  "destroy",
  "interact",
  "administrate",
  "createGroup",
  "dump",
  "placeCampsite",
  "tillSoil",
  "plantSeed",
  "pvp",
  "warp_from",
  "apply_buffs",
  "placeRobot",
  "placeEphemeral",
  "demuckerWand",
]);
export const zUserRole = z.enum([
  "employee",
  "admin",
  "advancedOptions",
  "deleteGroup",
  "highlightGroup",
  "unplaceGroup",
  "repairGroup",
  "seeGremlins",
  "seeNpcs",
  "bless",
  "give",
  "flying",
  "internalSync",
  "export",
  "groundskeeper",
  "clone",
  "apply",
  "twoWayInbox",
  "baker",
  "farmingAdmin",
  "oobNoCors",
  "noClip",
]);
const zT109 = z.enum(["aabb"]);
const zT111 = z.enum(["point"]);
const zT113 = z.enum(["points"]);
const zT116 = z.enum(["dayNight"]);
const zT118 = z.enum(["farFromHome"]);
const zT120 = z.enum(["adminKill"]);
const zT122 = z.enum(["outOfWorldBounds"]);
const zT125 = z.enum(["suicide"]);
const zT127 = z.enum(["despawnWand"]);
const zT129 = z.enum(["block"]);
const zT131 = z.enum(["fall"]);
const zT133 = z.enum(["attack"]);
const zT135 = z.enum(["drown"]);
const zT137 = z.enum(["fire"]);
const zT139 = z.enum(["fireDamage"]);
const zT141 = z.enum(["fireHeal"]);
const zT143 = z.enum(["heal"]);
const zT145 = z.enum(["npc"]);
export const zPlaceableAnimationType = z.enum(["open", "close", "play"]);
export const zAnimationRepeatKind = z.enum(["once", "repeat"]);
export const zChallengeState = z.enum([
  "available",
  "completed",
  "in_progress",
  "start",
]);
export const zLifetimeStatsType = z.enum([
  "collected",
  "crafted",
  "fished",
  "mined",
  "consumed",
  "grown",
  "takenPhoto",
]);
export const zPlantStatus = z.enum([
  "planted",
  "growing",
  "fully_grown",
  "dead",
  "halted_sun",
  "halted_shade",
  "halted_water",
]);
export const zMinigameType = z.enum(["simple_race", "deathmatch", "spleef"]);
const zT174 = z.object({});
const zT190 = z.enum(["waiting", "racing"]);
const zT200 = z.enum(["water"]);
const zT202 = z.enum(["fertilize"]);
const zT204 = z.enum(["harvest"]);
const zT206 = z.enum(["adminDestroy"]);
const zT208 = z.enum(["poke"]);
const zT214 = z.enum(["biomes-social"]);
const zT228 = z.enum(["box"]);
const zT230 = z.enum(["sphere"]);
export const zEntityRestoreToState = z.enum(["created", "deleted"]);
export const zStrings = zString.array().default([]);
export const zBiomesIdList = zBiomesId.array().default([]);
export const zBiomesIdSet = z.set(zBiomesId);
export const zVec2i = z.tuple([zI32, zI32]);
export const zVec3i = z.tuple([zI32, zI32, zI32]);
export const zVec4i = z.tuple([zI32, zI32, zI32, zI32]);
export const zVec2f = z.tuple([zF64, zF64]);
export const zVec3f = z.tuple([zF64, zF64, zF64]);
export const zVec4f = z.tuple([zF64, zF64, zF64, zF64]);
export const zMat3f = z.tuple([
  zF64,
  zF64,
  zF64,
  zF64,
  zF64,
  zF64,
  zF64,
  zF64,
  zF64,
]);
const zT29 = z.tuple([zI32, zI32, zI32]);
export const zOptionalBool = zBool.optional();
export const zOptionalI32 = zI32.optional();
export const zOptionalU32 = zU32.optional();
export const zOptionalI64 = zI64.optional();
export const zOptionalU64 = zU64.optional();
export const zOptionalF64 = zF64.optional();
export const zOptionalBiomesId = zBiomesId.optional();
export const zOptionalTensorBlob = zTensorBlob.optional();
export const zAppearance = z.object({
  skin_color_id: zString,
  eye_color_id: zString,
  hair_color_id: zString,
  head_id: zBiomesId,
});
export const zItemSlot = zItemAndCount.optional();
const zT48 = z.object({
  contents: zItemAndCount,
  price: zItemAndCount,
  seller_id: zBiomesId,
});
export const zOptionalItem = zItem.optional();
export const zOptionalItemAndCount = zItemAndCount.optional();
export const zItemSet = z.map(zString, zItem);
export const zItemBag = z.map(zString, zItemAndCount);
export const zItemAssignment = z.map(zBiomesId, zItem);
export const zItemAssignmentReference = z.object({
  key: zBiomesId,
});
export const zItemContainerReference = z.object({
  idx: zU16,
});
export const zItemBagReference = z.object({
  key: zString,
});
export const zOptionalMovementActionType = zMovementActionType.optional();
export const zOptionalEmoteType = zEmoteType.optional();
export const zOptionalShardId = zShardId.optional();
export const zOptionalString = zString.optional();
export const zOptionalBuffer = zBuffer.optional();
const zT92 = z.set(zBiomesId);
const zT93 = zF64.optional();
export const zNUXStatus = z.object({
  complete: zBool,
  state_id: zString,
});
export const zUserRoleSet = z.set(zUserRole);
const zT101 = z.set(zAclAction);
const zT117 = z.object({
  kind: zT116,
});
const zT119 = z.object({
  kind: zT118,
});
const zT121 = z.object({
  kind: zT120,
});
const zT123 = z.object({
  kind: zT122,
});
const zT126 = z.object({
  kind: zT125,
});
const zT128 = z.object({
  kind: zT127,
});
const zT130 = z.object({
  kind: zT129,
  biscuitId: zBiomesId,
});
const zT132 = z.object({
  kind: zT131,
  distance: zF64,
});
const zT136 = z.object({
  kind: zT135,
});
const zT138 = z.object({
  kind: zT137,
});
const zT140 = z.object({
  kind: zT139,
});
const zT142 = z.object({
  kind: zT141,
});
const zT144 = z.object({
  kind: zT143,
});
export const zOptionalAnimationRepeatKind = zAnimationRepeatKind.optional();
export const zChallengeStateMap = z.map(zBiomesId, zChallengeState);
export const zTriggerTrees = z.map(zBiomesId, zTriggerStateMap);
export const zChallengeTime = z.map(zBiomesId, zF64);
export const zTagRoundState = z.object({
  it_player: zBiomesId,
});
const zT175 = z.object({
  round_start: zF64,
});
const zT176 = z.object({
  round_end: zF64,
});
const zT177 = z.object({
  timestamp: zF64,
});
export const zSpleefPlayerStats = z.object({
  playerId: zBiomesId,
  rounds_won: zI32,
});
const zT188 = z.object({
  time: zF64,
});
export const zGiveMinigameKitData = z.discriminatedUnion("kind", [
  zT174.extend({ kind: z.literal("simple_race") }),
  zT174.extend({ kind: z.literal("deathmatch") }),
  zT174.extend({ kind: z.literal("spleef") }),
]);
const zT201 = z.object({
  kind: zT200,
  amount: zF32,
  timestamp: zF64,
});
const zT203 = z.object({
  kind: zT202,
  fertilizer: zItem,
  timestamp: zF64,
});
const zT205 = z.object({
  kind: zT204,
  timestamp: zF64,
});
const zT207 = z.object({
  kind: zT206,
  timestamp: zF64,
});
const zT209 = z.object({
  kind: zT208,
  timestamp: zF64,
});
export const zTeamMemberMetadata = z.object({
  joined_at: zF64,
});
export const zTeamInvite = z.object({
  inviter_id: zBiomesId,
  invitee_id: zBiomesId,
  created_at: zF64,
});
export const zTeamJoinRequest = z.object({
  entity_id: zBiomesId,
  created_at: zF64,
});
const zT231 = z.object({
  kind: zT230,
  radius: zF64,
});
export const zTradeSpec = z.object({
  trade_id: zBiomesId,
  id1: zBiomesId,
  id2: zBiomesId,
});
export const zOptionalMat3f = zMat3f.optional();
export const zVec3iList = zT29.array().default([]);
export const zBox2 = z.object({
  v0: zVec3f,
  v1: zVec3f,
});
export const zOptionalVec3f = zVec3f.optional();
export const zVec3fList = zVec3f.array().default([]);
export const zOptionalVec2f = zVec2f.optional();
export const zTerrainUpdate = z.tuple([zVec3i, zU32]);
export const zPricedItemSlot = zT48.optional();
export const zItemContainer = zItemSlot.array().default([]);
export const zOptionalItemBag = zItemBag.optional();
export const zOwnedItemReference = z.discriminatedUnion("kind", [
  zItemContainerReference.extend({ kind: z.literal("item") }),
  zItemContainerReference.extend({ kind: z.literal("hotbar") }),
  zItemBagReference.extend({ kind: z.literal("currency") }),
  zItemAssignmentReference.extend({ kind: z.literal("wearable") }),
]);
export const zEmoteFishingLinePhysicsPosition = z.object({
  velocity: zVec3f,
  gravity: zVec3f,
  start: zVec3f,
});
export const zEmoteFishingLineReelInPosition = z.object({
  start: zVec3f,
  duration: zF64,
});
export const zEmoteFishingLineFixedPosition = z.object({
  pos: zVec3f,
});
export const zWarpTarget = z.object({
  warp_to: zVec3f,
  orientation: zVec2f,
});
export const zEntitiesAndExpiry = z.object({
  entity_ids: zT92,
  expiry: zT93,
});
export const zAllNUXStatus = z.map(zI32, zNUXStatus);
const zT102 = z.tuple([zBiomesId, zT101]);
const zT104 = z.map(zUserRole, zT101);
const zT105 = z.map(zBiomesId, zT101);
export const zAabb = z.tuple([zVec3f, zVec3f]);
const zT112 = z.object({
  kind: zT111,
  point: zVec3f,
});
export const zNpcDamageSource = z.discriminatedUnion("kind", [
  zT117.extend({ kind: z.literal("dayNight") }),
  zT119.extend({ kind: z.literal("farFromHome") }),
  zT121.extend({ kind: z.literal("adminKill") }),
  zT123.extend({ kind: z.literal("outOfWorldBounds") }),
]);
export const zPlaceableAnimation = z.object({
  type: zPlaceableAnimationType,
  repeat: zOptionalAnimationRepeatKind,
  start_time: zF64,
});
export const zLifetimeStatsMap = z.map(zLifetimeStatsType, zItemBag);
export const zPositionBeamMap = z.map(zBiomesId, zVec2f);
export const zPlaceEventInfo = z.object({
  time: zF64,
  position: zVec3i,
});
export const zBuff = z.object({
  item_id: zBiomesId,
  start_time: zT93,
  from_id: zOptionalBiomesId,
  is_disabled: zOptionalBool,
});
export const zOptionalTagRoundState = zTagRoundState.optional();
const zT169 = z.object({
  checkpoint_ids: zBiomesIdSet,
  start_ids: zBiomesIdSet,
  end_ids: zBiomesIdSet,
});
const zT170 = z.object({
  start_ids: zBiomesIdSet,
});
const zT171 = z.object({
  start_ids: zBiomesIdSet,
  arena_marker_ids: zBiomesIdSet,
});
export const zDeathMatchPlayerState = z.object({
  playerId: zBiomesId,
  kills: zI32,
  deaths: zI32,
  last_kill: zOptionalF64,
  last_death: zOptionalF64,
});
const zT178 = z.discriminatedUnion("kind", [
  zT174.extend({ kind: z.literal("waiting_for_players") }),
  zT175.extend({ kind: z.literal("play_countdown") }),
  zT176.extend({ kind: z.literal("playing") }),
  zT177.extend({ kind: z.literal("finished") }),
]);
const zT183 = z.object({
  round_start: zF64,
  last_winner_id: zOptionalBiomesId,
});
const zT186 = z.map(zBiomesId, zSpleefPlayerStats);
export const zReachedCheckpoints = z.map(zBiomesId, zT188);
export const zFarmingPlayerAction = z.discriminatedUnion("kind", [
  zT201.extend({ kind: z.literal("water") }),
  zT203.extend({ kind: z.literal("fertilize") }),
  zT205.extend({ kind: z.literal("harvest") }),
  zT207.extend({ kind: z.literal("adminDestroy") }),
  zT209.extend({ kind: z.literal("poke") }),
]);
const zT212 = z.object({
  type_ids: zBiomesIdList,
});
export const zBucketedImageCloudBundle = z.object({
  webp_320w: zOptionalString,
  webp_640w: zOptionalString,
  webp_1280w: zOptionalString,
  png_1280w: zOptionalString,
  webp_original: zOptionalString,
  bucket: zT214,
});
export const zTerrainRestorationEntry = z.object({
  position_index: zU16,
  created_at: zF64,
  restore_time: zF64,
  terrain: zOptionalF64,
  placer: zOptionalF64,
  dye: zOptionalF64,
  shape: zOptionalF64,
});
export const zTeamPendingInvites = z.map(zBiomesId, zTeamInvite);
export const zTeamPendingRequests = zTeamJoinRequest.array().default([]);
export const zTeamMembers = z.map(zBiomesId, zTeamMemberMetadata);
const zT229 = z.object({
  kind: zT228,
  box: zVec3f,
});
export const zTradeSpecList = zTradeSpec.array().default([]);
export const zTerrainUpdateList = zTerrainUpdate.array().default([]);
export const zPricedItemContainer = zPricedItemSlot.array().default([]);
export const zOptionalOwnedItemReference = zOwnedItemReference.optional();
export const zOwnedItemReferenceList = zOwnedItemReference.array().default([]);
const zT64 = z.tuple([zOwnedItemReference, zItemAndCount]);
export const zEmoteFishingLineEndPosition = z.discriminatedUnion("kind", [
  zEmoteFishingLinePhysicsPosition.extend({ kind: z.literal("physics") }),
  zEmoteFishingLineReelInPosition.extend({ kind: z.literal("reel_in") }),
  zEmoteFishingLineFixedPosition.extend({ kind: z.literal("fixed") }),
]);
export const zEmoteThrowInfo = z.object({
  physics: zEmoteFishingLinePhysicsPosition,
  angular_velocity: zOptionalVec2f,
});
export const zOptionalWarpTarget = zWarpTarget.optional();
export const zGrabBagFilter = z.discriminatedUnion("kind", [
  zEntitiesAndExpiry.extend({ kind: z.literal("block") }),
  zEntitiesAndExpiry.extend({ kind: z.literal("only") }),
]);
export const zTargetedAcl = zT102.optional();
export const zOptionalAabb = zAabb.optional();
const zT110 = z.object({
  kind: zT109,
  aabb: zAabb,
});
const zT114 = z.object({
  kind: zT113,
  points: zVec3fList,
});
const zT134 = z.object({
  kind: zT133,
  attacker: zBiomesId,
  dir: zOptionalVec3f,
});
const zT146 = z.object({
  kind: zT145,
  type: zNpcDamageSource,
});
export const zOptionalPlaceableAnimation = zPlaceableAnimation.optional();
export const zOptionalPlaceEventInfo = zPlaceEventInfo.optional();
export const zBuffsList = zBuff.array().default([]);
export const zMinigameMetadata = z.discriminatedUnion("kind", [
  zT169.extend({ kind: z.literal("simple_race") }),
  zT170.extend({ kind: z.literal("deathmatch") }),
  zT171.extend({ kind: z.literal("spleef") }),
]);
const zT179 = zT178.optional();
const zT180 = z.map(zBiomesId, zDeathMatchPlayerState);
const zT184 = z.object({
  round_expires: zF64,
  alive_round_players: zBiomesIdSet,
  tag_round_state: zOptionalTagRoundState,
});
export const zSimpleRaceInstanceState = z.object({
  player_state: zT190,
  started_at: zF64,
  deaths: zI32,
  reached_checkpoints: zReachedCheckpoints,
  finished_at: zOptionalF64,
});
export const zMinigameInstanceActivePlayerInfo = z.object({
  entry_stash_id: zBiomesId,
  entry_position: zVec3f,
  entry_warped_to: zOptionalVec3f,
  entry_time: zF64,
});
const zT196 = z.object({
  box: zBox2,
  clipboard_entity_id: zBiomesId,
});
export const zFarmingPlayerActionList = zFarmingPlayerAction
  .array()
  .default([]);
export const zItemBuyerSpec = zT212.extend({
  kind: z.literal("item_types"),
});
export const zTerrainRestorationEntryList = zTerrainRestorationEntry
  .array()
  .default([]);
export const zVolume = z.discriminatedUnion("kind", [
  zT229.extend({ kind: z.literal("box") }),
  zT231.extend({ kind: z.literal("sphere") }),
]);
export const zInventoryAssignmentPattern = zT64.array().default([]);
const zT66 = zT64.array().default([]);
const zT76 = zEmoteFishingLineEndPosition.optional();
const zT80 = zEmoteThrowInfo.optional();
export const zAcl = z.object({
  everyone: zT101,
  roles: zT104,
  entities: zT105,
  teams: zT105,
  creator: zTargetedAcl,
  creatorTeam: zTargetedAcl,
});
export const zAclDomain = z.discriminatedUnion("kind", [
  zT110.extend({ kind: z.literal("aabb") }),
  zT112.extend({ kind: z.literal("point") }),
  zT114.extend({ kind: z.literal("points") }),
]);
export const zDamageSource = z.discriminatedUnion("kind", [
  zT126.extend({ kind: z.literal("suicide") }),
  zT128.extend({ kind: z.literal("despawnWand") }),
  zT130.extend({ kind: z.literal("block") }),
  zT132.extend({ kind: z.literal("fall") }),
  zT134.extend({ kind: z.literal("attack") }),
  zT136.extend({ kind: z.literal("drown") }),
  zT138.extend({ kind: z.literal("fire") }),
  zT140.extend({ kind: z.literal("fireDamage") }),
  zT142.extend({ kind: z.literal("fireHeal") }),
  zT144.extend({ kind: z.literal("heal") }),
  zT146.extend({ kind: z.literal("npc") }),
]);
export const zDeathmatchInstanceState = z.object({
  instance_state: zT179,
  player_states: zT180,
});
const zT185 = z.discriminatedUnion("kind", [
  zT174.extend({ kind: z.literal("waiting_for_players") }),
  zT183.extend({ kind: z.literal("round_countdown") }),
  zT184.extend({ kind: z.literal("playing_round") }),
]);
export const zMinigameInstanceActivePlayerMap = z.map(
  zBiomesId,
  zMinigameInstanceActivePlayerInfo
);
const zT197 = zT196.extend({
  kind: z.literal("aabb"),
});
export const zOptionalVolume = zVolume.optional();
export const zOptionalInventoryAssignmentPattern = zT66.optional();
export const zEmoteFishingInfo = z.object({
  line_end_position: zT76,
  line_end_item: zOptionalItem,
});
export const zOptionalEmoteThrowInfo = zT80.optional();
export const zOptionalDamageSource = zDamageSource.optional();
export const zSpleefInstanceState = z.object({
  instance_state: zT185,
  observer_spawn_points: zVec3fList,
  player_stats: zT186,
  round_number: zI32,
});
export const zMinigameInstanceSpaceClipboardInfo = z.object({
  region: zT197,
});
export const zProtectionParams = z.object({
  acl: zAcl,
});
export const zRestorationParams = z.object({
  acl: zAcl,
  restore_delay_s: zF64,
});
export const zTrader = z.object({
  id: zBiomesId,
  offer_assignment: zInventoryAssignmentPattern,
  accepted: zBool,
});
export const zOptionalEmoteFishingInfo = zEmoteFishingInfo.optional();
export const zMinigameInstanceState = z.discriminatedUnion("kind", [
  zSimpleRaceInstanceState.extend({ kind: z.literal("simple_race") }),
  zDeathmatchInstanceState.extend({ kind: z.literal("deathmatch") }),
  zSpleefInstanceState.extend({ kind: z.literal("spleef") }),
]);
export const zOptionalMinigameInstanceSpaceClipboardInfo =
  zMinigameInstanceSpaceClipboardInfo.optional();
export const zOptionalProtectionParams = zProtectionParams.optional();
export const zOptionalRestorationParams = zRestorationParams.optional();
export const zRichEmoteComponents = z.object({
  fishing_info: zOptionalEmoteFishingInfo,
  throw_info: zOptionalEmoteThrowInfo,
  item_override: zOptionalItem,
});
export const zOptionalRichEmoteComponents = zRichEmoteComponents.optional();

// ================
// Type definitions
// ================

export type Buffer = Uint8Array;
export type String = string;
export type Bool = boolean;
export type I8 = number;
export type I16 = number;
export type I32 = number;
export type I64 = bigint;
export type U8 = number;
export type U16 = number;
export type U32 = number;
export type U64 = bigint;
export type F32 = number;
export type F64 = number;
export type TensorBlob = string;
export type ConsumptionAction = "drink" | "eat";
export type EmoteType =
  | "attack1"
  | "attack2"
  | "destroy"
  | "place"
  | "applause"
  | "dance"
  | "drink"
  | "eat"
  | "flex"
  | "laugh"
  | "point"
  | "rock"
  | "sick"
  | "sit"
  | "splash"
  | "warp"
  | "warpHome"
  | "wave"
  | "fishingCastPull"
  | "fishingCastRelease"
  | "fishingIdle"
  | "fishingReel"
  | "fishingShow"
  | "diggingHand"
  | "diggingTool"
  | "watering"
  | "equip"
  | "unequip"
  | "sadness"
  | "depression"
  | "crying"
  | "shame"
  | "fear"
  | "terror"
  | "cowering"
  | "nervousness"
  | "surprise"
  | "shock"
  | "recoil"
  | "curiosity"
  | "thinking"
  | "confusion"
  | "uncertainty"
  | "embarrassment"
  | "shyness"
  | "boredom"
  | "impatience"
  | "annoyance"
  | "frustration"
  | "facepalm"
  | "anger"
  | "fury"
  | "threatening"
  | "determined"
  | "ready"
  | "tiredness"
  | "exhaustion"
  | "yawning"
  | "stretching"
  | "injury"
  | "limping"
  | "dizziness"
  | "shivering"
  | "relief"
  | "disgust"
  | "love"
  | "flirting"
  | "gratitude"
  | "apology"
  | "bow"
  | "salute"
  | "kneel"
  | "pray"
  | "meditate"
  | "surrender"
  | "beckon"
  | "stop"
  | "comeHere"
  | "hug"
  | "handshake"
  | "highFive"
  | "thumbsUp"
  | "thumbsDown"
  | "guard"
  | "block"
  | "taunt"
  | "stagger"
  | "knockdown"
  | "getUp"
  | "retreat"
  | "rally"
  | "victory"
  | "defeat"
  | "footTapping"
  | "scratchingHead"
  | "checkingEquipment"
  | "pacing"
  | "sighing"
  | "cleaningWeapon";
export type MovementActionType = "dodge" | "evade";
export type WarpHomeReason = "respawn" | "homestone" | "admin";
export type CameraMode =
  | "normal"
  | "selfie"
  | "fps"
  | "isometric"
  | "iso_ne"
  | "iso_nw"
  | "iso_sw"
  | "iso_se";
export type AclAction =
  | "shape"
  | "place"
  | "destroy"
  | "interact"
  | "administrate"
  | "createGroup"
  | "dump"
  | "placeCampsite"
  | "tillSoil"
  | "plantSeed"
  | "pvp"
  | "warp_from"
  | "apply_buffs"
  | "placeRobot"
  | "placeEphemeral"
  | "demuckerWand";
export type UserRole =
  | "employee"
  | "admin"
  | "advancedOptions"
  | "deleteGroup"
  | "highlightGroup"
  | "unplaceGroup"
  | "repairGroup"
  | "seeGremlins"
  | "seeNpcs"
  | "bless"
  | "give"
  | "flying"
  | "internalSync"
  | "export"
  | "groundskeeper"
  | "clone"
  | "apply"
  | "twoWayInbox"
  | "baker"
  | "farmingAdmin"
  | "oobNoCors"
  | "noClip";
type T109 = "aabb";
type T111 = "point";
type T113 = "points";
type T116 = "dayNight";
type T118 = "farFromHome";
type T120 = "adminKill";
type T122 = "outOfWorldBounds";
type T125 = "suicide";
type T127 = "despawnWand";
type T129 = "block";
type T131 = "fall";
type T133 = "attack";
type T135 = "drown";
type T137 = "fire";
type T139 = "fireDamage";
type T141 = "fireHeal";
type T143 = "heal";
type T145 = "npc";
export type PlaceableAnimationType = "open" | "close" | "play";
export type AnimationRepeatKind = "once" | "repeat";
export type ChallengeState =
  | "available"
  | "completed"
  | "in_progress"
  | "start";
export type LifetimeStatsType =
  | "collected"
  | "crafted"
  | "fished"
  | "mined"
  | "consumed"
  | "grown"
  | "takenPhoto";
export type PlantStatus =
  | "planted"
  | "growing"
  | "fully_grown"
  | "dead"
  | "halted_sun"
  | "halted_shade"
  | "halted_water";
export type MinigameType = "simple_race" | "deathmatch" | "spleef";
type T174 = {};
type T190 = "waiting" | "racing";
type T200 = "water";
type T202 = "fertilize";
type T204 = "harvest";
type T206 = "adminDestroy";
type T208 = "poke";
type T214 = "biomes-social";
type T228 = "box";
type T230 = "sphere";
export type EntityRestoreToState = "created" | "deleted";
export type Strings = string[];
export type BiomesIdList = BiomesId[];
export type BiomesIdSet = Set<BiomesId>;
export type Vec2i = [number, number];
export type Vec3i = [number, number, number];
export type Vec4i = [number, number, number, number];
export type Vec2f = [number, number];
export type Vec3f = [number, number, number];
export type Vec4f = [number, number, number, number];
export type Mat3f = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number
];
type T29 = [number, number, number];
export type OptionalBool = boolean | undefined;
export type OptionalI32 = number | undefined;
export type OptionalU32 = number | undefined;
export type OptionalI64 = bigint | undefined;
export type OptionalU64 = bigint | undefined;
export type OptionalF64 = number | undefined;
export type OptionalBiomesId = BiomesId | undefined;
export type OptionalTensorBlob = string | undefined;
export type Appearance = {
  skin_color_id: string;
  eye_color_id: string;
  hair_color_id: string;
  head_id: BiomesId;
};
export type ItemSlot = ItemAndCount | undefined;
type T48 = { contents: ItemAndCount; price: ItemAndCount; seller_id: BiomesId };
export type OptionalItem = Item | undefined;
export type OptionalItemAndCount = ItemAndCount | undefined;
export type ItemSet = Map<string, Item>;
export type ItemBag = Map<string, ItemAndCount>;
export type ItemAssignment = Map<BiomesId, Item>;
export type ItemAssignmentReference = { key: BiomesId };
export type ItemContainerReference = { idx: number };
export type ItemBagReference = { key: string };
export type OptionalMovementActionType = ("dodge" | "evade") | undefined;
export type OptionalEmoteType =
  | (
      | "attack1"
      | "attack2"
      | "destroy"
      | "place"
      | "applause"
      | "dance"
      | "drink"
      | "eat"
      | "flex"
      | "laugh"
      | "point"
      | "rock"
      | "sick"
      | "sit"
      | "splash"
      | "warp"
      | "warpHome"
      | "wave"
      | "fishingCastPull"
      | "fishingCastRelease"
      | "fishingIdle"
      | "fishingReel"
      | "fishingShow"
      | "diggingHand"
      | "diggingTool"
      | "watering"
      | "equip"
      | "unequip"
      | "sadness"
      | "depression"
      | "crying"
      | "shame"
      | "fear"
      | "terror"
      | "cowering"
      | "nervousness"
      | "surprise"
      | "shock"
      | "recoil"
      | "curiosity"
      | "thinking"
      | "confusion"
      | "uncertainty"
      | "embarrassment"
      | "shyness"
      | "boredom"
      | "impatience"
      | "annoyance"
      | "frustration"
      | "facepalm"
      | "anger"
      | "fury"
      | "threatening"
      | "determined"
      | "ready"
      | "tiredness"
      | "exhaustion"
      | "yawning"
      | "stretching"
      | "injury"
      | "limping"
      | "dizziness"
      | "shivering"
      | "relief"
      | "disgust"
      | "love"
      | "flirting"
      | "gratitude"
      | "apology"
      | "bow"
      | "salute"
      | "kneel"
      | "pray"
      | "meditate"
      | "surrender"
      | "beckon"
      | "stop"
      | "comeHere"
      | "hug"
      | "handshake"
      | "highFive"
      | "thumbsUp"
      | "thumbsDown"
      | "guard"
      | "block"
      | "taunt"
      | "stagger"
      | "knockdown"
      | "getUp"
      | "retreat"
      | "rally"
      | "victory"
      | "defeat"
      | "footTapping"
      | "scratchingHead"
      | "checkingEquipment"
      | "pacing"
      | "sighing"
      | "cleaningWeapon"
    )
  | undefined;
export type OptionalShardId = ShardId | undefined;
export type OptionalString = string | undefined;
export type OptionalBuffer = Uint8Array | undefined;
type T92 = Set<BiomesId>;
type T93 = number | undefined;
export type NUXStatus = { complete: boolean; state_id: string };
export type UserRoleSet = Set<
  | "employee"
  | "admin"
  | "advancedOptions"
  | "deleteGroup"
  | "highlightGroup"
  | "unplaceGroup"
  | "repairGroup"
  | "seeGremlins"
  | "seeNpcs"
  | "bless"
  | "give"
  | "flying"
  | "internalSync"
  | "export"
  | "groundskeeper"
  | "clone"
  | "apply"
  | "twoWayInbox"
  | "baker"
  | "farmingAdmin"
  | "oobNoCors"
  | "noClip"
>;
type T101 = Set<
  | "shape"
  | "place"
  | "destroy"
  | "interact"
  | "administrate"
  | "createGroup"
  | "dump"
  | "placeCampsite"
  | "tillSoil"
  | "plantSeed"
  | "pvp"
  | "warp_from"
  | "apply_buffs"
  | "placeRobot"
  | "placeEphemeral"
  | "demuckerWand"
>;
type T117 = { kind: "dayNight" };
type T119 = { kind: "farFromHome" };
type T121 = { kind: "adminKill" };
type T123 = { kind: "outOfWorldBounds" };
type T126 = { kind: "suicide" };
type T128 = { kind: "despawnWand" };
type T130 = { kind: "block"; biscuitId: BiomesId };
type T132 = { kind: "fall"; distance: number };
type T136 = { kind: "drown" };
type T138 = { kind: "fire" };
type T140 = { kind: "fireDamage" };
type T142 = { kind: "fireHeal" };
type T144 = { kind: "heal" };
export type OptionalAnimationRepeatKind = ("once" | "repeat") | undefined;
export type ChallengeStateMap = Map<
  BiomesId,
  "available" | "completed" | "in_progress" | "start"
>;
export type TriggerTrees = Map<BiomesId, TriggerStateMap>;
export type ChallengeTime = Map<BiomesId, number>;
export type TagRoundState = { it_player: BiomesId };
type T175 = { round_start: number };
type T176 = { round_end: number };
type T177 = { timestamp: number };
export type SpleefPlayerStats = { playerId: BiomesId; rounds_won: number };
type T188 = { time: number };
export type GiveMinigameKitData =
  | ({} & { kind: "simple_race" })
  | ({} & { kind: "deathmatch" })
  | ({} & { kind: "spleef" });
type T201 = { kind: "water"; amount: number; timestamp: number };
type T203 = { kind: "fertilize"; fertilizer: Item; timestamp: number };
type T205 = { kind: "harvest"; timestamp: number };
type T207 = { kind: "adminDestroy"; timestamp: number };
type T209 = { kind: "poke"; timestamp: number };
export type TeamMemberMetadata = { joined_at: number };
export type TeamInvite = {
  inviter_id: BiomesId;
  invitee_id: BiomesId;
  created_at: number;
};
export type TeamJoinRequest = { entity_id: BiomesId; created_at: number };
type T231 = { kind: "sphere"; radius: number };
export type TradeSpec = { trade_id: BiomesId; id1: BiomesId; id2: BiomesId };
export type OptionalMat3f =
  | [number, number, number, number, number, number, number, number, number]
  | undefined;
export type Vec3iList = [number, number, number][];
export type Box2 = {
  v0: [number, number, number];
  v1: [number, number, number];
};
export type OptionalVec3f = [number, number, number] | undefined;
export type Vec3fList = [number, number, number][];
export type OptionalVec2f = [number, number] | undefined;
export type TerrainUpdate = [[number, number, number], number];
export type PricedItemSlot =
  | { contents: ItemAndCount; price: ItemAndCount; seller_id: BiomesId }
  | undefined;
export type ItemContainer = (ItemAndCount | undefined)[];
export type OptionalItemBag = Map<string, ItemAndCount> | undefined;
export type OwnedItemReference =
  | ({ idx: number } & { kind: "item" })
  | ({ idx: number } & { kind: "hotbar" })
  | ({ key: string } & { kind: "currency" })
  | ({ key: BiomesId } & { kind: "wearable" });
export type EmoteFishingLinePhysicsPosition = {
  velocity: [number, number, number];
  gravity: [number, number, number];
  start: [number, number, number];
};
export type EmoteFishingLineReelInPosition = {
  start: [number, number, number];
  duration: number;
};
export type EmoteFishingLineFixedPosition = { pos: [number, number, number] };
export type WarpTarget = {
  warp_to: [number, number, number];
  orientation: [number, number];
};
export type EntitiesAndExpiry = {
  entity_ids: Set<BiomesId>;
  expiry: number | undefined;
};
export type AllNUXStatus = Map<number, { complete: boolean; state_id: string }>;
type T102 = [
  BiomesId,
  Set<
    | "shape"
    | "place"
    | "destroy"
    | "interact"
    | "administrate"
    | "createGroup"
    | "dump"
    | "placeCampsite"
    | "tillSoil"
    | "plantSeed"
    | "pvp"
    | "warp_from"
    | "apply_buffs"
    | "placeRobot"
    | "placeEphemeral"
    | "demuckerWand"
  >
];
type T104 = Map<
  | "employee"
  | "admin"
  | "advancedOptions"
  | "deleteGroup"
  | "highlightGroup"
  | "unplaceGroup"
  | "repairGroup"
  | "seeGremlins"
  | "seeNpcs"
  | "bless"
  | "give"
  | "flying"
  | "internalSync"
  | "export"
  | "groundskeeper"
  | "clone"
  | "apply"
  | "twoWayInbox"
  | "baker"
  | "farmingAdmin"
  | "oobNoCors"
  | "noClip",
  Set<
    | "shape"
    | "place"
    | "destroy"
    | "interact"
    | "administrate"
    | "createGroup"
    | "dump"
    | "placeCampsite"
    | "tillSoil"
    | "plantSeed"
    | "pvp"
    | "warp_from"
    | "apply_buffs"
    | "placeRobot"
    | "placeEphemeral"
    | "demuckerWand"
  >
>;
type T105 = Map<
  BiomesId,
  Set<
    | "shape"
    | "place"
    | "destroy"
    | "interact"
    | "administrate"
    | "createGroup"
    | "dump"
    | "placeCampsite"
    | "tillSoil"
    | "plantSeed"
    | "pvp"
    | "warp_from"
    | "apply_buffs"
    | "placeRobot"
    | "placeEphemeral"
    | "demuckerWand"
  >
>;
export type Aabb = [[number, number, number], [number, number, number]];
type T112 = { kind: "point"; point: [number, number, number] };
export type NpcDamageSource =
  | ({ kind: "dayNight" } & { kind: "dayNight" })
  | ({ kind: "farFromHome" } & { kind: "farFromHome" })
  | ({ kind: "adminKill" } & { kind: "adminKill" })
  | ({ kind: "outOfWorldBounds" } & { kind: "outOfWorldBounds" });
export type PlaceableAnimation = {
  type: "open" | "close" | "play";
  repeat: ("once" | "repeat") | undefined;
  start_time: number;
};
export type LifetimeStatsMap = Map<
  | "collected"
  | "crafted"
  | "fished"
  | "mined"
  | "consumed"
  | "grown"
  | "takenPhoto",
  Map<string, ItemAndCount>
>;
export type PositionBeamMap = Map<BiomesId, [number, number]>;
export type PlaceEventInfo = {
  time: number;
  position: [number, number, number];
};
export type Buff = {
  item_id: BiomesId;
  start_time: number | undefined;
  from_id: BiomesId | undefined;
  is_disabled: boolean | undefined;
};
export type OptionalTagRoundState = { it_player: BiomesId } | undefined;
type T169 = {
  checkpoint_ids: Set<BiomesId>;
  start_ids: Set<BiomesId>;
  end_ids: Set<BiomesId>;
};
type T170 = { start_ids: Set<BiomesId> };
type T171 = { start_ids: Set<BiomesId>; arena_marker_ids: Set<BiomesId> };
export type DeathMatchPlayerState = {
  playerId: BiomesId;
  kills: number;
  deaths: number;
  last_kill: number | undefined;
  last_death: number | undefined;
};
type T178 =
  | ({} & { kind: "waiting_for_players" })
  | ({ round_start: number } & { kind: "play_countdown" })
  | ({ round_end: number } & { kind: "playing" })
  | ({ timestamp: number } & { kind: "finished" });
type T183 = { round_start: number; last_winner_id: BiomesId | undefined };
type T186 = Map<BiomesId, { playerId: BiomesId; rounds_won: number }>;
export type ReachedCheckpoints = Map<BiomesId, { time: number }>;
export type FarmingPlayerAction =
  | ({ kind: "water"; amount: number; timestamp: number } & { kind: "water" })
  | ({ kind: "fertilize"; fertilizer: Item; timestamp: number } & {
      kind: "fertilize";
    })
  | ({ kind: "harvest"; timestamp: number } & { kind: "harvest" })
  | ({ kind: "adminDestroy"; timestamp: number } & { kind: "adminDestroy" })
  | ({ kind: "poke"; timestamp: number } & { kind: "poke" });
type T212 = { type_ids: BiomesId[] };
export type BucketedImageCloudBundle = {
  webp_320w: string | undefined;
  webp_640w: string | undefined;
  webp_1280w: string | undefined;
  png_1280w: string | undefined;
  webp_original: string | undefined;
  bucket: "biomes-social";
};
export type TerrainRestorationEntry = {
  position_index: number;
  created_at: number;
  restore_time: number;
  terrain: number | undefined;
  placer: number | undefined;
  dye: number | undefined;
  shape: number | undefined;
};
export type TeamPendingInvites = Map<
  BiomesId,
  { inviter_id: BiomesId; invitee_id: BiomesId; created_at: number }
>;
export type TeamPendingRequests = { entity_id: BiomesId; created_at: number }[];
export type TeamMembers = Map<BiomesId, { joined_at: number }>;
type T229 = { kind: "box"; box: [number, number, number] };
export type TradeSpecList = {
  trade_id: BiomesId;
  id1: BiomesId;
  id2: BiomesId;
}[];
export type TerrainUpdateList = [[number, number, number], number][];
export type PricedItemContainer = (
  | { contents: ItemAndCount; price: ItemAndCount; seller_id: BiomesId }
  | undefined
)[];
export type OptionalOwnedItemReference =
  | (
      | ({ idx: number } & { kind: "item" })
      | ({ idx: number } & { kind: "hotbar" })
      | ({ key: string } & { kind: "currency" })
      | ({ key: BiomesId } & { kind: "wearable" })
    )
  | undefined;
export type OwnedItemReferenceList = (
  | ({ idx: number } & { kind: "item" })
  | ({ idx: number } & { kind: "hotbar" })
  | ({ key: string } & { kind: "currency" })
  | ({ key: BiomesId } & { kind: "wearable" })
)[];
type T64 = [
  (
    | ({ idx: number } & { kind: "item" })
    | ({ idx: number } & { kind: "hotbar" })
    | ({ key: string } & { kind: "currency" })
    | ({ key: BiomesId } & { kind: "wearable" })
  ),
  ItemAndCount
];
export type EmoteFishingLineEndPosition =
  | ({
      velocity: [number, number, number];
      gravity: [number, number, number];
      start: [number, number, number];
    } & { kind: "physics" })
  | ({ start: [number, number, number]; duration: number } & {
      kind: "reel_in";
    })
  | ({ pos: [number, number, number] } & { kind: "fixed" });
export type EmoteThrowInfo = {
  physics: {
    velocity: [number, number, number];
    gravity: [number, number, number];
    start: [number, number, number];
  };
  angular_velocity: [number, number] | undefined;
};
export type OptionalWarpTarget =
  | { warp_to: [number, number, number]; orientation: [number, number] }
  | undefined;
export type GrabBagFilter =
  | ({ entity_ids: Set<BiomesId>; expiry: number | undefined } & {
      kind: "block";
    })
  | ({ entity_ids: Set<BiomesId>; expiry: number | undefined } & {
      kind: "only";
    });
export type TargetedAcl =
  | [
      BiomesId,
      Set<
        | "shape"
        | "place"
        | "destroy"
        | "interact"
        | "administrate"
        | "createGroup"
        | "dump"
        | "placeCampsite"
        | "tillSoil"
        | "plantSeed"
        | "pvp"
        | "warp_from"
        | "apply_buffs"
        | "placeRobot"
        | "placeEphemeral"
        | "demuckerWand"
      >
    ]
  | undefined;
export type OptionalAabb =
  | [[number, number, number], [number, number, number]]
  | undefined;
type T110 = {
  kind: "aabb";
  aabb: [[number, number, number], [number, number, number]];
};
type T114 = { kind: "points"; points: [number, number, number][] };
type T134 = {
  kind: "attack";
  attacker: BiomesId;
  dir: [number, number, number] | undefined;
};
type T146 = {
  kind: "npc";
  type:
    | ({ kind: "dayNight" } & { kind: "dayNight" })
    | ({ kind: "farFromHome" } & { kind: "farFromHome" })
    | ({ kind: "adminKill" } & { kind: "adminKill" })
    | ({ kind: "outOfWorldBounds" } & { kind: "outOfWorldBounds" });
};
export type OptionalPlaceableAnimation =
  | {
      type: "open" | "close" | "play";
      repeat: ("once" | "repeat") | undefined;
      start_time: number;
    }
  | undefined;
export type OptionalPlaceEventInfo =
  | { time: number; position: [number, number, number] }
  | undefined;
export type BuffsList = {
  item_id: BiomesId;
  start_time: number | undefined;
  from_id: BiomesId | undefined;
  is_disabled: boolean | undefined;
}[];
export type MinigameMetadata =
  | ({
      checkpoint_ids: Set<BiomesId>;
      start_ids: Set<BiomesId>;
      end_ids: Set<BiomesId>;
    } & { kind: "simple_race" })
  | ({ start_ids: Set<BiomesId> } & { kind: "deathmatch" })
  | ({ start_ids: Set<BiomesId>; arena_marker_ids: Set<BiomesId> } & {
      kind: "spleef";
    });
type T179 =
  | (
      | ({} & { kind: "waiting_for_players" })
      | ({ round_start: number } & { kind: "play_countdown" })
      | ({ round_end: number } & { kind: "playing" })
      | ({ timestamp: number } & { kind: "finished" })
    )
  | undefined;
type T180 = Map<
  BiomesId,
  {
    playerId: BiomesId;
    kills: number;
    deaths: number;
    last_kill: number | undefined;
    last_death: number | undefined;
  }
>;
type T184 = {
  round_expires: number;
  alive_round_players: Set<BiomesId>;
  tag_round_state: { it_player: BiomesId } | undefined;
};
export type SimpleRaceInstanceState = {
  player_state: "waiting" | "racing";
  started_at: number;
  deaths: number;
  reached_checkpoints: Map<BiomesId, { time: number }>;
  finished_at: number | undefined;
};
export type MinigameInstanceActivePlayerInfo = {
  entry_stash_id: BiomesId;
  entry_position: [number, number, number];
  entry_warped_to: [number, number, number] | undefined;
  entry_time: number;
};
type T196 = {
  box: { v0: [number, number, number]; v1: [number, number, number] };
  clipboard_entity_id: BiomesId;
};
export type FarmingPlayerActionList = (
  | ({ kind: "water"; amount: number; timestamp: number } & { kind: "water" })
  | ({ kind: "fertilize"; fertilizer: Item; timestamp: number } & {
      kind: "fertilize";
    })
  | ({ kind: "harvest"; timestamp: number } & { kind: "harvest" })
  | ({ kind: "adminDestroy"; timestamp: number } & { kind: "adminDestroy" })
  | ({ kind: "poke"; timestamp: number } & { kind: "poke" })
)[];
export type ItemBuyerSpec = { type_ids: BiomesId[] } & { kind: "item_types" };
export type TerrainRestorationEntryList = {
  position_index: number;
  created_at: number;
  restore_time: number;
  terrain: number | undefined;
  placer: number | undefined;
  dye: number | undefined;
  shape: number | undefined;
}[];
export type Volume =
  | ({ kind: "box"; box: [number, number, number] } & { kind: "box" })
  | ({ kind: "sphere"; radius: number } & { kind: "sphere" });
export type InventoryAssignmentPattern = [
  (
    | ({ idx: number } & { kind: "item" })
    | ({ idx: number } & { kind: "hotbar" })
    | ({ key: string } & { kind: "currency" })
    | ({ key: BiomesId } & { kind: "wearable" })
  ),
  ItemAndCount
][];
type T66 = [
  (
    | ({ idx: number } & { kind: "item" })
    | ({ idx: number } & { kind: "hotbar" })
    | ({ key: string } & { kind: "currency" })
    | ({ key: BiomesId } & { kind: "wearable" })
  ),
  ItemAndCount
][];
type T76 =
  | (
      | ({
          velocity: [number, number, number];
          gravity: [number, number, number];
          start: [number, number, number];
        } & { kind: "physics" })
      | ({ start: [number, number, number]; duration: number } & {
          kind: "reel_in";
        })
      | ({ pos: [number, number, number] } & { kind: "fixed" })
    )
  | undefined;
type T80 =
  | {
      physics: {
        velocity: [number, number, number];
        gravity: [number, number, number];
        start: [number, number, number];
      };
      angular_velocity: [number, number] | undefined;
    }
  | undefined;
export type Acl = {
  everyone: Set<
    | "shape"
    | "place"
    | "destroy"
    | "interact"
    | "administrate"
    | "createGroup"
    | "dump"
    | "placeCampsite"
    | "tillSoil"
    | "plantSeed"
    | "pvp"
    | "warp_from"
    | "apply_buffs"
    | "placeRobot"
    | "placeEphemeral"
    | "demuckerWand"
  >;
  roles: Map<
    | "employee"
    | "admin"
    | "advancedOptions"
    | "deleteGroup"
    | "highlightGroup"
    | "unplaceGroup"
    | "repairGroup"
    | "seeGremlins"
    | "seeNpcs"
    | "bless"
    | "give"
    | "flying"
    | "internalSync"
    | "export"
    | "groundskeeper"
    | "clone"
    | "apply"
    | "twoWayInbox"
    | "baker"
    | "farmingAdmin"
    | "oobNoCors"
    | "noClip",
    Set<
      | "shape"
      | "place"
      | "destroy"
      | "interact"
      | "administrate"
      | "createGroup"
      | "dump"
      | "placeCampsite"
      | "tillSoil"
      | "plantSeed"
      | "pvp"
      | "warp_from"
      | "apply_buffs"
      | "placeRobot"
      | "placeEphemeral"
      | "demuckerWand"
    >
  >;
  entities: Map<
    BiomesId,
    Set<
      | "shape"
      | "place"
      | "destroy"
      | "interact"
      | "administrate"
      | "createGroup"
      | "dump"
      | "placeCampsite"
      | "tillSoil"
      | "plantSeed"
      | "pvp"
      | "warp_from"
      | "apply_buffs"
      | "placeRobot"
      | "placeEphemeral"
      | "demuckerWand"
    >
  >;
  teams: Map<
    BiomesId,
    Set<
      | "shape"
      | "place"
      | "destroy"
      | "interact"
      | "administrate"
      | "createGroup"
      | "dump"
      | "placeCampsite"
      | "tillSoil"
      | "plantSeed"
      | "pvp"
      | "warp_from"
      | "apply_buffs"
      | "placeRobot"
      | "placeEphemeral"
      | "demuckerWand"
    >
  >;
  creator:
    | [
        BiomesId,
        Set<
          | "shape"
          | "place"
          | "destroy"
          | "interact"
          | "administrate"
          | "createGroup"
          | "dump"
          | "placeCampsite"
          | "tillSoil"
          | "plantSeed"
          | "pvp"
          | "warp_from"
          | "apply_buffs"
          | "placeRobot"
          | "placeEphemeral"
          | "demuckerWand"
        >
      ]
    | undefined;
  creatorTeam:
    | [
        BiomesId,
        Set<
          | "shape"
          | "place"
          | "destroy"
          | "interact"
          | "administrate"
          | "createGroup"
          | "dump"
          | "placeCampsite"
          | "tillSoil"
          | "plantSeed"
          | "pvp"
          | "warp_from"
          | "apply_buffs"
          | "placeRobot"
          | "placeEphemeral"
          | "demuckerWand"
        >
      ]
    | undefined;
};
export type AclDomain =
  | ({
      kind: "aabb";
      aabb: [[number, number, number], [number, number, number]];
    } & { kind: "aabb" })
  | ({ kind: "point"; point: [number, number, number] } & { kind: "point" })
  | ({ kind: "points"; points: [number, number, number][] } & {
      kind: "points";
    });
export type DamageSource =
  | ({ kind: "suicide" } & { kind: "suicide" })
  | ({ kind: "despawnWand" } & { kind: "despawnWand" })
  | ({ kind: "block"; biscuitId: BiomesId } & { kind: "block" })
  | ({ kind: "fall"; distance: number } & { kind: "fall" })
  | ({
      kind: "attack";
      attacker: BiomesId;
      dir: [number, number, number] | undefined;
    } & { kind: "attack" })
  | ({ kind: "drown" } & { kind: "drown" })
  | ({ kind: "fire" } & { kind: "fire" })
  | ({ kind: "fireDamage" } & { kind: "fireDamage" })
  | ({ kind: "fireHeal" } & { kind: "fireHeal" })
  | ({ kind: "heal" } & { kind: "heal" })
  | ({
      kind: "npc";
      type:
        | ({ kind: "dayNight" } & { kind: "dayNight" })
        | ({ kind: "farFromHome" } & { kind: "farFromHome" })
        | ({ kind: "adminKill" } & { kind: "adminKill" })
        | ({ kind: "outOfWorldBounds" } & { kind: "outOfWorldBounds" });
    } & { kind: "npc" });
export type DeathmatchInstanceState = {
  instance_state:
    | (
        | ({} & { kind: "waiting_for_players" })
        | ({ round_start: number } & { kind: "play_countdown" })
        | ({ round_end: number } & { kind: "playing" })
        | ({ timestamp: number } & { kind: "finished" })
      )
    | undefined;
  player_states: Map<
    BiomesId,
    {
      playerId: BiomesId;
      kills: number;
      deaths: number;
      last_kill: number | undefined;
      last_death: number | undefined;
    }
  >;
};
type T185 =
  | ({} & { kind: "waiting_for_players" })
  | ({ round_start: number; last_winner_id: BiomesId | undefined } & {
      kind: "round_countdown";
    })
  | ({
      round_expires: number;
      alive_round_players: Set<BiomesId>;
      tag_round_state: { it_player: BiomesId } | undefined;
    } & { kind: "playing_round" });
export type MinigameInstanceActivePlayerMap = Map<
  BiomesId,
  {
    entry_stash_id: BiomesId;
    entry_position: [number, number, number];
    entry_warped_to: [number, number, number] | undefined;
    entry_time: number;
  }
>;
type T197 = {
  box: { v0: [number, number, number]; v1: [number, number, number] };
  clipboard_entity_id: BiomesId;
} & { kind: "aabb" };
export type OptionalVolume =
  | (
      | ({ kind: "box"; box: [number, number, number] } & { kind: "box" })
      | ({ kind: "sphere"; radius: number } & { kind: "sphere" })
    )
  | undefined;
export type OptionalInventoryAssignmentPattern =
  | [
      (
        | ({ idx: number } & { kind: "item" })
        | ({ idx: number } & { kind: "hotbar" })
        | ({ key: string } & { kind: "currency" })
        | ({ key: BiomesId } & { kind: "wearable" })
      ),
      ItemAndCount
    ][]
  | undefined;
export type EmoteFishingInfo = {
  line_end_position:
    | (
        | ({
            velocity: [number, number, number];
            gravity: [number, number, number];
            start: [number, number, number];
          } & { kind: "physics" })
        | ({ start: [number, number, number]; duration: number } & {
            kind: "reel_in";
          })
        | ({ pos: [number, number, number] } & { kind: "fixed" })
      )
    | undefined;
  line_end_item: Item | undefined;
};
export type OptionalEmoteThrowInfo =
  | (
      | {
          physics: {
            velocity: [number, number, number];
            gravity: [number, number, number];
            start: [number, number, number];
          };
          angular_velocity: [number, number] | undefined;
        }
      | undefined
    )
  | undefined;
export type OptionalDamageSource =
  | (
      | ({ kind: "suicide" } & { kind: "suicide" })
      | ({ kind: "despawnWand" } & { kind: "despawnWand" })
      | ({ kind: "block"; biscuitId: BiomesId } & { kind: "block" })
      | ({ kind: "fall"; distance: number } & { kind: "fall" })
      | ({
          kind: "attack";
          attacker: BiomesId;
          dir: [number, number, number] | undefined;
        } & { kind: "attack" })
      | ({ kind: "drown" } & { kind: "drown" })
      | ({ kind: "fire" } & { kind: "fire" })
      | ({ kind: "fireDamage" } & { kind: "fireDamage" })
      | ({ kind: "fireHeal" } & { kind: "fireHeal" })
      | ({ kind: "heal" } & { kind: "heal" })
      | ({
          kind: "npc";
          type:
            | ({ kind: "dayNight" } & { kind: "dayNight" })
            | ({ kind: "farFromHome" } & { kind: "farFromHome" })
            | ({ kind: "adminKill" } & { kind: "adminKill" })
            | ({ kind: "outOfWorldBounds" } & { kind: "outOfWorldBounds" });
        } & { kind: "npc" })
    )
  | undefined;
export type SpleefInstanceState = {
  instance_state:
    | ({} & { kind: "waiting_for_players" })
    | ({ round_start: number; last_winner_id: BiomesId | undefined } & {
        kind: "round_countdown";
      })
    | ({
        round_expires: number;
        alive_round_players: Set<BiomesId>;
        tag_round_state: { it_player: BiomesId } | undefined;
      } & { kind: "playing_round" });
  observer_spawn_points: [number, number, number][];
  player_stats: Map<BiomesId, { playerId: BiomesId; rounds_won: number }>;
  round_number: number;
};
export type MinigameInstanceSpaceClipboardInfo = {
  region: {
    box: { v0: [number, number, number]; v1: [number, number, number] };
    clipboard_entity_id: BiomesId;
  } & { kind: "aabb" };
};
export type ProtectionParams = {
  acl: {
    everyone: Set<
      | "shape"
      | "place"
      | "destroy"
      | "interact"
      | "administrate"
      | "createGroup"
      | "dump"
      | "placeCampsite"
      | "tillSoil"
      | "plantSeed"
      | "pvp"
      | "warp_from"
      | "apply_buffs"
      | "placeRobot"
      | "placeEphemeral"
      | "demuckerWand"
    >;
    roles: Map<
      | "employee"
      | "admin"
      | "advancedOptions"
      | "deleteGroup"
      | "highlightGroup"
      | "unplaceGroup"
      | "repairGroup"
      | "seeGremlins"
      | "seeNpcs"
      | "bless"
      | "give"
      | "flying"
      | "internalSync"
      | "export"
      | "groundskeeper"
      | "clone"
      | "apply"
      | "twoWayInbox"
      | "baker"
      | "farmingAdmin"
      | "oobNoCors"
      | "noClip",
      Set<
        | "shape"
        | "place"
        | "destroy"
        | "interact"
        | "administrate"
        | "createGroup"
        | "dump"
        | "placeCampsite"
        | "tillSoil"
        | "plantSeed"
        | "pvp"
        | "warp_from"
        | "apply_buffs"
        | "placeRobot"
        | "placeEphemeral"
        | "demuckerWand"
      >
    >;
    entities: Map<
      BiomesId,
      Set<
        | "shape"
        | "place"
        | "destroy"
        | "interact"
        | "administrate"
        | "createGroup"
        | "dump"
        | "placeCampsite"
        | "tillSoil"
        | "plantSeed"
        | "pvp"
        | "warp_from"
        | "apply_buffs"
        | "placeRobot"
        | "placeEphemeral"
        | "demuckerWand"
      >
    >;
    teams: Map<
      BiomesId,
      Set<
        | "shape"
        | "place"
        | "destroy"
        | "interact"
        | "administrate"
        | "createGroup"
        | "dump"
        | "placeCampsite"
        | "tillSoil"
        | "plantSeed"
        | "pvp"
        | "warp_from"
        | "apply_buffs"
        | "placeRobot"
        | "placeEphemeral"
        | "demuckerWand"
      >
    >;
    creator:
      | [
          BiomesId,
          Set<
            | "shape"
            | "place"
            | "destroy"
            | "interact"
            | "administrate"
            | "createGroup"
            | "dump"
            | "placeCampsite"
            | "tillSoil"
            | "plantSeed"
            | "pvp"
            | "warp_from"
            | "apply_buffs"
            | "placeRobot"
            | "placeEphemeral"
            | "demuckerWand"
          >
        ]
      | undefined;
    creatorTeam:
      | [
          BiomesId,
          Set<
            | "shape"
            | "place"
            | "destroy"
            | "interact"
            | "administrate"
            | "createGroup"
            | "dump"
            | "placeCampsite"
            | "tillSoil"
            | "plantSeed"
            | "pvp"
            | "warp_from"
            | "apply_buffs"
            | "placeRobot"
            | "placeEphemeral"
            | "demuckerWand"
          >
        ]
      | undefined;
  };
};
export type RestorationParams = {
  acl: {
    everyone: Set<
      | "shape"
      | "place"
      | "destroy"
      | "interact"
      | "administrate"
      | "createGroup"
      | "dump"
      | "placeCampsite"
      | "tillSoil"
      | "plantSeed"
      | "pvp"
      | "warp_from"
      | "apply_buffs"
      | "placeRobot"
      | "placeEphemeral"
      | "demuckerWand"
    >;
    roles: Map<
      | "employee"
      | "admin"
      | "advancedOptions"
      | "deleteGroup"
      | "highlightGroup"
      | "unplaceGroup"
      | "repairGroup"
      | "seeGremlins"
      | "seeNpcs"
      | "bless"
      | "give"
      | "flying"
      | "internalSync"
      | "export"
      | "groundskeeper"
      | "clone"
      | "apply"
      | "twoWayInbox"
      | "baker"
      | "farmingAdmin"
      | "oobNoCors"
      | "noClip",
      Set<
        | "shape"
        | "place"
        | "destroy"
        | "interact"
        | "administrate"
        | "createGroup"
        | "dump"
        | "placeCampsite"
        | "tillSoil"
        | "plantSeed"
        | "pvp"
        | "warp_from"
        | "apply_buffs"
        | "placeRobot"
        | "placeEphemeral"
        | "demuckerWand"
      >
    >;
    entities: Map<
      BiomesId,
      Set<
        | "shape"
        | "place"
        | "destroy"
        | "interact"
        | "administrate"
        | "createGroup"
        | "dump"
        | "placeCampsite"
        | "tillSoil"
        | "plantSeed"
        | "pvp"
        | "warp_from"
        | "apply_buffs"
        | "placeRobot"
        | "placeEphemeral"
        | "demuckerWand"
      >
    >;
    teams: Map<
      BiomesId,
      Set<
        | "shape"
        | "place"
        | "destroy"
        | "interact"
        | "administrate"
        | "createGroup"
        | "dump"
        | "placeCampsite"
        | "tillSoil"
        | "plantSeed"
        | "pvp"
        | "warp_from"
        | "apply_buffs"
        | "placeRobot"
        | "placeEphemeral"
        | "demuckerWand"
      >
    >;
    creator:
      | [
          BiomesId,
          Set<
            | "shape"
            | "place"
            | "destroy"
            | "interact"
            | "administrate"
            | "createGroup"
            | "dump"
            | "placeCampsite"
            | "tillSoil"
            | "plantSeed"
            | "pvp"
            | "warp_from"
            | "apply_buffs"
            | "placeRobot"
            | "placeEphemeral"
            | "demuckerWand"
          >
        ]
      | undefined;
    creatorTeam:
      | [
          BiomesId,
          Set<
            | "shape"
            | "place"
            | "destroy"
            | "interact"
            | "administrate"
            | "createGroup"
            | "dump"
            | "placeCampsite"
            | "tillSoil"
            | "plantSeed"
            | "pvp"
            | "warp_from"
            | "apply_buffs"
            | "placeRobot"
            | "placeEphemeral"
            | "demuckerWand"
          >
        ]
      | undefined;
  };
  restore_delay_s: number;
};
export type Trader = {
  id: BiomesId;
  offer_assignment: [
    (
      | ({ idx: number } & { kind: "item" })
      | ({ idx: number } & { kind: "hotbar" })
      | ({ key: string } & { kind: "currency" })
      | ({ key: BiomesId } & { kind: "wearable" })
    ),
    ItemAndCount
  ][];
  accepted: boolean;
};
export type OptionalEmoteFishingInfo =
  | {
      line_end_position:
        | (
            | ({
                velocity: [number, number, number];
                gravity: [number, number, number];
                start: [number, number, number];
              } & { kind: "physics" })
            | ({ start: [number, number, number]; duration: number } & {
                kind: "reel_in";
              })
            | ({ pos: [number, number, number] } & { kind: "fixed" })
          )
        | undefined;
      line_end_item: Item | undefined;
    }
  | undefined;
export type MinigameInstanceState =
  | ({
      player_state: "waiting" | "racing";
      started_at: number;
      deaths: number;
      reached_checkpoints: Map<BiomesId, { time: number }>;
      finished_at: number | undefined;
    } & { kind: "simple_race" })
  | ({
      instance_state:
        | (
            | ({} & { kind: "waiting_for_players" })
            | ({ round_start: number } & { kind: "play_countdown" })
            | ({ round_end: number } & { kind: "playing" })
            | ({ timestamp: number } & { kind: "finished" })
          )
        | undefined;
      player_states: Map<
        BiomesId,
        {
          playerId: BiomesId;
          kills: number;
          deaths: number;
          last_kill: number | undefined;
          last_death: number | undefined;
        }
      >;
    } & { kind: "deathmatch" })
  | ({
      instance_state:
        | ({} & { kind: "waiting_for_players" })
        | ({ round_start: number; last_winner_id: BiomesId | undefined } & {
            kind: "round_countdown";
          })
        | ({
            round_expires: number;
            alive_round_players: Set<BiomesId>;
            tag_round_state: { it_player: BiomesId } | undefined;
          } & { kind: "playing_round" });
      observer_spawn_points: [number, number, number][];
      player_stats: Map<BiomesId, { playerId: BiomesId; rounds_won: number }>;
      round_number: number;
    } & { kind: "spleef" });
export type OptionalMinigameInstanceSpaceClipboardInfo =
  | {
      region: {
        box: { v0: [number, number, number]; v1: [number, number, number] };
        clipboard_entity_id: BiomesId;
      } & { kind: "aabb" };
    }
  | undefined;
export type OptionalProtectionParams =
  | {
      acl: {
        everyone: Set<
          | "shape"
          | "place"
          | "destroy"
          | "interact"
          | "administrate"
          | "createGroup"
          | "dump"
          | "placeCampsite"
          | "tillSoil"
          | "plantSeed"
          | "pvp"
          | "warp_from"
          | "apply_buffs"
          | "placeRobot"
          | "placeEphemeral"
          | "demuckerWand"
        >;
        roles: Map<
          | "employee"
          | "admin"
          | "advancedOptions"
          | "deleteGroup"
          | "highlightGroup"
          | "unplaceGroup"
          | "repairGroup"
          | "seeGremlins"
          | "seeNpcs"
          | "bless"
          | "give"
          | "flying"
          | "internalSync"
          | "export"
          | "groundskeeper"
          | "clone"
          | "apply"
          | "twoWayInbox"
          | "baker"
          | "farmingAdmin"
          | "oobNoCors"
          | "noClip",
          Set<
            | "shape"
            | "place"
            | "destroy"
            | "interact"
            | "administrate"
            | "createGroup"
            | "dump"
            | "placeCampsite"
            | "tillSoil"
            | "plantSeed"
            | "pvp"
            | "warp_from"
            | "apply_buffs"
            | "placeRobot"
            | "placeEphemeral"
            | "demuckerWand"
          >
        >;
        entities: Map<
          BiomesId,
          Set<
            | "shape"
            | "place"
            | "destroy"
            | "interact"
            | "administrate"
            | "createGroup"
            | "dump"
            | "placeCampsite"
            | "tillSoil"
            | "plantSeed"
            | "pvp"
            | "warp_from"
            | "apply_buffs"
            | "placeRobot"
            | "placeEphemeral"
            | "demuckerWand"
          >
        >;
        teams: Map<
          BiomesId,
          Set<
            | "shape"
            | "place"
            | "destroy"
            | "interact"
            | "administrate"
            | "createGroup"
            | "dump"
            | "placeCampsite"
            | "tillSoil"
            | "plantSeed"
            | "pvp"
            | "warp_from"
            | "apply_buffs"
            | "placeRobot"
            | "placeEphemeral"
            | "demuckerWand"
          >
        >;
        creator:
          | [
              BiomesId,
              Set<
                | "shape"
                | "place"
                | "destroy"
                | "interact"
                | "administrate"
                | "createGroup"
                | "dump"
                | "placeCampsite"
                | "tillSoil"
                | "plantSeed"
                | "pvp"
                | "warp_from"
                | "apply_buffs"
                | "placeRobot"
                | "placeEphemeral"
                | "demuckerWand"
              >
            ]
          | undefined;
        creatorTeam:
          | [
              BiomesId,
              Set<
                | "shape"
                | "place"
                | "destroy"
                | "interact"
                | "administrate"
                | "createGroup"
                | "dump"
                | "placeCampsite"
                | "tillSoil"
                | "plantSeed"
                | "pvp"
                | "warp_from"
                | "apply_buffs"
                | "placeRobot"
                | "placeEphemeral"
                | "demuckerWand"
              >
            ]
          | undefined;
      };
    }
  | undefined;
export type OptionalRestorationParams =
  | {
      acl: {
        everyone: Set<
          | "shape"
          | "place"
          | "destroy"
          | "interact"
          | "administrate"
          | "createGroup"
          | "dump"
          | "placeCampsite"
          | "tillSoil"
          | "plantSeed"
          | "pvp"
          | "warp_from"
          | "apply_buffs"
          | "placeRobot"
          | "placeEphemeral"
          | "demuckerWand"
        >;
        roles: Map<
          | "employee"
          | "admin"
          | "advancedOptions"
          | "deleteGroup"
          | "highlightGroup"
          | "unplaceGroup"
          | "repairGroup"
          | "seeGremlins"
          | "seeNpcs"
          | "bless"
          | "give"
          | "flying"
          | "internalSync"
          | "export"
          | "groundskeeper"
          | "clone"
          | "apply"
          | "twoWayInbox"
          | "baker"
          | "farmingAdmin"
          | "oobNoCors"
          | "noClip",
          Set<
            | "shape"
            | "place"
            | "destroy"
            | "interact"
            | "administrate"
            | "createGroup"
            | "dump"
            | "placeCampsite"
            | "tillSoil"
            | "plantSeed"
            | "pvp"
            | "warp_from"
            | "apply_buffs"
            | "placeRobot"
            | "placeEphemeral"
            | "demuckerWand"
          >
        >;
        entities: Map<
          BiomesId,
          Set<
            | "shape"
            | "place"
            | "destroy"
            | "interact"
            | "administrate"
            | "createGroup"
            | "dump"
            | "placeCampsite"
            | "tillSoil"
            | "plantSeed"
            | "pvp"
            | "warp_from"
            | "apply_buffs"
            | "placeRobot"
            | "placeEphemeral"
            | "demuckerWand"
          >
        >;
        teams: Map<
          BiomesId,
          Set<
            | "shape"
            | "place"
            | "destroy"
            | "interact"
            | "administrate"
            | "createGroup"
            | "dump"
            | "placeCampsite"
            | "tillSoil"
            | "plantSeed"
            | "pvp"
            | "warp_from"
            | "apply_buffs"
            | "placeRobot"
            | "placeEphemeral"
            | "demuckerWand"
          >
        >;
        creator:
          | [
              BiomesId,
              Set<
                | "shape"
                | "place"
                | "destroy"
                | "interact"
                | "administrate"
                | "createGroup"
                | "dump"
                | "placeCampsite"
                | "tillSoil"
                | "plantSeed"
                | "pvp"
                | "warp_from"
                | "apply_buffs"
                | "placeRobot"
                | "placeEphemeral"
                | "demuckerWand"
              >
            ]
          | undefined;
        creatorTeam:
          | [
              BiomesId,
              Set<
                | "shape"
                | "place"
                | "destroy"
                | "interact"
                | "administrate"
                | "createGroup"
                | "dump"
                | "placeCampsite"
                | "tillSoil"
                | "plantSeed"
                | "pvp"
                | "warp_from"
                | "apply_buffs"
                | "placeRobot"
                | "placeEphemeral"
                | "demuckerWand"
              >
            ]
          | undefined;
      };
      restore_delay_s: number;
    }
  | undefined;
export type RichEmoteComponents = {
  fishing_info:
    | {
        line_end_position:
          | (
              | ({
                  velocity: [number, number, number];
                  gravity: [number, number, number];
                  start: [number, number, number];
                } & { kind: "physics" })
              | ({ start: [number, number, number]; duration: number } & {
                  kind: "reel_in";
                })
              | ({ pos: [number, number, number] } & { kind: "fixed" })
            )
          | undefined;
        line_end_item: Item | undefined;
      }
    | undefined;
  throw_info:
    | (
        | {
            physics: {
              velocity: [number, number, number];
              gravity: [number, number, number];
              start: [number, number, number];
            };
            angular_velocity: [number, number] | undefined;
          }
        | undefined
      )
    | undefined;
  item_override: Item | undefined;
};
export type OptionalRichEmoteComponents =
  | {
      fishing_info:
        | {
            line_end_position:
              | (
                  | ({
                      velocity: [number, number, number];
                      gravity: [number, number, number];
                      start: [number, number, number];
                    } & { kind: "physics" })
                  | ({ start: [number, number, number]; duration: number } & {
                      kind: "reel_in";
                    })
                  | ({ pos: [number, number, number] } & { kind: "fixed" })
                )
              | undefined;
            line_end_item: Item | undefined;
          }
        | undefined;
      throw_info:
        | (
            | {
                physics: {
                  velocity: [number, number, number];
                  gravity: [number, number, number];
                  start: [number, number, number];
                };
                angular_velocity: [number, number] | undefined;
              }
            | undefined
          )
        | undefined;
      item_override: Item | undefined;
    }
  | undefined;

export type ReadonlyBuffer = Uint8Array;
export type ReadonlyString = string;
export type ReadonlyBool = boolean;
export type ReadonlyI8 = number;
export type ReadonlyI16 = number;
export type ReadonlyI32 = number;
export type ReadonlyI64 = bigint;
export type ReadonlyU8 = number;
export type ReadonlyU16 = number;
export type ReadonlyU32 = number;
export type ReadonlyU64 = bigint;
export type ReadonlyF32 = number;
export type ReadonlyF64 = number;
export type ReadonlyTensorBlob = string;
export type ReadonlyConsumptionAction = "drink" | "eat";
export type ReadonlyEmoteType =
  | "attack1"
  | "attack2"
  | "destroy"
  | "place"
  | "applause"
  | "dance"
  | "drink"
  | "eat"
  | "flex"
  | "laugh"
  | "point"
  | "rock"
  | "sick"
  | "sit"
  | "splash"
  | "warp"
  | "warpHome"
  | "wave"
  | "fishingCastPull"
  | "fishingCastRelease"
  | "fishingIdle"
  | "fishingReel"
  | "fishingShow"
  | "diggingHand"
  | "diggingTool"
  | "watering"
  | "equip"
  | "unequip"
  | "sadness"
  | "depression"
  | "crying"
  | "shame"
  | "fear"
  | "terror"
  | "cowering"
  | "nervousness"
  | "surprise"
  | "shock"
  | "recoil"
  | "curiosity"
  | "thinking"
  | "confusion"
  | "uncertainty"
  | "embarrassment"
  | "shyness"
  | "boredom"
  | "impatience"
  | "annoyance"
  | "frustration"
  | "facepalm"
  | "anger"
  | "fury"
  | "threatening"
  | "determined"
  | "ready"
  | "tiredness"
  | "exhaustion"
  | "yawning"
  | "stretching"
  | "injury"
  | "limping"
  | "dizziness"
  | "shivering"
  | "relief"
  | "disgust"
  | "love"
  | "flirting"
  | "gratitude"
  | "apology"
  | "bow"
  | "salute"
  | "kneel"
  | "pray"
  | "meditate"
  | "surrender"
  | "beckon"
  | "stop"
  | "comeHere"
  | "hug"
  | "handshake"
  | "highFive"
  | "thumbsUp"
  | "thumbsDown"
  | "guard"
  | "block"
  | "taunt"
  | "stagger"
  | "knockdown"
  | "getUp"
  | "retreat"
  | "rally"
  | "victory"
  | "defeat"
  | "footTapping"
  | "scratchingHead"
  | "checkingEquipment"
  | "pacing"
  | "sighing"
  | "cleaningWeapon";
export type ReadonlyMovementActionType = "dodge" | "evade";
export type ReadonlyWarpHomeReason = "respawn" | "homestone" | "admin";
export type ReadonlyCameraMode =
  | "normal"
  | "selfie"
  | "fps"
  | "isometric"
  | "iso_ne"
  | "iso_nw"
  | "iso_sw"
  | "iso_se";
export type ReadonlyAclAction =
  | "shape"
  | "place"
  | "destroy"
  | "interact"
  | "administrate"
  | "createGroup"
  | "dump"
  | "placeCampsite"
  | "tillSoil"
  | "plantSeed"
  | "pvp"
  | "warp_from"
  | "apply_buffs"
  | "placeRobot"
  | "placeEphemeral"
  | "demuckerWand";
export type ReadonlyUserRole =
  | "employee"
  | "admin"
  | "advancedOptions"
  | "deleteGroup"
  | "highlightGroup"
  | "unplaceGroup"
  | "repairGroup"
  | "seeGremlins"
  | "seeNpcs"
  | "bless"
  | "give"
  | "flying"
  | "internalSync"
  | "export"
  | "groundskeeper"
  | "clone"
  | "apply"
  | "twoWayInbox"
  | "baker"
  | "farmingAdmin"
  | "oobNoCors"
  | "noClip";
type ReadonlyT109 = "aabb";
type ReadonlyT111 = "point";
type ReadonlyT113 = "points";
type ReadonlyT116 = "dayNight";
type ReadonlyT118 = "farFromHome";
type ReadonlyT120 = "adminKill";
type ReadonlyT122 = "outOfWorldBounds";
type ReadonlyT125 = "suicide";
type ReadonlyT127 = "despawnWand";
type ReadonlyT129 = "block";
type ReadonlyT131 = "fall";
type ReadonlyT133 = "attack";
type ReadonlyT135 = "drown";
type ReadonlyT137 = "fire";
type ReadonlyT139 = "fireDamage";
type ReadonlyT141 = "fireHeal";
type ReadonlyT143 = "heal";
type ReadonlyT145 = "npc";
export type ReadonlyPlaceableAnimationType = "open" | "close" | "play";
export type ReadonlyAnimationRepeatKind = "once" | "repeat";
export type ReadonlyChallengeState =
  | "available"
  | "completed"
  | "in_progress"
  | "start";
export type ReadonlyLifetimeStatsType =
  | "collected"
  | "crafted"
  | "fished"
  | "mined"
  | "consumed"
  | "grown"
  | "takenPhoto";
export type ReadonlyPlantStatus =
  | "planted"
  | "growing"
  | "fully_grown"
  | "dead"
  | "halted_sun"
  | "halted_shade"
  | "halted_water";
export type ReadonlyMinigameType = "simple_race" | "deathmatch" | "spleef";
type ReadonlyT174 = {};
type ReadonlyT190 = "waiting" | "racing";
type ReadonlyT200 = "water";
type ReadonlyT202 = "fertilize";
type ReadonlyT204 = "harvest";
type ReadonlyT206 = "adminDestroy";
type ReadonlyT208 = "poke";
type ReadonlyT214 = "biomes-social";
type ReadonlyT228 = "box";
type ReadonlyT230 = "sphere";
export type ReadonlyEntityRestoreToState = "created" | "deleted";
export type ReadonlyStrings = ReadonlyArray<string>;
export type ReadonlyBiomesIdList = ReadonlyArray<ReadonlyBiomesId>;
export type ReadonlyBiomesIdSet = ReadonlySet<ReadonlyBiomesId>;
export type ReadonlyVec2i = readonly [number, number];
export type ReadonlyVec3i = readonly [number, number, number];
export type ReadonlyVec4i = readonly [number, number, number, number];
export type ReadonlyVec2f = readonly [number, number];
export type ReadonlyVec3f = readonly [number, number, number];
export type ReadonlyVec4f = readonly [number, number, number, number];
export type ReadonlyMat3f = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number
];
type ReadonlyT29 = readonly [number, number, number];
export type ReadonlyOptionalBool = boolean | undefined;
export type ReadonlyOptionalI32 = number | undefined;
export type ReadonlyOptionalU32 = number | undefined;
export type ReadonlyOptionalI64 = bigint | undefined;
export type ReadonlyOptionalU64 = bigint | undefined;
export type ReadonlyOptionalF64 = number | undefined;
export type ReadonlyOptionalBiomesId = ReadonlyBiomesId | undefined;
export type ReadonlyOptionalTensorBlob = string | undefined;
export type ReadonlyAppearance = {
  readonly skin_color_id: string;
  readonly eye_color_id: string;
  readonly hair_color_id: string;
  readonly head_id: ReadonlyBiomesId;
};
export type ReadonlyItemSlot = ReadonlyItemAndCount | undefined;
type ReadonlyT48 = {
  readonly contents: ReadonlyItemAndCount;
  readonly price: ReadonlyItemAndCount;
  readonly seller_id: ReadonlyBiomesId;
};
export type ReadonlyOptionalItem = ReadonlyItem | undefined;
export type ReadonlyOptionalItemAndCount = ReadonlyItemAndCount | undefined;
export type ReadonlyItemSet = ReadonlyMap<string, ReadonlyItem>;
export type ReadonlyItemBag = ReadonlyMap<string, ReadonlyItemAndCount>;
export type ReadonlyItemAssignment = ReadonlyMap<
  ReadonlyBiomesId,
  ReadonlyItem
>;
export type ReadonlyItemAssignmentReference = {
  readonly key: ReadonlyBiomesId;
};
export type ReadonlyItemContainerReference = { readonly idx: number };
export type ReadonlyItemBagReference = { readonly key: string };
export type ReadonlyOptionalMovementActionType =
  | ("dodge" | "evade")
  | undefined;
export type ReadonlyOptionalEmoteType =
  | (
      | "attack1"
      | "attack2"
      | "destroy"
      | "place"
      | "applause"
      | "dance"
      | "drink"
      | "eat"
      | "flex"
      | "laugh"
      | "point"
      | "rock"
      | "sick"
      | "sit"
      | "splash"
      | "warp"
      | "warpHome"
      | "wave"
      | "fishingCastPull"
      | "fishingCastRelease"
      | "fishingIdle"
      | "fishingReel"
      | "fishingShow"
      | "diggingHand"
      | "diggingTool"
      | "watering"
      | "equip"
      | "unequip"
      | "sadness"
      | "depression"
      | "crying"
      | "shame"
      | "fear"
      | "terror"
      | "cowering"
      | "nervousness"
      | "surprise"
      | "shock"
      | "recoil"
      | "curiosity"
      | "thinking"
      | "confusion"
      | "uncertainty"
      | "embarrassment"
      | "shyness"
      | "boredom"
      | "impatience"
      | "annoyance"
      | "frustration"
      | "facepalm"
      | "anger"
      | "fury"
      | "threatening"
      | "determined"
      | "ready"
      | "tiredness"
      | "exhaustion"
      | "yawning"
      | "stretching"
      | "injury"
      | "limping"
      | "dizziness"
      | "shivering"
      | "relief"
      | "disgust"
      | "love"
      | "flirting"
      | "gratitude"
      | "apology"
      | "bow"
      | "salute"
      | "kneel"
      | "pray"
      | "meditate"
      | "surrender"
      | "beckon"
      | "stop"
      | "comeHere"
      | "hug"
      | "handshake"
      | "highFive"
      | "thumbsUp"
      | "thumbsDown"
      | "guard"
      | "block"
      | "taunt"
      | "stagger"
      | "knockdown"
      | "getUp"
      | "retreat"
      | "rally"
      | "victory"
      | "defeat"
      | "footTapping"
      | "scratchingHead"
      | "checkingEquipment"
      | "pacing"
      | "sighing"
      | "cleaningWeapon"
    )
  | undefined;
export type ReadonlyOptionalShardId = ReadonlyShardId | undefined;
export type ReadonlyOptionalString = string | undefined;
export type ReadonlyOptionalBuffer = Uint8Array | undefined;
type ReadonlyT92 = ReadonlySet<ReadonlyBiomesId>;
type ReadonlyT93 = number | undefined;
export type ReadonlyNUXStatus = {
  readonly complete: boolean;
  readonly state_id: string;
};
export type ReadonlyUserRoleSet = ReadonlySet<
  | "employee"
  | "admin"
  | "advancedOptions"
  | "deleteGroup"
  | "highlightGroup"
  | "unplaceGroup"
  | "repairGroup"
  | "seeGremlins"
  | "seeNpcs"
  | "bless"
  | "give"
  | "flying"
  | "internalSync"
  | "export"
  | "groundskeeper"
  | "clone"
  | "apply"
  | "twoWayInbox"
  | "baker"
  | "farmingAdmin"
  | "oobNoCors"
  | "noClip"
>;
type ReadonlyT101 = ReadonlySet<
  | "shape"
  | "place"
  | "destroy"
  | "interact"
  | "administrate"
  | "createGroup"
  | "dump"
  | "placeCampsite"
  | "tillSoil"
  | "plantSeed"
  | "pvp"
  | "warp_from"
  | "apply_buffs"
  | "placeRobot"
  | "placeEphemeral"
  | "demuckerWand"
>;
type ReadonlyT117 = { readonly kind: "dayNight" };
type ReadonlyT119 = { readonly kind: "farFromHome" };
type ReadonlyT121 = { readonly kind: "adminKill" };
type ReadonlyT123 = { readonly kind: "outOfWorldBounds" };
type ReadonlyT126 = { readonly kind: "suicide" };
type ReadonlyT128 = { readonly kind: "despawnWand" };
type ReadonlyT130 = {
  readonly kind: "block";
  readonly biscuitId: ReadonlyBiomesId;
};
type ReadonlyT132 = { readonly kind: "fall"; readonly distance: number };
type ReadonlyT136 = { readonly kind: "drown" };
type ReadonlyT138 = { readonly kind: "fire" };
type ReadonlyT140 = { readonly kind: "fireDamage" };
type ReadonlyT142 = { readonly kind: "fireHeal" };
type ReadonlyT144 = { readonly kind: "heal" };
export type ReadonlyOptionalAnimationRepeatKind =
  | ("once" | "repeat")
  | undefined;
export type ReadonlyChallengeStateMap = ReadonlyMap<
  ReadonlyBiomesId,
  "available" | "completed" | "in_progress" | "start"
>;
export type ReadonlyTriggerTrees = ReadonlyMap<
  ReadonlyBiomesId,
  ReadonlyTriggerStateMap
>;
export type ReadonlyChallengeTime = ReadonlyMap<ReadonlyBiomesId, number>;
export type ReadonlyTagRoundState = { readonly it_player: ReadonlyBiomesId };
type ReadonlyT175 = { readonly round_start: number };
type ReadonlyT176 = { readonly round_end: number };
type ReadonlyT177 = { readonly timestamp: number };
export type ReadonlySpleefPlayerStats = {
  readonly playerId: ReadonlyBiomesId;
  readonly rounds_won: number;
};
type ReadonlyT188 = { readonly time: number };
export type ReadonlyGiveMinigameKitData =
  | ({} & { kind: "simple_race" })
  | ({} & { kind: "deathmatch" })
  | ({} & { kind: "spleef" });
type ReadonlyT201 = {
  readonly kind: "water";
  readonly amount: number;
  readonly timestamp: number;
};
type ReadonlyT203 = {
  readonly kind: "fertilize";
  readonly fertilizer: ReadonlyItem;
  readonly timestamp: number;
};
type ReadonlyT205 = { readonly kind: "harvest"; readonly timestamp: number };
type ReadonlyT207 = {
  readonly kind: "adminDestroy";
  readonly timestamp: number;
};
type ReadonlyT209 = { readonly kind: "poke"; readonly timestamp: number };
export type ReadonlyTeamMemberMetadata = { readonly joined_at: number };
export type ReadonlyTeamInvite = {
  readonly inviter_id: ReadonlyBiomesId;
  readonly invitee_id: ReadonlyBiomesId;
  readonly created_at: number;
};
export type ReadonlyTeamJoinRequest = {
  readonly entity_id: ReadonlyBiomesId;
  readonly created_at: number;
};
type ReadonlyT231 = { readonly kind: "sphere"; readonly radius: number };
export type ReadonlyTradeSpec = {
  readonly trade_id: ReadonlyBiomesId;
  readonly id1: ReadonlyBiomesId;
  readonly id2: ReadonlyBiomesId;
};
export type ReadonlyOptionalMat3f =
  | readonly [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number
    ]
  | undefined;
export type ReadonlyVec3iList = ReadonlyArray<
  readonly [number, number, number]
>;
export type ReadonlyBox2 = {
  readonly v0: readonly [number, number, number];
  readonly v1: readonly [number, number, number];
};
export type ReadonlyOptionalVec3f =
  | readonly [number, number, number]
  | undefined;
export type ReadonlyVec3fList = ReadonlyArray<
  readonly [number, number, number]
>;
export type ReadonlyOptionalVec2f = readonly [number, number] | undefined;
export type ReadonlyTerrainUpdate = readonly [
  readonly [number, number, number],
  number
];
export type ReadonlyPricedItemSlot =
  | {
      readonly contents: ReadonlyItemAndCount;
      readonly price: ReadonlyItemAndCount;
      readonly seller_id: ReadonlyBiomesId;
    }
  | undefined;
export type ReadonlyItemContainer = ReadonlyArray<
  ReadonlyItemAndCount | undefined
>;
export type ReadonlyOptionalItemBag =
  | ReadonlyMap<string, ReadonlyItemAndCount>
  | undefined;
export type ReadonlyOwnedItemReference =
  | ({ readonly idx: number } & { kind: "item" })
  | ({ readonly idx: number } & { kind: "hotbar" })
  | ({ readonly key: string } & { kind: "currency" })
  | ({ readonly key: ReadonlyBiomesId } & { kind: "wearable" });
export type ReadonlyEmoteFishingLinePhysicsPosition = {
  readonly velocity: readonly [number, number, number];
  readonly gravity: readonly [number, number, number];
  readonly start: readonly [number, number, number];
};
export type ReadonlyEmoteFishingLineReelInPosition = {
  readonly start: readonly [number, number, number];
  readonly duration: number;
};
export type ReadonlyEmoteFishingLineFixedPosition = {
  readonly pos: readonly [number, number, number];
};
export type ReadonlyWarpTarget = {
  readonly warp_to: readonly [number, number, number];
  readonly orientation: readonly [number, number];
};
export type ReadonlyEntitiesAndExpiry = {
  readonly entity_ids: ReadonlySet<ReadonlyBiomesId>;
  readonly expiry: number | undefined;
};
export type ReadonlyAllNUXStatus = ReadonlyMap<
  number,
  { readonly complete: boolean; readonly state_id: string }
>;
type ReadonlyT102 = readonly [
  ReadonlyBiomesId,
  ReadonlySet<
    | "shape"
    | "place"
    | "destroy"
    | "interact"
    | "administrate"
    | "createGroup"
    | "dump"
    | "placeCampsite"
    | "tillSoil"
    | "plantSeed"
    | "pvp"
    | "warp_from"
    | "apply_buffs"
    | "placeRobot"
    | "placeEphemeral"
    | "demuckerWand"
  >
];
type ReadonlyT104 = ReadonlyMap<
  | "employee"
  | "admin"
  | "advancedOptions"
  | "deleteGroup"
  | "highlightGroup"
  | "unplaceGroup"
  | "repairGroup"
  | "seeGremlins"
  | "seeNpcs"
  | "bless"
  | "give"
  | "flying"
  | "internalSync"
  | "export"
  | "groundskeeper"
  | "clone"
  | "apply"
  | "twoWayInbox"
  | "baker"
  | "farmingAdmin"
  | "oobNoCors"
  | "noClip",
  ReadonlySet<
    | "shape"
    | "place"
    | "destroy"
    | "interact"
    | "administrate"
    | "createGroup"
    | "dump"
    | "placeCampsite"
    | "tillSoil"
    | "plantSeed"
    | "pvp"
    | "warp_from"
    | "apply_buffs"
    | "placeRobot"
    | "placeEphemeral"
    | "demuckerWand"
  >
>;
type ReadonlyT105 = ReadonlyMap<
  ReadonlyBiomesId,
  ReadonlySet<
    | "shape"
    | "place"
    | "destroy"
    | "interact"
    | "administrate"
    | "createGroup"
    | "dump"
    | "placeCampsite"
    | "tillSoil"
    | "plantSeed"
    | "pvp"
    | "warp_from"
    | "apply_buffs"
    | "placeRobot"
    | "placeEphemeral"
    | "demuckerWand"
  >
>;
export type ReadonlyAabb = readonly [
  readonly [number, number, number],
  readonly [number, number, number]
];
type ReadonlyT112 = {
  readonly kind: "point";
  readonly point: readonly [number, number, number];
};
export type ReadonlyNpcDamageSource =
  | ({ readonly kind: "dayNight" } & { kind: "dayNight" })
  | ({ readonly kind: "farFromHome" } & { kind: "farFromHome" })
  | ({ readonly kind: "adminKill" } & { kind: "adminKill" })
  | ({ readonly kind: "outOfWorldBounds" } & { kind: "outOfWorldBounds" });
export type ReadonlyPlaceableAnimation = {
  readonly type: "open" | "close" | "play";
  readonly repeat: ("once" | "repeat") | undefined;
  readonly start_time: number;
};
export type ReadonlyLifetimeStatsMap = ReadonlyMap<
  | "collected"
  | "crafted"
  | "fished"
  | "mined"
  | "consumed"
  | "grown"
  | "takenPhoto",
  ReadonlyMap<string, ReadonlyItemAndCount>
>;
export type ReadonlyPositionBeamMap = ReadonlyMap<
  ReadonlyBiomesId,
  readonly [number, number]
>;
export type ReadonlyPlaceEventInfo = {
  readonly time: number;
  readonly position: readonly [number, number, number];
};
export type ReadonlyBuff = {
  readonly item_id: ReadonlyBiomesId;
  readonly start_time: number | undefined;
  readonly from_id: ReadonlyBiomesId | undefined;
  readonly is_disabled: boolean | undefined;
};
export type ReadonlyOptionalTagRoundState =
  | { readonly it_player: ReadonlyBiomesId }
  | undefined;
type ReadonlyT169 = {
  readonly checkpoint_ids: ReadonlySet<ReadonlyBiomesId>;
  readonly start_ids: ReadonlySet<ReadonlyBiomesId>;
  readonly end_ids: ReadonlySet<ReadonlyBiomesId>;
};
type ReadonlyT170 = { readonly start_ids: ReadonlySet<ReadonlyBiomesId> };
type ReadonlyT171 = {
  readonly start_ids: ReadonlySet<ReadonlyBiomesId>;
  readonly arena_marker_ids: ReadonlySet<ReadonlyBiomesId>;
};
export type ReadonlyDeathMatchPlayerState = {
  readonly playerId: ReadonlyBiomesId;
  readonly kills: number;
  readonly deaths: number;
  readonly last_kill: number | undefined;
  readonly last_death: number | undefined;
};
type ReadonlyT178 =
  | ({} & { kind: "waiting_for_players" })
  | ({ readonly round_start: number } & { kind: "play_countdown" })
  | ({ readonly round_end: number } & { kind: "playing" })
  | ({ readonly timestamp: number } & { kind: "finished" });
type ReadonlyT183 = {
  readonly round_start: number;
  readonly last_winner_id: ReadonlyBiomesId | undefined;
};
type ReadonlyT186 = ReadonlyMap<
  ReadonlyBiomesId,
  { readonly playerId: ReadonlyBiomesId; readonly rounds_won: number }
>;
export type ReadonlyReachedCheckpoints = ReadonlyMap<
  ReadonlyBiomesId,
  { readonly time: number }
>;
export type ReadonlyFarmingPlayerAction =
  | ({
      readonly kind: "water";
      readonly amount: number;
      readonly timestamp: number;
    } & { kind: "water" })
  | ({
      readonly kind: "fertilize";
      readonly fertilizer: ReadonlyItem;
      readonly timestamp: number;
    } & { kind: "fertilize" })
  | ({ readonly kind: "harvest"; readonly timestamp: number } & {
      kind: "harvest";
    })
  | ({ readonly kind: "adminDestroy"; readonly timestamp: number } & {
      kind: "adminDestroy";
    })
  | ({ readonly kind: "poke"; readonly timestamp: number } & { kind: "poke" });
type ReadonlyT212 = { readonly type_ids: ReadonlyArray<ReadonlyBiomesId> };
export type ReadonlyBucketedImageCloudBundle = {
  readonly webp_320w: string | undefined;
  readonly webp_640w: string | undefined;
  readonly webp_1280w: string | undefined;
  readonly png_1280w: string | undefined;
  readonly webp_original: string | undefined;
  readonly bucket: "biomes-social";
};
export type ReadonlyTerrainRestorationEntry = {
  readonly position_index: number;
  readonly created_at: number;
  readonly restore_time: number;
  readonly terrain: number | undefined;
  readonly placer: number | undefined;
  readonly dye: number | undefined;
  readonly shape: number | undefined;
};
export type ReadonlyTeamPendingInvites = ReadonlyMap<
  ReadonlyBiomesId,
  {
    readonly inviter_id: ReadonlyBiomesId;
    readonly invitee_id: ReadonlyBiomesId;
    readonly created_at: number;
  }
>;
export type ReadonlyTeamPendingRequests = ReadonlyArray<{
  readonly entity_id: ReadonlyBiomesId;
  readonly created_at: number;
}>;
export type ReadonlyTeamMembers = ReadonlyMap<
  ReadonlyBiomesId,
  { readonly joined_at: number }
>;
type ReadonlyT229 = {
  readonly kind: "box";
  readonly box: readonly [number, number, number];
};
export type ReadonlyTradeSpecList = ReadonlyArray<{
  readonly trade_id: ReadonlyBiomesId;
  readonly id1: ReadonlyBiomesId;
  readonly id2: ReadonlyBiomesId;
}>;
export type ReadonlyTerrainUpdateList = ReadonlyArray<
  readonly [readonly [number, number, number], number]
>;
export type ReadonlyPricedItemContainer = ReadonlyArray<
  | {
      readonly contents: ReadonlyItemAndCount;
      readonly price: ReadonlyItemAndCount;
      readonly seller_id: ReadonlyBiomesId;
    }
  | undefined
>;
export type ReadonlyOptionalOwnedItemReference =
  | (
      | ({ readonly idx: number } & { kind: "item" })
      | ({ readonly idx: number } & { kind: "hotbar" })
      | ({ readonly key: string } & { kind: "currency" })
      | ({ readonly key: ReadonlyBiomesId } & { kind: "wearable" })
    )
  | undefined;
export type ReadonlyOwnedItemReferenceList = ReadonlyArray<
  | ({ readonly idx: number } & { kind: "item" })
  | ({ readonly idx: number } & { kind: "hotbar" })
  | ({ readonly key: string } & { kind: "currency" })
  | ({ readonly key: ReadonlyBiomesId } & { kind: "wearable" })
>;
type ReadonlyT64 = readonly [
  (
    | ({ readonly idx: number } & { kind: "item" })
    | ({ readonly idx: number } & { kind: "hotbar" })
    | ({ readonly key: string } & { kind: "currency" })
    | ({ readonly key: ReadonlyBiomesId } & { kind: "wearable" })
  ),
  ReadonlyItemAndCount
];
export type ReadonlyEmoteFishingLineEndPosition =
  | ({
      readonly velocity: readonly [number, number, number];
      readonly gravity: readonly [number, number, number];
      readonly start: readonly [number, number, number];
    } & { kind: "physics" })
  | ({
      readonly start: readonly [number, number, number];
      readonly duration: number;
    } & { kind: "reel_in" })
  | ({ readonly pos: readonly [number, number, number] } & { kind: "fixed" });
export type ReadonlyEmoteThrowInfo = {
  readonly physics: {
    readonly velocity: readonly [number, number, number];
    readonly gravity: readonly [number, number, number];
    readonly start: readonly [number, number, number];
  };
  readonly angular_velocity: readonly [number, number] | undefined;
};
export type ReadonlyOptionalWarpTarget =
  | {
      readonly warp_to: readonly [number, number, number];
      readonly orientation: readonly [number, number];
    }
  | undefined;
export type ReadonlyGrabBagFilter =
  | ({
      readonly entity_ids: ReadonlySet<ReadonlyBiomesId>;
      readonly expiry: number | undefined;
    } & { kind: "block" })
  | ({
      readonly entity_ids: ReadonlySet<ReadonlyBiomesId>;
      readonly expiry: number | undefined;
    } & { kind: "only" });
export type ReadonlyTargetedAcl =
  | readonly [
      ReadonlyBiomesId,
      ReadonlySet<
        | "shape"
        | "place"
        | "destroy"
        | "interact"
        | "administrate"
        | "createGroup"
        | "dump"
        | "placeCampsite"
        | "tillSoil"
        | "plantSeed"
        | "pvp"
        | "warp_from"
        | "apply_buffs"
        | "placeRobot"
        | "placeEphemeral"
        | "demuckerWand"
      >
    ]
  | undefined;
export type ReadonlyOptionalAabb =
  | readonly [
      readonly [number, number, number],
      readonly [number, number, number]
    ]
  | undefined;
type ReadonlyT110 = {
  readonly kind: "aabb";
  readonly aabb: readonly [
    readonly [number, number, number],
    readonly [number, number, number]
  ];
};
type ReadonlyT114 = {
  readonly kind: "points";
  readonly points: ReadonlyArray<readonly [number, number, number]>;
};
type ReadonlyT134 = {
  readonly kind: "attack";
  readonly attacker: ReadonlyBiomesId;
  readonly dir: readonly [number, number, number] | undefined;
};
type ReadonlyT146 = {
  readonly kind: "npc";
  readonly type:
    | ({ readonly kind: "dayNight" } & { kind: "dayNight" })
    | ({ readonly kind: "farFromHome" } & { kind: "farFromHome" })
    | ({ readonly kind: "adminKill" } & { kind: "adminKill" })
    | ({ readonly kind: "outOfWorldBounds" } & { kind: "outOfWorldBounds" });
};
export type ReadonlyOptionalPlaceableAnimation =
  | {
      readonly type: "open" | "close" | "play";
      readonly repeat: ("once" | "repeat") | undefined;
      readonly start_time: number;
    }
  | undefined;
export type ReadonlyOptionalPlaceEventInfo =
  | {
      readonly time: number;
      readonly position: readonly [number, number, number];
    }
  | undefined;
export type ReadonlyBuffsList = ReadonlyArray<{
  readonly item_id: ReadonlyBiomesId;
  readonly start_time: number | undefined;
  readonly from_id: ReadonlyBiomesId | undefined;
  readonly is_disabled: boolean | undefined;
}>;
export type ReadonlyMinigameMetadata =
  | ({
      readonly checkpoint_ids: ReadonlySet<ReadonlyBiomesId>;
      readonly start_ids: ReadonlySet<ReadonlyBiomesId>;
      readonly end_ids: ReadonlySet<ReadonlyBiomesId>;
    } & { kind: "simple_race" })
  | ({ readonly start_ids: ReadonlySet<ReadonlyBiomesId> } & {
      kind: "deathmatch";
    })
  | ({
      readonly start_ids: ReadonlySet<ReadonlyBiomesId>;
      readonly arena_marker_ids: ReadonlySet<ReadonlyBiomesId>;
    } & { kind: "spleef" });
type ReadonlyT179 =
  | (
      | ({} & { kind: "waiting_for_players" })
      | ({ readonly round_start: number } & { kind: "play_countdown" })
      | ({ readonly round_end: number } & { kind: "playing" })
      | ({ readonly timestamp: number } & { kind: "finished" })
    )
  | undefined;
type ReadonlyT180 = ReadonlyMap<
  ReadonlyBiomesId,
  {
    readonly playerId: ReadonlyBiomesId;
    readonly kills: number;
    readonly deaths: number;
    readonly last_kill: number | undefined;
    readonly last_death: number | undefined;
  }
>;
type ReadonlyT184 = {
  readonly round_expires: number;
  readonly alive_round_players: ReadonlySet<ReadonlyBiomesId>;
  readonly tag_round_state:
    | { readonly it_player: ReadonlyBiomesId }
    | undefined;
};
export type ReadonlySimpleRaceInstanceState = {
  readonly player_state: "waiting" | "racing";
  readonly started_at: number;
  readonly deaths: number;
  readonly reached_checkpoints: ReadonlyMap<
    ReadonlyBiomesId,
    { readonly time: number }
  >;
  readonly finished_at: number | undefined;
};
export type ReadonlyMinigameInstanceActivePlayerInfo = {
  readonly entry_stash_id: ReadonlyBiomesId;
  readonly entry_position: readonly [number, number, number];
  readonly entry_warped_to: readonly [number, number, number] | undefined;
  readonly entry_time: number;
};
type ReadonlyT196 = {
  readonly box: {
    readonly v0: readonly [number, number, number];
    readonly v1: readonly [number, number, number];
  };
  readonly clipboard_entity_id: ReadonlyBiomesId;
};
export type ReadonlyFarmingPlayerActionList = ReadonlyArray<
  | ({
      readonly kind: "water";
      readonly amount: number;
      readonly timestamp: number;
    } & { kind: "water" })
  | ({
      readonly kind: "fertilize";
      readonly fertilizer: ReadonlyItem;
      readonly timestamp: number;
    } & { kind: "fertilize" })
  | ({ readonly kind: "harvest"; readonly timestamp: number } & {
      kind: "harvest";
    })
  | ({ readonly kind: "adminDestroy"; readonly timestamp: number } & {
      kind: "adminDestroy";
    })
  | ({ readonly kind: "poke"; readonly timestamp: number } & { kind: "poke" })
>;
export type ReadonlyItemBuyerSpec = {
  readonly type_ids: ReadonlyArray<ReadonlyBiomesId>;
} & { kind: "item_types" };
export type ReadonlyTerrainRestorationEntryList = ReadonlyArray<{
  readonly position_index: number;
  readonly created_at: number;
  readonly restore_time: number;
  readonly terrain: number | undefined;
  readonly placer: number | undefined;
  readonly dye: number | undefined;
  readonly shape: number | undefined;
}>;
export type ReadonlyVolume =
  | ({
      readonly kind: "box";
      readonly box: readonly [number, number, number];
    } & { kind: "box" })
  | ({ readonly kind: "sphere"; readonly radius: number } & { kind: "sphere" });
export type ReadonlyInventoryAssignmentPattern = ReadonlyArray<
  readonly [
    (
      | ({ readonly idx: number } & { kind: "item" })
      | ({ readonly idx: number } & { kind: "hotbar" })
      | ({ readonly key: string } & { kind: "currency" })
      | ({ readonly key: ReadonlyBiomesId } & { kind: "wearable" })
    ),
    ReadonlyItemAndCount
  ]
>;
type ReadonlyT66 = ReadonlyArray<
  readonly [
    (
      | ({ readonly idx: number } & { kind: "item" })
      | ({ readonly idx: number } & { kind: "hotbar" })
      | ({ readonly key: string } & { kind: "currency" })
      | ({ readonly key: ReadonlyBiomesId } & { kind: "wearable" })
    ),
    ReadonlyItemAndCount
  ]
>;
type ReadonlyT76 =
  | (
      | ({
          readonly velocity: readonly [number, number, number];
          readonly gravity: readonly [number, number, number];
          readonly start: readonly [number, number, number];
        } & { kind: "physics" })
      | ({
          readonly start: readonly [number, number, number];
          readonly duration: number;
        } & { kind: "reel_in" })
      | ({ readonly pos: readonly [number, number, number] } & {
          kind: "fixed";
        })
    )
  | undefined;
type ReadonlyT80 =
  | {
      readonly physics: {
        readonly velocity: readonly [number, number, number];
        readonly gravity: readonly [number, number, number];
        readonly start: readonly [number, number, number];
      };
      readonly angular_velocity: readonly [number, number] | undefined;
    }
  | undefined;
export type ReadonlyAcl = {
  readonly everyone: ReadonlySet<
    | "shape"
    | "place"
    | "destroy"
    | "interact"
    | "administrate"
    | "createGroup"
    | "dump"
    | "placeCampsite"
    | "tillSoil"
    | "plantSeed"
    | "pvp"
    | "warp_from"
    | "apply_buffs"
    | "placeRobot"
    | "placeEphemeral"
    | "demuckerWand"
  >;
  readonly roles: ReadonlyMap<
    | "employee"
    | "admin"
    | "advancedOptions"
    | "deleteGroup"
    | "highlightGroup"
    | "unplaceGroup"
    | "repairGroup"
    | "seeGremlins"
    | "seeNpcs"
    | "bless"
    | "give"
    | "flying"
    | "internalSync"
    | "export"
    | "groundskeeper"
    | "clone"
    | "apply"
    | "twoWayInbox"
    | "baker"
    | "farmingAdmin"
    | "oobNoCors"
    | "noClip",
    ReadonlySet<
      | "shape"
      | "place"
      | "destroy"
      | "interact"
      | "administrate"
      | "createGroup"
      | "dump"
      | "placeCampsite"
      | "tillSoil"
      | "plantSeed"
      | "pvp"
      | "warp_from"
      | "apply_buffs"
      | "placeRobot"
      | "placeEphemeral"
      | "demuckerWand"
    >
  >;
  readonly entities: ReadonlyMap<
    ReadonlyBiomesId,
    ReadonlySet<
      | "shape"
      | "place"
      | "destroy"
      | "interact"
      | "administrate"
      | "createGroup"
      | "dump"
      | "placeCampsite"
      | "tillSoil"
      | "plantSeed"
      | "pvp"
      | "warp_from"
      | "apply_buffs"
      | "placeRobot"
      | "placeEphemeral"
      | "demuckerWand"
    >
  >;
  readonly teams: ReadonlyMap<
    ReadonlyBiomesId,
    ReadonlySet<
      | "shape"
      | "place"
      | "destroy"
      | "interact"
      | "administrate"
      | "createGroup"
      | "dump"
      | "placeCampsite"
      | "tillSoil"
      | "plantSeed"
      | "pvp"
      | "warp_from"
      | "apply_buffs"
      | "placeRobot"
      | "placeEphemeral"
      | "demuckerWand"
    >
  >;
  readonly creator:
    | readonly [
        ReadonlyBiomesId,
        ReadonlySet<
          | "shape"
          | "place"
          | "destroy"
          | "interact"
          | "administrate"
          | "createGroup"
          | "dump"
          | "placeCampsite"
          | "tillSoil"
          | "plantSeed"
          | "pvp"
          | "warp_from"
          | "apply_buffs"
          | "placeRobot"
          | "placeEphemeral"
          | "demuckerWand"
        >
      ]
    | undefined;
  readonly creatorTeam:
    | readonly [
        ReadonlyBiomesId,
        ReadonlySet<
          | "shape"
          | "place"
          | "destroy"
          | "interact"
          | "administrate"
          | "createGroup"
          | "dump"
          | "placeCampsite"
          | "tillSoil"
          | "plantSeed"
          | "pvp"
          | "warp_from"
          | "apply_buffs"
          | "placeRobot"
          | "placeEphemeral"
          | "demuckerWand"
        >
      ]
    | undefined;
};
export type ReadonlyAclDomain =
  | ({
      readonly kind: "aabb";
      readonly aabb: readonly [
        readonly [number, number, number],
        readonly [number, number, number]
      ];
    } & { kind: "aabb" })
  | ({
      readonly kind: "point";
      readonly point: readonly [number, number, number];
    } & { kind: "point" })
  | ({
      readonly kind: "points";
      readonly points: ReadonlyArray<readonly [number, number, number]>;
    } & { kind: "points" });
export type ReadonlyDamageSource =
  | ({ readonly kind: "suicide" } & { kind: "suicide" })
  | ({ readonly kind: "despawnWand" } & { kind: "despawnWand" })
  | ({ readonly kind: "block"; readonly biscuitId: ReadonlyBiomesId } & {
      kind: "block";
    })
  | ({ readonly kind: "fall"; readonly distance: number } & { kind: "fall" })
  | ({
      readonly kind: "attack";
      readonly attacker: ReadonlyBiomesId;
      readonly dir: readonly [number, number, number] | undefined;
    } & { kind: "attack" })
  | ({ readonly kind: "drown" } & { kind: "drown" })
  | ({ readonly kind: "fire" } & { kind: "fire" })
  | ({ readonly kind: "fireDamage" } & { kind: "fireDamage" })
  | ({ readonly kind: "fireHeal" } & { kind: "fireHeal" })
  | ({ readonly kind: "heal" } & { kind: "heal" })
  | ({
      readonly kind: "npc";
      readonly type:
        | ({ readonly kind: "dayNight" } & { kind: "dayNight" })
        | ({ readonly kind: "farFromHome" } & { kind: "farFromHome" })
        | ({ readonly kind: "adminKill" } & { kind: "adminKill" })
        | ({ readonly kind: "outOfWorldBounds" } & {
            kind: "outOfWorldBounds";
          });
    } & { kind: "npc" });
export type ReadonlyDeathmatchInstanceState = {
  readonly instance_state:
    | (
        | ({} & { kind: "waiting_for_players" })
        | ({ readonly round_start: number } & { kind: "play_countdown" })
        | ({ readonly round_end: number } & { kind: "playing" })
        | ({ readonly timestamp: number } & { kind: "finished" })
      )
    | undefined;
  readonly player_states: ReadonlyMap<
    ReadonlyBiomesId,
    {
      readonly playerId: ReadonlyBiomesId;
      readonly kills: number;
      readonly deaths: number;
      readonly last_kill: number | undefined;
      readonly last_death: number | undefined;
    }
  >;
};
type ReadonlyT185 =
  | ({} & { kind: "waiting_for_players" })
  | ({
      readonly round_start: number;
      readonly last_winner_id: ReadonlyBiomesId | undefined;
    } & { kind: "round_countdown" })
  | ({
      readonly round_expires: number;
      readonly alive_round_players: ReadonlySet<ReadonlyBiomesId>;
      readonly tag_round_state:
        | { readonly it_player: ReadonlyBiomesId }
        | undefined;
    } & { kind: "playing_round" });
export type ReadonlyMinigameInstanceActivePlayerMap = ReadonlyMap<
  ReadonlyBiomesId,
  {
    readonly entry_stash_id: ReadonlyBiomesId;
    readonly entry_position: readonly [number, number, number];
    readonly entry_warped_to: readonly [number, number, number] | undefined;
    readonly entry_time: number;
  }
>;
type ReadonlyT197 = {
  readonly box: {
    readonly v0: readonly [number, number, number];
    readonly v1: readonly [number, number, number];
  };
  readonly clipboard_entity_id: ReadonlyBiomesId;
} & { kind: "aabb" };
export type ReadonlyOptionalVolume =
  | (
      | ({
          readonly kind: "box";
          readonly box: readonly [number, number, number];
        } & { kind: "box" })
      | ({ readonly kind: "sphere"; readonly radius: number } & {
          kind: "sphere";
        })
    )
  | undefined;
export type ReadonlyOptionalInventoryAssignmentPattern =
  | ReadonlyArray<
      readonly [
        (
          | ({ readonly idx: number } & { kind: "item" })
          | ({ readonly idx: number } & { kind: "hotbar" })
          | ({ readonly key: string } & { kind: "currency" })
          | ({ readonly key: ReadonlyBiomesId } & { kind: "wearable" })
        ),
        ReadonlyItemAndCount
      ]
    >
  | undefined;
export type ReadonlyEmoteFishingInfo = {
  readonly line_end_position:
    | (
        | ({
            readonly velocity: readonly [number, number, number];
            readonly gravity: readonly [number, number, number];
            readonly start: readonly [number, number, number];
          } & { kind: "physics" })
        | ({
            readonly start: readonly [number, number, number];
            readonly duration: number;
          } & { kind: "reel_in" })
        | ({ readonly pos: readonly [number, number, number] } & {
            kind: "fixed";
          })
      )
    | undefined;
  readonly line_end_item: ReadonlyItem | undefined;
};
export type ReadonlyOptionalEmoteThrowInfo =
  | (
      | {
          readonly physics: {
            readonly velocity: readonly [number, number, number];
            readonly gravity: readonly [number, number, number];
            readonly start: readonly [number, number, number];
          };
          readonly angular_velocity: readonly [number, number] | undefined;
        }
      | undefined
    )
  | undefined;
export type ReadonlyOptionalDamageSource =
  | (
      | ({ readonly kind: "suicide" } & { kind: "suicide" })
      | ({ readonly kind: "despawnWand" } & { kind: "despawnWand" })
      | ({ readonly kind: "block"; readonly biscuitId: ReadonlyBiomesId } & {
          kind: "block";
        })
      | ({ readonly kind: "fall"; readonly distance: number } & {
          kind: "fall";
        })
      | ({
          readonly kind: "attack";
          readonly attacker: ReadonlyBiomesId;
          readonly dir: readonly [number, number, number] | undefined;
        } & { kind: "attack" })
      | ({ readonly kind: "drown" } & { kind: "drown" })
      | ({ readonly kind: "fire" } & { kind: "fire" })
      | ({ readonly kind: "fireDamage" } & { kind: "fireDamage" })
      | ({ readonly kind: "fireHeal" } & { kind: "fireHeal" })
      | ({ readonly kind: "heal" } & { kind: "heal" })
      | ({
          readonly kind: "npc";
          readonly type:
            | ({ readonly kind: "dayNight" } & { kind: "dayNight" })
            | ({ readonly kind: "farFromHome" } & { kind: "farFromHome" })
            | ({ readonly kind: "adminKill" } & { kind: "adminKill" })
            | ({ readonly kind: "outOfWorldBounds" } & {
                kind: "outOfWorldBounds";
              });
        } & { kind: "npc" })
    )
  | undefined;
export type ReadonlySpleefInstanceState = {
  readonly instance_state:
    | ({} & { kind: "waiting_for_players" })
    | ({
        readonly round_start: number;
        readonly last_winner_id: ReadonlyBiomesId | undefined;
      } & { kind: "round_countdown" })
    | ({
        readonly round_expires: number;
        readonly alive_round_players: ReadonlySet<ReadonlyBiomesId>;
        readonly tag_round_state:
          | { readonly it_player: ReadonlyBiomesId }
          | undefined;
      } & { kind: "playing_round" });
  readonly observer_spawn_points: ReadonlyArray<
    readonly [number, number, number]
  >;
  readonly player_stats: ReadonlyMap<
    ReadonlyBiomesId,
    { readonly playerId: ReadonlyBiomesId; readonly rounds_won: number }
  >;
  readonly round_number: number;
};
export type ReadonlyMinigameInstanceSpaceClipboardInfo = {
  readonly region: {
    readonly box: {
      readonly v0: readonly [number, number, number];
      readonly v1: readonly [number, number, number];
    };
    readonly clipboard_entity_id: ReadonlyBiomesId;
  } & { kind: "aabb" };
};
export type ReadonlyProtectionParams = {
  readonly acl: {
    readonly everyone: ReadonlySet<
      | "shape"
      | "place"
      | "destroy"
      | "interact"
      | "administrate"
      | "createGroup"
      | "dump"
      | "placeCampsite"
      | "tillSoil"
      | "plantSeed"
      | "pvp"
      | "warp_from"
      | "apply_buffs"
      | "placeRobot"
      | "placeEphemeral"
      | "demuckerWand"
    >;
    readonly roles: ReadonlyMap<
      | "employee"
      | "admin"
      | "advancedOptions"
      | "deleteGroup"
      | "highlightGroup"
      | "unplaceGroup"
      | "repairGroup"
      | "seeGremlins"
      | "seeNpcs"
      | "bless"
      | "give"
      | "flying"
      | "internalSync"
      | "export"
      | "groundskeeper"
      | "clone"
      | "apply"
      | "twoWayInbox"
      | "baker"
      | "farmingAdmin"
      | "oobNoCors"
      | "noClip",
      ReadonlySet<
        | "shape"
        | "place"
        | "destroy"
        | "interact"
        | "administrate"
        | "createGroup"
        | "dump"
        | "placeCampsite"
        | "tillSoil"
        | "plantSeed"
        | "pvp"
        | "warp_from"
        | "apply_buffs"
        | "placeRobot"
        | "placeEphemeral"
        | "demuckerWand"
      >
    >;
    readonly entities: ReadonlyMap<
      ReadonlyBiomesId,
      ReadonlySet<
        | "shape"
        | "place"
        | "destroy"
        | "interact"
        | "administrate"
        | "createGroup"
        | "dump"
        | "placeCampsite"
        | "tillSoil"
        | "plantSeed"
        | "pvp"
        | "warp_from"
        | "apply_buffs"
        | "placeRobot"
        | "placeEphemeral"
        | "demuckerWand"
      >
    >;
    readonly teams: ReadonlyMap<
      ReadonlyBiomesId,
      ReadonlySet<
        | "shape"
        | "place"
        | "destroy"
        | "interact"
        | "administrate"
        | "createGroup"
        | "dump"
        | "placeCampsite"
        | "tillSoil"
        | "plantSeed"
        | "pvp"
        | "warp_from"
        | "apply_buffs"
        | "placeRobot"
        | "placeEphemeral"
        | "demuckerWand"
      >
    >;
    readonly creator:
      | readonly [
          ReadonlyBiomesId,
          ReadonlySet<
            | "shape"
            | "place"
            | "destroy"
            | "interact"
            | "administrate"
            | "createGroup"
            | "dump"
            | "placeCampsite"
            | "tillSoil"
            | "plantSeed"
            | "pvp"
            | "warp_from"
            | "apply_buffs"
            | "placeRobot"
            | "placeEphemeral"
            | "demuckerWand"
          >
        ]
      | undefined;
    readonly creatorTeam:
      | readonly [
          ReadonlyBiomesId,
          ReadonlySet<
            | "shape"
            | "place"
            | "destroy"
            | "interact"
            | "administrate"
            | "createGroup"
            | "dump"
            | "placeCampsite"
            | "tillSoil"
            | "plantSeed"
            | "pvp"
            | "warp_from"
            | "apply_buffs"
            | "placeRobot"
            | "placeEphemeral"
            | "demuckerWand"
          >
        ]
      | undefined;
  };
};
export type ReadonlyRestorationParams = {
  readonly acl: {
    readonly everyone: ReadonlySet<
      | "shape"
      | "place"
      | "destroy"
      | "interact"
      | "administrate"
      | "createGroup"
      | "dump"
      | "placeCampsite"
      | "tillSoil"
      | "plantSeed"
      | "pvp"
      | "warp_from"
      | "apply_buffs"
      | "placeRobot"
      | "placeEphemeral"
      | "demuckerWand"
    >;
    readonly roles: ReadonlyMap<
      | "employee"
      | "admin"
      | "advancedOptions"
      | "deleteGroup"
      | "highlightGroup"
      | "unplaceGroup"
      | "repairGroup"
      | "seeGremlins"
      | "seeNpcs"
      | "bless"
      | "give"
      | "flying"
      | "internalSync"
      | "export"
      | "groundskeeper"
      | "clone"
      | "apply"
      | "twoWayInbox"
      | "baker"
      | "farmingAdmin"
      | "oobNoCors"
      | "noClip",
      ReadonlySet<
        | "shape"
        | "place"
        | "destroy"
        | "interact"
        | "administrate"
        | "createGroup"
        | "dump"
        | "placeCampsite"
        | "tillSoil"
        | "plantSeed"
        | "pvp"
        | "warp_from"
        | "apply_buffs"
        | "placeRobot"
        | "placeEphemeral"
        | "demuckerWand"
      >
    >;
    readonly entities: ReadonlyMap<
      ReadonlyBiomesId,
      ReadonlySet<
        | "shape"
        | "place"
        | "destroy"
        | "interact"
        | "administrate"
        | "createGroup"
        | "dump"
        | "placeCampsite"
        | "tillSoil"
        | "plantSeed"
        | "pvp"
        | "warp_from"
        | "apply_buffs"
        | "placeRobot"
        | "placeEphemeral"
        | "demuckerWand"
      >
    >;
    readonly teams: ReadonlyMap<
      ReadonlyBiomesId,
      ReadonlySet<
        | "shape"
        | "place"
        | "destroy"
        | "interact"
        | "administrate"
        | "createGroup"
        | "dump"
        | "placeCampsite"
        | "tillSoil"
        | "plantSeed"
        | "pvp"
        | "warp_from"
        | "apply_buffs"
        | "placeRobot"
        | "placeEphemeral"
        | "demuckerWand"
      >
    >;
    readonly creator:
      | readonly [
          ReadonlyBiomesId,
          ReadonlySet<
            | "shape"
            | "place"
            | "destroy"
            | "interact"
            | "administrate"
            | "createGroup"
            | "dump"
            | "placeCampsite"
            | "tillSoil"
            | "plantSeed"
            | "pvp"
            | "warp_from"
            | "apply_buffs"
            | "placeRobot"
            | "placeEphemeral"
            | "demuckerWand"
          >
        ]
      | undefined;
    readonly creatorTeam:
      | readonly [
          ReadonlyBiomesId,
          ReadonlySet<
            | "shape"
            | "place"
            | "destroy"
            | "interact"
            | "administrate"
            | "createGroup"
            | "dump"
            | "placeCampsite"
            | "tillSoil"
            | "plantSeed"
            | "pvp"
            | "warp_from"
            | "apply_buffs"
            | "placeRobot"
            | "placeEphemeral"
            | "demuckerWand"
          >
        ]
      | undefined;
  };
  readonly restore_delay_s: number;
};
export type ReadonlyTrader = {
  readonly id: ReadonlyBiomesId;
  readonly offer_assignment: ReadonlyArray<
    readonly [
      (
        | ({ readonly idx: number } & { kind: "item" })
        | ({ readonly idx: number } & { kind: "hotbar" })
        | ({ readonly key: string } & { kind: "currency" })
        | ({ readonly key: ReadonlyBiomesId } & { kind: "wearable" })
      ),
      ReadonlyItemAndCount
    ]
  >;
  readonly accepted: boolean;
};
export type ReadonlyOptionalEmoteFishingInfo =
  | {
      readonly line_end_position:
        | (
            | ({
                readonly velocity: readonly [number, number, number];
                readonly gravity: readonly [number, number, number];
                readonly start: readonly [number, number, number];
              } & { kind: "physics" })
            | ({
                readonly start: readonly [number, number, number];
                readonly duration: number;
              } & { kind: "reel_in" })
            | ({ readonly pos: readonly [number, number, number] } & {
                kind: "fixed";
              })
          )
        | undefined;
      readonly line_end_item: ReadonlyItem | undefined;
    }
  | undefined;
export type ReadonlyMinigameInstanceState =
  | ({
      readonly player_state: "waiting" | "racing";
      readonly started_at: number;
      readonly deaths: number;
      readonly reached_checkpoints: ReadonlyMap<
        ReadonlyBiomesId,
        { readonly time: number }
      >;
      readonly finished_at: number | undefined;
    } & { kind: "simple_race" })
  | ({
      readonly instance_state:
        | (
            | ({} & { kind: "waiting_for_players" })
            | ({ readonly round_start: number } & { kind: "play_countdown" })
            | ({ readonly round_end: number } & { kind: "playing" })
            | ({ readonly timestamp: number } & { kind: "finished" })
          )
        | undefined;
      readonly player_states: ReadonlyMap<
        ReadonlyBiomesId,
        {
          readonly playerId: ReadonlyBiomesId;
          readonly kills: number;
          readonly deaths: number;
          readonly last_kill: number | undefined;
          readonly last_death: number | undefined;
        }
      >;
    } & { kind: "deathmatch" })
  | ({
      readonly instance_state:
        | ({} & { kind: "waiting_for_players" })
        | ({
            readonly round_start: number;
            readonly last_winner_id: ReadonlyBiomesId | undefined;
          } & { kind: "round_countdown" })
        | ({
            readonly round_expires: number;
            readonly alive_round_players: ReadonlySet<ReadonlyBiomesId>;
            readonly tag_round_state:
              | { readonly it_player: ReadonlyBiomesId }
              | undefined;
          } & { kind: "playing_round" });
      readonly observer_spawn_points: ReadonlyArray<
        readonly [number, number, number]
      >;
      readonly player_stats: ReadonlyMap<
        ReadonlyBiomesId,
        { readonly playerId: ReadonlyBiomesId; readonly rounds_won: number }
      >;
      readonly round_number: number;
    } & { kind: "spleef" });
export type ReadonlyOptionalMinigameInstanceSpaceClipboardInfo =
  | {
      readonly region: {
        readonly box: {
          readonly v0: readonly [number, number, number];
          readonly v1: readonly [number, number, number];
        };
        readonly clipboard_entity_id: ReadonlyBiomesId;
      } & { kind: "aabb" };
    }
  | undefined;
export type ReadonlyOptionalProtectionParams =
  | {
      readonly acl: {
        readonly everyone: ReadonlySet<
          | "shape"
          | "place"
          | "destroy"
          | "interact"
          | "administrate"
          | "createGroup"
          | "dump"
          | "placeCampsite"
          | "tillSoil"
          | "plantSeed"
          | "pvp"
          | "warp_from"
          | "apply_buffs"
          | "placeRobot"
          | "placeEphemeral"
          | "demuckerWand"
        >;
        readonly roles: ReadonlyMap<
          | "employee"
          | "admin"
          | "advancedOptions"
          | "deleteGroup"
          | "highlightGroup"
          | "unplaceGroup"
          | "repairGroup"
          | "seeGremlins"
          | "seeNpcs"
          | "bless"
          | "give"
          | "flying"
          | "internalSync"
          | "export"
          | "groundskeeper"
          | "clone"
          | "apply"
          | "twoWayInbox"
          | "baker"
          | "farmingAdmin"
          | "oobNoCors"
          | "noClip",
          ReadonlySet<
            | "shape"
            | "place"
            | "destroy"
            | "interact"
            | "administrate"
            | "createGroup"
            | "dump"
            | "placeCampsite"
            | "tillSoil"
            | "plantSeed"
            | "pvp"
            | "warp_from"
            | "apply_buffs"
            | "placeRobot"
            | "placeEphemeral"
            | "demuckerWand"
          >
        >;
        readonly entities: ReadonlyMap<
          ReadonlyBiomesId,
          ReadonlySet<
            | "shape"
            | "place"
            | "destroy"
            | "interact"
            | "administrate"
            | "createGroup"
            | "dump"
            | "placeCampsite"
            | "tillSoil"
            | "plantSeed"
            | "pvp"
            | "warp_from"
            | "apply_buffs"
            | "placeRobot"
            | "placeEphemeral"
            | "demuckerWand"
          >
        >;
        readonly teams: ReadonlyMap<
          ReadonlyBiomesId,
          ReadonlySet<
            | "shape"
            | "place"
            | "destroy"
            | "interact"
            | "administrate"
            | "createGroup"
            | "dump"
            | "placeCampsite"
            | "tillSoil"
            | "plantSeed"
            | "pvp"
            | "warp_from"
            | "apply_buffs"
            | "placeRobot"
            | "placeEphemeral"
            | "demuckerWand"
          >
        >;
        readonly creator:
          | readonly [
              ReadonlyBiomesId,
              ReadonlySet<
                | "shape"
                | "place"
                | "destroy"
                | "interact"
                | "administrate"
                | "createGroup"
                | "dump"
                | "placeCampsite"
                | "tillSoil"
                | "plantSeed"
                | "pvp"
                | "warp_from"
                | "apply_buffs"
                | "placeRobot"
                | "placeEphemeral"
                | "demuckerWand"
              >
            ]
          | undefined;
        readonly creatorTeam:
          | readonly [
              ReadonlyBiomesId,
              ReadonlySet<
                | "shape"
                | "place"
                | "destroy"
                | "interact"
                | "administrate"
                | "createGroup"
                | "dump"
                | "placeCampsite"
                | "tillSoil"
                | "plantSeed"
                | "pvp"
                | "warp_from"
                | "apply_buffs"
                | "placeRobot"
                | "placeEphemeral"
                | "demuckerWand"
              >
            ]
          | undefined;
      };
    }
  | undefined;
export type ReadonlyOptionalRestorationParams =
  | {
      readonly acl: {
        readonly everyone: ReadonlySet<
          | "shape"
          | "place"
          | "destroy"
          | "interact"
          | "administrate"
          | "createGroup"
          | "dump"
          | "placeCampsite"
          | "tillSoil"
          | "plantSeed"
          | "pvp"
          | "warp_from"
          | "apply_buffs"
          | "placeRobot"
          | "placeEphemeral"
          | "demuckerWand"
        >;
        readonly roles: ReadonlyMap<
          | "employee"
          | "admin"
          | "advancedOptions"
          | "deleteGroup"
          | "highlightGroup"
          | "unplaceGroup"
          | "repairGroup"
          | "seeGremlins"
          | "seeNpcs"
          | "bless"
          | "give"
          | "flying"
          | "internalSync"
          | "export"
          | "groundskeeper"
          | "clone"
          | "apply"
          | "twoWayInbox"
          | "baker"
          | "farmingAdmin"
          | "oobNoCors"
          | "noClip",
          ReadonlySet<
            | "shape"
            | "place"
            | "destroy"
            | "interact"
            | "administrate"
            | "createGroup"
            | "dump"
            | "placeCampsite"
            | "tillSoil"
            | "plantSeed"
            | "pvp"
            | "warp_from"
            | "apply_buffs"
            | "placeRobot"
            | "placeEphemeral"
            | "demuckerWand"
          >
        >;
        readonly entities: ReadonlyMap<
          ReadonlyBiomesId,
          ReadonlySet<
            | "shape"
            | "place"
            | "destroy"
            | "interact"
            | "administrate"
            | "createGroup"
            | "dump"
            | "placeCampsite"
            | "tillSoil"
            | "plantSeed"
            | "pvp"
            | "warp_from"
            | "apply_buffs"
            | "placeRobot"
            | "placeEphemeral"
            | "demuckerWand"
          >
        >;
        readonly teams: ReadonlyMap<
          ReadonlyBiomesId,
          ReadonlySet<
            | "shape"
            | "place"
            | "destroy"
            | "interact"
            | "administrate"
            | "createGroup"
            | "dump"
            | "placeCampsite"
            | "tillSoil"
            | "plantSeed"
            | "pvp"
            | "warp_from"
            | "apply_buffs"
            | "placeRobot"
            | "placeEphemeral"
            | "demuckerWand"
          >
        >;
        readonly creator:
          | readonly [
              ReadonlyBiomesId,
              ReadonlySet<
                | "shape"
                | "place"
                | "destroy"
                | "interact"
                | "administrate"
                | "createGroup"
                | "dump"
                | "placeCampsite"
                | "tillSoil"
                | "plantSeed"
                | "pvp"
                | "warp_from"
                | "apply_buffs"
                | "placeRobot"
                | "placeEphemeral"
                | "demuckerWand"
              >
            ]
          | undefined;
        readonly creatorTeam:
          | readonly [
              ReadonlyBiomesId,
              ReadonlySet<
                | "shape"
                | "place"
                | "destroy"
                | "interact"
                | "administrate"
                | "createGroup"
                | "dump"
                | "placeCampsite"
                | "tillSoil"
                | "plantSeed"
                | "pvp"
                | "warp_from"
                | "apply_buffs"
                | "placeRobot"
                | "placeEphemeral"
                | "demuckerWand"
              >
            ]
          | undefined;
      };
      readonly restore_delay_s: number;
    }
  | undefined;
export type ReadonlyRichEmoteComponents = {
  readonly fishing_info:
    | {
        readonly line_end_position:
          | (
              | ({
                  readonly velocity: readonly [number, number, number];
                  readonly gravity: readonly [number, number, number];
                  readonly start: readonly [number, number, number];
                } & { kind: "physics" })
              | ({
                  readonly start: readonly [number, number, number];
                  readonly duration: number;
                } & { kind: "reel_in" })
              | ({ readonly pos: readonly [number, number, number] } & {
                  kind: "fixed";
                })
            )
          | undefined;
        readonly line_end_item: ReadonlyItem | undefined;
      }
    | undefined;
  readonly throw_info:
    | (
        | {
            readonly physics: {
              readonly velocity: readonly [number, number, number];
              readonly gravity: readonly [number, number, number];
              readonly start: readonly [number, number, number];
            };
            readonly angular_velocity: readonly [number, number] | undefined;
          }
        | undefined
      )
    | undefined;
  readonly item_override: ReadonlyItem | undefined;
};
export type ReadonlyOptionalRichEmoteComponents =
  | {
      readonly fishing_info:
        | {
            readonly line_end_position:
              | (
                  | ({
                      readonly velocity: readonly [number, number, number];
                      readonly gravity: readonly [number, number, number];
                      readonly start: readonly [number, number, number];
                    } & { kind: "physics" })
                  | ({
                      readonly start: readonly [number, number, number];
                      readonly duration: number;
                    } & { kind: "reel_in" })
                  | ({ readonly pos: readonly [number, number, number] } & {
                      kind: "fixed";
                    })
                )
              | undefined;
            readonly line_end_item: ReadonlyItem | undefined;
          }
        | undefined;
      readonly throw_info:
        | (
            | {
                readonly physics: {
                  readonly velocity: readonly [number, number, number];
                  readonly gravity: readonly [number, number, number];
                  readonly start: readonly [number, number, number];
                };
                readonly angular_velocity:
                  | readonly [number, number]
                  | undefined;
              }
            | undefined
          )
        | undefined;
      readonly item_override: ReadonlyItem | undefined;
    }
  | undefined;

// =============
// Type defaults
// =============

export const defaultBuffer = () => new Uint8Array();
export const defaultString = "";
export const defaultBool = false;
export const defaultI8 = 0;
export const defaultI16 = 0;
export const defaultI32 = 0;
export const defaultI64 = 0n;
export const defaultU8 = 0;
export const defaultU16 = 0;
export const defaultU32 = 0;
export const defaultU64 = 0n;
export const defaultF32 = 0;
export const defaultF64 = 0;
export const defaultTensorBlob = "";
export const defaultConsumptionAction = "drink";
export const defaultEmoteType = "attack1";
export const defaultMovementActionType = "dodge";
export const defaultWarpHomeReason = "respawn";
export const defaultCameraMode = "normal";
export const defaultAclAction = "shape";
export const defaultUserRole = "employee";
export const defaultT109 = "aabb";
export const defaultT111 = "point";
export const defaultT113 = "points";
export const defaultT116 = "dayNight";
export const defaultT118 = "farFromHome";
export const defaultT120 = "adminKill";
export const defaultT122 = "outOfWorldBounds";
export const defaultT125 = "suicide";
export const defaultT127 = "despawnWand";
export const defaultT129 = "block";
export const defaultT131 = "fall";
export const defaultT133 = "attack";
export const defaultT135 = "drown";
export const defaultT137 = "fire";
export const defaultT139 = "fireDamage";
export const defaultT141 = "fireHeal";
export const defaultT143 = "heal";
export const defaultT145 = "npc";
export const defaultPlaceableAnimationType = "open";
export const defaultAnimationRepeatKind = "once";
export const defaultChallengeState = "available";
export const defaultLifetimeStatsType = "collected";
export const defaultPlantStatus = "planted";
export const defaultMinigameType = "simple_race";
export const defaultT174 = () => ({} as T174);
export const defaultT190 = "waiting";
export const defaultT200 = "water";
export const defaultT202 = "fertilize";
export const defaultT204 = "harvest";
export const defaultT206 = "adminDestroy";
export const defaultT208 = "poke";
export const defaultT214 = "biomes-social";
export const defaultT228 = "box";
export const defaultT230 = "sphere";
export const defaultEntityRestoreToState = "created";
export const defaultStrings = () => [];
export const defaultBiomesIdList = () => [];
export const defaultBiomesIdSet = () => new Set() as BiomesIdSet;
export const defaultVec2i = () => [defaultI32, defaultI32] as Vec2i;
export const defaultVec3i = () => [defaultI32, defaultI32, defaultI32] as Vec3i;
export const defaultVec4i = () =>
  [defaultI32, defaultI32, defaultI32, defaultI32] as Vec4i;
export const defaultVec2f = () => [defaultF64, defaultF64] as Vec2f;
export const defaultVec3f = () => [defaultF64, defaultF64, defaultF64] as Vec3f;
export const defaultVec4f = () =>
  [defaultF64, defaultF64, defaultF64, defaultF64] as Vec4f;
export const defaultMat3f = () =>
  [
    defaultF64,
    defaultF64,
    defaultF64,
    defaultF64,
    defaultF64,
    defaultF64,
    defaultF64,
    defaultF64,
    defaultF64,
  ] as Mat3f;
export const defaultT29 = () => [defaultI32, defaultI32, defaultI32] as T29;
export const defaultOptionalBool = undefined;
export const defaultOptionalI32 = undefined;
export const defaultOptionalU32 = undefined;
export const defaultOptionalI64 = undefined;
export const defaultOptionalU64 = undefined;
export const defaultOptionalF64 = undefined;
export const defaultOptionalBiomesId = undefined;
export const defaultOptionalTensorBlob = undefined;
export const defaultAppearance = () =>
  ({
    skin_color_id: defaultString,
    eye_color_id: defaultString,
    hair_color_id: defaultString,
    head_id: defaultBiomesId,
  } as Appearance);
export const defaultItemSlot = undefined;
export const defaultT48 = () =>
  ({
    contents: defaultItemAndCount(),
    price: defaultItemAndCount(),
    seller_id: defaultBiomesId,
  } as T48);
export const defaultOptionalItem = undefined;
export const defaultOptionalItemAndCount = undefined;
export const defaultItemSet = () => new Map() as ItemSet;
export const defaultItemBag = () => new Map() as ItemBag;
export const defaultItemAssignment = () => new Map() as ItemAssignment;
export const defaultItemAssignmentReference = () =>
  ({
    key: defaultBiomesId,
  } as ItemAssignmentReference);
export const defaultItemContainerReference = () =>
  ({
    idx: defaultU16,
  } as ItemContainerReference);
export const defaultItemBagReference = () =>
  ({
    key: defaultString,
  } as ItemBagReference);
export const defaultOptionalMovementActionType = undefined;
export const defaultOptionalEmoteType = undefined;
export const defaultOptionalShardId = undefined;
export const defaultOptionalString = undefined;
export const defaultOptionalBuffer = undefined;
export const defaultT92 = () => new Set() as T92;
export const defaultT93 = undefined;
export const defaultNUXStatus = () =>
  ({
    complete: defaultBool,
    state_id: defaultString,
  } as NUXStatus);
export const defaultUserRoleSet = () => new Set() as UserRoleSet;
export const defaultT101 = () => new Set() as T101;
export const defaultT117 = () =>
  ({
    kind: defaultT116,
  } as T117);
export const defaultT119 = () =>
  ({
    kind: defaultT118,
  } as T119);
export const defaultT121 = () =>
  ({
    kind: defaultT120,
  } as T121);
export const defaultT123 = () =>
  ({
    kind: defaultT122,
  } as T123);
export const defaultT126 = () =>
  ({
    kind: defaultT125,
  } as T126);
export const defaultT128 = () =>
  ({
    kind: defaultT127,
  } as T128);
export const defaultT130 = () =>
  ({
    kind: defaultT129,
    biscuitId: defaultBiomesId,
  } as T130);
export const defaultT132 = () =>
  ({
    kind: defaultT131,
    distance: defaultF64,
  } as T132);
export const defaultT136 = () =>
  ({
    kind: defaultT135,
  } as T136);
export const defaultT138 = () =>
  ({
    kind: defaultT137,
  } as T138);
export const defaultT140 = () =>
  ({
    kind: defaultT139,
  } as T140);
export const defaultT142 = () =>
  ({
    kind: defaultT141,
  } as T142);
export const defaultT144 = () =>
  ({
    kind: defaultT143,
  } as T144);
export const defaultOptionalAnimationRepeatKind = undefined;
export const defaultChallengeStateMap = () => new Map() as ChallengeStateMap;
export const defaultTriggerTrees = () => new Map() as TriggerTrees;
export const defaultChallengeTime = () => new Map() as ChallengeTime;
export const defaultTagRoundState = () =>
  ({
    it_player: defaultBiomesId,
  } as TagRoundState);
export const defaultT175 = () =>
  ({
    round_start: defaultF64,
  } as T175);
export const defaultT176 = () =>
  ({
    round_end: defaultF64,
  } as T176);
export const defaultT177 = () =>
  ({
    timestamp: defaultF64,
  } as T177);
export const defaultSpleefPlayerStats = () =>
  ({
    playerId: defaultBiomesId,
    rounds_won: defaultI32,
  } as SpleefPlayerStats);
export const defaultT188 = () =>
  ({
    time: defaultF64,
  } as T188);
export const defaultGiveMinigameKitData = () =>
  ({
    ...defaultT174(),
    kind: "simple_race",
  } as GiveMinigameKitData);
export const defaultT201 = () =>
  ({
    kind: defaultT200,
    amount: defaultF32,
    timestamp: defaultF64,
  } as T201);
export const defaultT203 = () =>
  ({
    kind: defaultT202,
    fertilizer: defaultItem(),
    timestamp: defaultF64,
  } as T203);
export const defaultT205 = () =>
  ({
    kind: defaultT204,
    timestamp: defaultF64,
  } as T205);
export const defaultT207 = () =>
  ({
    kind: defaultT206,
    timestamp: defaultF64,
  } as T207);
export const defaultT209 = () =>
  ({
    kind: defaultT208,
    timestamp: defaultF64,
  } as T209);
export const defaultTeamMemberMetadata = () =>
  ({
    joined_at: defaultF64,
  } as TeamMemberMetadata);
export const defaultTeamInvite = () =>
  ({
    inviter_id: defaultBiomesId,
    invitee_id: defaultBiomesId,
    created_at: defaultF64,
  } as TeamInvite);
export const defaultTeamJoinRequest = () =>
  ({
    entity_id: defaultBiomesId,
    created_at: defaultF64,
  } as TeamJoinRequest);
export const defaultT231 = () =>
  ({
    kind: defaultT230,
    radius: defaultF64,
  } as T231);
export const defaultTradeSpec = () =>
  ({
    trade_id: defaultBiomesId,
    id1: defaultBiomesId,
    id2: defaultBiomesId,
  } as TradeSpec);
export const defaultOptionalMat3f = undefined;
export const defaultVec3iList = () => [];
export const defaultBox2 = () =>
  ({
    v0: defaultVec3f(),
    v1: defaultVec3f(),
  } as Box2);
export const defaultOptionalVec3f = undefined;
export const defaultVec3fList = () => [];
export const defaultOptionalVec2f = undefined;
export const defaultTerrainUpdate = () =>
  [defaultVec3i(), defaultU32] as TerrainUpdate;
export const defaultPricedItemSlot = undefined;
export const defaultItemContainer = () => [];
export const defaultOptionalItemBag = undefined;
export const defaultOwnedItemReference = () =>
  ({
    ...defaultItemContainerReference(),
    kind: "item",
  } as OwnedItemReference);
export const defaultEmoteFishingLinePhysicsPosition = () =>
  ({
    velocity: defaultVec3f(),
    gravity: defaultVec3f(),
    start: defaultVec3f(),
  } as EmoteFishingLinePhysicsPosition);
export const defaultEmoteFishingLineReelInPosition = () =>
  ({
    start: defaultVec3f(),
    duration: defaultF64,
  } as EmoteFishingLineReelInPosition);
export const defaultEmoteFishingLineFixedPosition = () =>
  ({
    pos: defaultVec3f(),
  } as EmoteFishingLineFixedPosition);
export const defaultWarpTarget = () =>
  ({
    warp_to: defaultVec3f(),
    orientation: defaultVec2f(),
  } as WarpTarget);
export const defaultEntitiesAndExpiry = () =>
  ({
    entity_ids: defaultT92(),
    expiry: defaultT93,
  } as EntitiesAndExpiry);
export const defaultAllNUXStatus = () => new Map() as AllNUXStatus;
export const defaultT102 = () => [defaultBiomesId, defaultT101()] as T102;
export const defaultT104 = () => new Map() as T104;
export const defaultT105 = () => new Map() as T105;
export const defaultAabb = () => [defaultVec3f(), defaultVec3f()] as Aabb;
export const defaultT112 = () =>
  ({
    kind: defaultT111,
    point: defaultVec3f(),
  } as T112);
export const defaultNpcDamageSource = () =>
  ({
    ...defaultT117(),
    kind: "dayNight",
  } as NpcDamageSource);
export const defaultPlaceableAnimation = () =>
  ({
    type: defaultPlaceableAnimationType,
    repeat: defaultOptionalAnimationRepeatKind,
    start_time: defaultF64,
  } as PlaceableAnimation);
export const defaultLifetimeStatsMap = () => new Map() as LifetimeStatsMap;
export const defaultPositionBeamMap = () => new Map() as PositionBeamMap;
export const defaultPlaceEventInfo = () =>
  ({
    time: defaultF64,
    position: defaultVec3i(),
  } as PlaceEventInfo);
export const defaultBuff = () =>
  ({
    item_id: defaultBiomesId,
    start_time: defaultT93,
    from_id: defaultOptionalBiomesId,
    is_disabled: defaultOptionalBool,
  } as Buff);
export const defaultOptionalTagRoundState = undefined;
export const defaultT169 = () =>
  ({
    checkpoint_ids: defaultBiomesIdSet(),
    start_ids: defaultBiomesIdSet(),
    end_ids: defaultBiomesIdSet(),
  } as T169);
export const defaultT170 = () =>
  ({
    start_ids: defaultBiomesIdSet(),
  } as T170);
export const defaultT171 = () =>
  ({
    start_ids: defaultBiomesIdSet(),
    arena_marker_ids: defaultBiomesIdSet(),
  } as T171);
export const defaultDeathMatchPlayerState = () =>
  ({
    playerId: defaultBiomesId,
    kills: defaultI32,
    deaths: defaultI32,
    last_kill: defaultOptionalF64,
    last_death: defaultOptionalF64,
  } as DeathMatchPlayerState);
export const defaultT178 = () =>
  ({
    ...defaultT174(),
    kind: "waiting_for_players",
  } as T178);
export const defaultT183 = () =>
  ({
    round_start: defaultF64,
    last_winner_id: defaultOptionalBiomesId,
  } as T183);
export const defaultT186 = () => new Map() as T186;
export const defaultReachedCheckpoints = () => new Map() as ReachedCheckpoints;
export const defaultFarmingPlayerAction = () =>
  ({
    ...defaultT201(),
    kind: "water",
  } as FarmingPlayerAction);
export const defaultT212 = () =>
  ({
    type_ids: defaultBiomesIdList(),
  } as T212);
export const defaultBucketedImageCloudBundle = () =>
  ({
    webp_320w: defaultOptionalString,
    webp_640w: defaultOptionalString,
    webp_1280w: defaultOptionalString,
    png_1280w: defaultOptionalString,
    webp_original: defaultOptionalString,
    bucket: defaultT214,
  } as BucketedImageCloudBundle);
export const defaultTerrainRestorationEntry = () =>
  ({
    position_index: defaultU16,
    created_at: defaultF64,
    restore_time: defaultF64,
    terrain: defaultOptionalF64,
    placer: defaultOptionalF64,
    dye: defaultOptionalF64,
    shape: defaultOptionalF64,
  } as TerrainRestorationEntry);
export const defaultTeamPendingInvites = () => new Map() as TeamPendingInvites;
export const defaultTeamPendingRequests = () => [];
export const defaultTeamMembers = () => new Map() as TeamMembers;
export const defaultT229 = () =>
  ({
    kind: defaultT228,
    box: defaultVec3f(),
  } as T229);
export const defaultTradeSpecList = () => [];
export const defaultTerrainUpdateList = () => [];
export const defaultPricedItemContainer = () => [];
export const defaultOptionalOwnedItemReference = undefined;
export const defaultOwnedItemReferenceList = () => [];
export const defaultT64 = () =>
  [defaultOwnedItemReference(), defaultItemAndCount()] as T64;
export const defaultEmoteFishingLineEndPosition = () =>
  ({
    ...defaultEmoteFishingLinePhysicsPosition(),
    kind: "physics",
  } as EmoteFishingLineEndPosition);
export const defaultEmoteThrowInfo = () =>
  ({
    physics: defaultEmoteFishingLinePhysicsPosition(),
    angular_velocity: defaultOptionalVec2f,
  } as EmoteThrowInfo);
export const defaultOptionalWarpTarget = undefined;
export const defaultGrabBagFilter = () =>
  ({
    ...defaultEntitiesAndExpiry(),
    kind: "block",
  } as GrabBagFilter);
export const defaultTargetedAcl = undefined;
export const defaultOptionalAabb = undefined;
export const defaultT110 = () =>
  ({
    kind: defaultT109,
    aabb: defaultAabb(),
  } as T110);
export const defaultT114 = () =>
  ({
    kind: defaultT113,
    points: defaultVec3fList(),
  } as T114);
export const defaultT134 = () =>
  ({
    kind: defaultT133,
    attacker: defaultBiomesId,
    dir: defaultOptionalVec3f,
  } as T134);
export const defaultT146 = () =>
  ({
    kind: defaultT145,
    type: defaultNpcDamageSource(),
  } as T146);
export const defaultOptionalPlaceableAnimation = undefined;
export const defaultOptionalPlaceEventInfo = undefined;
export const defaultBuffsList = () => [];
export const defaultMinigameMetadata = () =>
  ({
    ...defaultT169(),
    kind: "simple_race",
  } as MinigameMetadata);
export const defaultT179 = undefined;
export const defaultT180 = () => new Map() as T180;
export const defaultT184 = () =>
  ({
    round_expires: defaultF64,
    alive_round_players: defaultBiomesIdSet(),
    tag_round_state: defaultOptionalTagRoundState,
  } as T184);
export const defaultSimpleRaceInstanceState = () =>
  ({
    player_state: defaultT190,
    started_at: defaultF64,
    deaths: defaultI32,
    reached_checkpoints: defaultReachedCheckpoints(),
    finished_at: defaultOptionalF64,
  } as SimpleRaceInstanceState);
export const defaultMinigameInstanceActivePlayerInfo = () =>
  ({
    entry_stash_id: defaultBiomesId,
    entry_position: defaultVec3f(),
    entry_warped_to: defaultOptionalVec3f,
    entry_time: defaultF64,
  } as MinigameInstanceActivePlayerInfo);
export const defaultT196 = () =>
  ({
    box: defaultBox2(),
    clipboard_entity_id: defaultBiomesId,
  } as T196);
export const defaultFarmingPlayerActionList = () => [];
export const defaultItemBuyerSpec = () =>
  ({
    ...defaultT212(),
    kind: "item_types",
  } as ItemBuyerSpec);
export const defaultTerrainRestorationEntryList = () => [];
export const defaultVolume = () =>
  ({
    ...defaultT229(),
    kind: "box",
  } as Volume);
export const defaultInventoryAssignmentPattern = () => [];
export const defaultT66 = () => [];
export const defaultT76 = undefined;
export const defaultT80 = undefined;
export const defaultAcl = () =>
  ({
    everyone: defaultT101(),
    roles: defaultT104(),
    entities: defaultT105(),
    teams: defaultT105(),
    creator: defaultTargetedAcl,
    creatorTeam: defaultTargetedAcl,
  } as Acl);
export const defaultAclDomain = () =>
  ({
    ...defaultT110(),
    kind: "aabb",
  } as AclDomain);
export const defaultDamageSource = () =>
  ({
    ...defaultT126(),
    kind: "suicide",
  } as DamageSource);
export const defaultDeathmatchInstanceState = () =>
  ({
    instance_state: defaultT179,
    player_states: defaultT180(),
  } as DeathmatchInstanceState);
export const defaultT185 = () =>
  ({
    ...defaultT174(),
    kind: "waiting_for_players",
  } as T185);
export const defaultMinigameInstanceActivePlayerMap = () =>
  new Map() as MinigameInstanceActivePlayerMap;
export const defaultT197 = () =>
  ({
    ...defaultT196(),
    kind: "aabb",
  } as T197);
export const defaultOptionalVolume = undefined;
export const defaultOptionalInventoryAssignmentPattern = undefined;
export const defaultEmoteFishingInfo = () =>
  ({
    line_end_position: defaultT76,
    line_end_item: defaultOptionalItem,
  } as EmoteFishingInfo);
export const defaultOptionalEmoteThrowInfo = undefined;
export const defaultOptionalDamageSource = undefined;
export const defaultSpleefInstanceState = () =>
  ({
    instance_state: defaultT185(),
    observer_spawn_points: defaultVec3fList(),
    player_stats: defaultT186(),
    round_number: defaultI32,
  } as SpleefInstanceState);
export const defaultMinigameInstanceSpaceClipboardInfo = () =>
  ({
    region: defaultT197(),
  } as MinigameInstanceSpaceClipboardInfo);
export const defaultProtectionParams = () =>
  ({
    acl: defaultAcl(),
  } as ProtectionParams);
export const defaultRestorationParams = () =>
  ({
    acl: defaultAcl(),
    restore_delay_s: defaultF64,
  } as RestorationParams);
export const defaultTrader = () =>
  ({
    id: defaultBiomesId,
    offer_assignment: defaultInventoryAssignmentPattern(),
    accepted: defaultBool,
  } as Trader);
export const defaultOptionalEmoteFishingInfo = undefined;
export const defaultMinigameInstanceState = () =>
  ({
    ...defaultSimpleRaceInstanceState(),
    kind: "simple_race",
  } as MinigameInstanceState);
export const defaultOptionalMinigameInstanceSpaceClipboardInfo = undefined;
export const defaultOptionalProtectionParams = undefined;
export const defaultOptionalRestorationParams = undefined;
export const defaultRichEmoteComponents = () =>
  ({
    fishing_info: defaultOptionalEmoteFishingInfo,
    throw_info: defaultOptionalEmoteThrowInfo,
    item_override: defaultOptionalItem,
  } as RichEmoteComponents);
export const defaultOptionalRichEmoteComponents = undefined;

// ==================
// Type Serialization
// ==================

// Hand-written logic for big integers.
const serializeBigInt = (value: number | bigint): string => {
  return String(value);
};
const deserializeBigInt = (value: unknown): bigint => {
  if (typeof value === "bigint") {
    return value;
  } else if (typeof value === "number" && isInteger(value)) {
    return BigInt(value);
  } else if (typeof value === "string" && value.match(/^-?\d+$/)) {
    return BigInt(value);
  }
  throw new Error(`Invalid bigint value: ${value}`);
};

export const serializeI64 = serializeBigInt;
export const deserializeI64 = deserializeBigInt;
export const serializeU64 = serializeBigInt;
export const deserializeU64 = deserializeBigInt;

const zGenericArray = z.array(z.unknown()).default([]);
const zDiscriminatedObject = z.object({ kind: z.string() }).passthrough();
const zGenericMapArray = z
  .array(z.tuple([z.unknown(), z.unknown()]))
  .default([]);

export function deserializeBuffer(data: unknown): Buffer {
  return zBuffer.parse(data);
}

export function deserializeString(data: unknown): String {
  return zString.parse(data);
}

export function deserializeBool(data: unknown): Bool {
  return zBool.parse(data);
}

export function deserializeI8(data: unknown): I8 {
  return zI8.parse(data);
}

export function deserializeI16(data: unknown): I16 {
  return zI16.parse(data);
}

export function deserializeI32(data: unknown): I32 {
  return zI32.parse(data);
}

export function deserializeU8(data: unknown): U8 {
  return zU8.parse(data);
}

export function deserializeU16(data: unknown): U16 {
  return zU16.parse(data);
}

export function deserializeU32(data: unknown): U32 {
  return zU32.parse(data);
}

export function deserializeF32(data: unknown): F32 {
  return zF32.parse(data);
}

export function deserializeF64(data: unknown): F64 {
  return zF64.parse(data);
}

export function deserializeTensorBlob(data: unknown): TensorBlob {
  return zTensorBlob.parse(data);
}

export function deserializeConsumptionAction(data: unknown): ConsumptionAction {
  return zConsumptionAction.parse(data);
}

export function deserializeEmoteType(data: unknown): EmoteType {
  return zEmoteType.parse(data);
}

export function deserializeMovementActionType(
  data: unknown
): MovementActionType {
  return zMovementActionType.parse(data);
}

export function deserializeWarpHomeReason(data: unknown): WarpHomeReason {
  return zWarpHomeReason.parse(data);
}

export function deserializeCameraMode(data: unknown): CameraMode {
  return zCameraMode.parse(data);
}

export function deserializeAclAction(data: unknown): AclAction {
  return zAclAction.parse(data);
}

export function deserializeUserRole(data: unknown): UserRole {
  return zUserRole.parse(data);
}

export function deserializeT109(data: unknown): T109 {
  return zT109.parse(data);
}

export function deserializeT111(data: unknown): T111 {
  return zT111.parse(data);
}

export function deserializeT113(data: unknown): T113 {
  return zT113.parse(data);
}

export function deserializeT116(data: unknown): T116 {
  return zT116.parse(data);
}

export function deserializeT118(data: unknown): T118 {
  return zT118.parse(data);
}

export function deserializeT120(data: unknown): T120 {
  return zT120.parse(data);
}

export function deserializeT122(data: unknown): T122 {
  return zT122.parse(data);
}

export function deserializeT125(data: unknown): T125 {
  return zT125.parse(data);
}

export function deserializeT127(data: unknown): T127 {
  return zT127.parse(data);
}

export function deserializeT129(data: unknown): T129 {
  return zT129.parse(data);
}

export function deserializeT131(data: unknown): T131 {
  return zT131.parse(data);
}

export function deserializeT133(data: unknown): T133 {
  return zT133.parse(data);
}

export function deserializeT135(data: unknown): T135 {
  return zT135.parse(data);
}

export function deserializeT137(data: unknown): T137 {
  return zT137.parse(data);
}

export function deserializeT139(data: unknown): T139 {
  return zT139.parse(data);
}

export function deserializeT141(data: unknown): T141 {
  return zT141.parse(data);
}

export function deserializeT143(data: unknown): T143 {
  return zT143.parse(data);
}

export function deserializeT145(data: unknown): T145 {
  return zT145.parse(data);
}

export function deserializePlaceableAnimationType(
  data: unknown
): PlaceableAnimationType {
  return zPlaceableAnimationType.parse(data);
}

export function deserializeAnimationRepeatKind(
  data: unknown
): AnimationRepeatKind {
  return zAnimationRepeatKind.parse(data);
}

export function deserializeChallengeState(data: unknown): ChallengeState {
  return zChallengeState.parse(data);
}

export function deserializeLifetimeStatsType(data: unknown): LifetimeStatsType {
  return zLifetimeStatsType.parse(data);
}

export function deserializePlantStatus(data: unknown): PlantStatus {
  return zPlantStatus.parse(data);
}

export function deserializeMinigameType(data: unknown): MinigameType {
  return zMinigameType.parse(data);
}

const zRawT174 = z.object({});

export function deserializeT174(data: unknown): T174 {
  const obj = zRawT174.parse(data);
  return {};
}

export function deserializeT190(data: unknown): T190 {
  return zT190.parse(data);
}

export function deserializeT200(data: unknown): T200 {
  return zT200.parse(data);
}

export function deserializeT202(data: unknown): T202 {
  return zT202.parse(data);
}

export function deserializeT204(data: unknown): T204 {
  return zT204.parse(data);
}

export function deserializeT206(data: unknown): T206 {
  return zT206.parse(data);
}

export function deserializeT208(data: unknown): T208 {
  return zT208.parse(data);
}

export function deserializeT214(data: unknown): T214 {
  return zT214.parse(data);
}

export function deserializeT228(data: unknown): T228 {
  return zT228.parse(data);
}

export function deserializeT230(data: unknown): T230 {
  return zT230.parse(data);
}

export function deserializeEntityRestoreToState(
  data: unknown
): EntityRestoreToState {
  return zEntityRestoreToState.parse(data);
}

export function deserializeStrings(data: unknown): Strings {
  const arr = zGenericArray.parse(data);
  return arr.map((x: any) => deserializeString(x));
}
export function serializeBiomesIdList(value: ReadonlyBiomesIdList) {
  return value.map((x) => serializeBiomesId(x));
}

export function deserializeBiomesIdList(data: unknown): BiomesIdList {
  const arr = zGenericArray.parse(data);
  return arr.map((x: any) => deserializeBiomesId(x));
}
export function serializeBiomesIdSet(value: ReadonlyBiomesIdSet) {
  return Array.from(value, (v) => serializeBiomesId(v));
}

export function deserializeBiomesIdSet(data: unknown): BiomesIdSet {
  const arr = zGenericArray.parse(data);
  return new Set(arr.map((v: any) => deserializeBiomesId(v)));
}

export function deserializeVec2i(data: unknown): Vec2i {
  const arr = zGenericArray.parse(data);
  return [deserializeI32(arr[0]), deserializeI32(arr[1])];
}

export function deserializeVec3i(data: unknown): Vec3i {
  const arr = zGenericArray.parse(data);
  return [
    deserializeI32(arr[0]),
    deserializeI32(arr[1]),
    deserializeI32(arr[2]),
  ];
}

export function deserializeVec4i(data: unknown): Vec4i {
  const arr = zGenericArray.parse(data);
  return [
    deserializeI32(arr[0]),
    deserializeI32(arr[1]),
    deserializeI32(arr[2]),
    deserializeI32(arr[3]),
  ];
}

export function deserializeVec2f(data: unknown): Vec2f {
  const arr = zGenericArray.parse(data);
  return [deserializeF64(arr[0]), deserializeF64(arr[1])];
}

export function deserializeVec3f(data: unknown): Vec3f {
  const arr = zGenericArray.parse(data);
  return [
    deserializeF64(arr[0]),
    deserializeF64(arr[1]),
    deserializeF64(arr[2]),
  ];
}

export function deserializeVec4f(data: unknown): Vec4f {
  const arr = zGenericArray.parse(data);
  return [
    deserializeF64(arr[0]),
    deserializeF64(arr[1]),
    deserializeF64(arr[2]),
    deserializeF64(arr[3]),
  ];
}

export function deserializeMat3f(data: unknown): Mat3f {
  const arr = zGenericArray.parse(data);
  return [
    deserializeF64(arr[0]),
    deserializeF64(arr[1]),
    deserializeF64(arr[2]),
    deserializeF64(arr[3]),
    deserializeF64(arr[4]),
    deserializeF64(arr[5]),
    deserializeF64(arr[6]),
    deserializeF64(arr[7]),
    deserializeF64(arr[8]),
  ];
}

export function deserializeT29(data: unknown): T29 {
  const arr = zGenericArray.parse(data);
  return [
    deserializeI32(arr[0]),
    deserializeI32(arr[1]),
    deserializeI32(arr[2]),
  ];
}

export function deserializeOptionalBool(data: unknown): OptionalBool {
  return data === null || data === undefined
    ? undefined
    : deserializeBool(data);
}

export function deserializeOptionalI32(data: unknown): OptionalI32 {
  return data === null || data === undefined ? undefined : deserializeI32(data);
}

export function deserializeOptionalU32(data: unknown): OptionalU32 {
  return data === null || data === undefined ? undefined : deserializeU32(data);
}
export function serializeOptionalI64(value: ReadonlyOptionalI64) {
  return value === undefined || value === null
    ? undefined
    : serializeI64(value);
}

export function deserializeOptionalI64(data: unknown): OptionalI64 {
  return data === null || data === undefined ? undefined : deserializeI64(data);
}
export function serializeOptionalU64(value: ReadonlyOptionalU64) {
  return value === undefined || value === null
    ? undefined
    : serializeU64(value);
}

export function deserializeOptionalU64(data: unknown): OptionalU64 {
  return data === null || data === undefined ? undefined : deserializeU64(data);
}

export function deserializeOptionalF64(data: unknown): OptionalF64 {
  return data === null || data === undefined ? undefined : deserializeF64(data);
}
export function serializeOptionalBiomesId(value: ReadonlyOptionalBiomesId) {
  return value === undefined || value === null
    ? undefined
    : serializeBiomesId(value);
}

export function deserializeOptionalBiomesId(data: unknown): OptionalBiomesId {
  return data === null || data === undefined
    ? undefined
    : deserializeBiomesId(data);
}

export function deserializeOptionalTensorBlob(
  data: unknown
): OptionalTensorBlob {
  return data === null || data === undefined
    ? undefined
    : deserializeTensorBlob(data);
}
export function serializeAppearance(value: ReadonlyAppearance) {
  return {
    skin_color_id: value.skin_color_id,
    eye_color_id: value.eye_color_id,
    hair_color_id: value.hair_color_id,
    head_id: serializeBiomesId(value.head_id),
  };
}

const zRawAppearance = z.object({
  skin_color_id: z.unknown(),
  eye_color_id: z.unknown(),
  hair_color_id: z.unknown(),
  head_id: z.unknown(),
});

export function deserializeAppearance(data: unknown): Appearance {
  const obj = zRawAppearance.parse(data);
  return {
    skin_color_id: deserializeString(obj.skin_color_id),
    eye_color_id: deserializeString(obj.eye_color_id),
    hair_color_id: deserializeString(obj.hair_color_id),
    head_id: deserializeBiomesId(obj.head_id),
  };
}
export function serializeItemSlot(value: ReadonlyItemSlot) {
  return value === undefined || value === null
    ? undefined
    : serializeItemAndCount(value);
}

export function deserializeItemSlot(data: unknown): ItemSlot {
  return data === null || data === undefined
    ? undefined
    : deserializeItemAndCount(data);
}
export function serializeT48(value: ReadonlyT48) {
  return {
    contents: serializeItemAndCount(value.contents),
    price: serializeItemAndCount(value.price),
    seller_id: serializeBiomesId(value.seller_id),
  };
}

const zRawT48 = z.object({
  contents: z.unknown(),
  price: z.unknown(),
  seller_id: z.unknown(),
});

export function deserializeT48(data: unknown): T48 {
  const obj = zRawT48.parse(data);
  return {
    contents: deserializeItemAndCount(obj.contents),
    price: deserializeItemAndCount(obj.price),
    seller_id: deserializeBiomesId(obj.seller_id),
  };
}
export function serializeOptionalItem(value: ReadonlyOptionalItem) {
  return value === undefined || value === null
    ? undefined
    : serializeItem(value);
}

export function deserializeOptionalItem(data: unknown): OptionalItem {
  return data === null || data === undefined
    ? undefined
    : deserializeItem(data);
}
export function serializeOptionalItemAndCount(
  value: ReadonlyOptionalItemAndCount
) {
  return value === undefined || value === null
    ? undefined
    : serializeItemAndCount(value);
}

export function deserializeOptionalItemAndCount(
  data: unknown
): OptionalItemAndCount {
  return data === null || data === undefined
    ? undefined
    : deserializeItemAndCount(data);
}
export function serializeItemSet(value: ReadonlyItemSet) {
  return Array.from(value, ([k, v]) => [k, serializeItem(v)]);
}

export function deserializeItemSet(data: unknown): ItemSet {
  const arr = zGenericMapArray.parse(data);
  return new Map(
    arr.map(([k, v]: any) => [deserializeString(k), deserializeItem(v)])
  );
}
export function serializeItemBag(value: ReadonlyItemBag) {
  return Array.from(value, ([k, v]) => [k, serializeItemAndCount(v)]);
}

export function deserializeItemBag(data: unknown): ItemBag {
  const arr = zGenericMapArray.parse(data);
  return new Map(
    arr.map(([k, v]: any) => [deserializeString(k), deserializeItemAndCount(v)])
  );
}
export function serializeItemAssignment(value: ReadonlyItemAssignment) {
  return Array.from(value, ([k, v]) => [
    serializeBiomesId(k),
    serializeItem(v),
  ]);
}

export function deserializeItemAssignment(data: unknown): ItemAssignment {
  const arr = zGenericMapArray.parse(data);
  return new Map(
    arr.map(([k, v]: any) => [deserializeBiomesId(k), deserializeItem(v)])
  );
}
export function serializeItemAssignmentReference(
  value: ReadonlyItemAssignmentReference
) {
  return {
    key: serializeBiomesId(value.key),
  };
}

const zRawItemAssignmentReference = z.object({
  key: z.unknown(),
});

export function deserializeItemAssignmentReference(
  data: unknown
): ItemAssignmentReference {
  const obj = zRawItemAssignmentReference.parse(data);
  return {
    key: deserializeBiomesId(obj.key),
  };
}

const zRawItemContainerReference = z.object({
  idx: z.unknown(),
});

export function deserializeItemContainerReference(
  data: unknown
): ItemContainerReference {
  const obj = zRawItemContainerReference.parse(data);
  return {
    idx: deserializeU16(obj.idx),
  };
}

const zRawItemBagReference = z.object({
  key: z.unknown(),
});

export function deserializeItemBagReference(data: unknown): ItemBagReference {
  const obj = zRawItemBagReference.parse(data);
  return {
    key: deserializeString(obj.key),
  };
}

export function deserializeOptionalMovementActionType(
  data: unknown
): OptionalMovementActionType {
  return data === null || data === undefined
    ? undefined
    : deserializeMovementActionType(data);
}

export function deserializeOptionalEmoteType(data: unknown): OptionalEmoteType {
  return data === null || data === undefined
    ? undefined
    : deserializeEmoteType(data);
}
export function serializeOptionalShardId(value: ReadonlyOptionalShardId) {
  return value === undefined || value === null
    ? undefined
    : serializeShardId(value);
}

export function deserializeOptionalShardId(data: unknown): OptionalShardId {
  return data === null || data === undefined
    ? undefined
    : deserializeShardId(data);
}

export function deserializeOptionalString(data: unknown): OptionalString {
  return data === null || data === undefined
    ? undefined
    : deserializeString(data);
}

export function deserializeOptionalBuffer(data: unknown): OptionalBuffer {
  return data === null || data === undefined
    ? undefined
    : deserializeBuffer(data);
}
export function serializeT92(value: ReadonlyT92) {
  return Array.from(value, (v) => serializeBiomesId(v));
}

export function deserializeT92(data: unknown): T92 {
  const arr = zGenericArray.parse(data);
  return new Set(arr.map((v: any) => deserializeBiomesId(v)));
}

export function deserializeT93(data: unknown): T93 {
  return data === null || data === undefined ? undefined : deserializeF64(data);
}

const zRawNUXStatus = z.object({
  complete: z.unknown(),
  state_id: z.unknown(),
});

export function deserializeNUXStatus(data: unknown): NUXStatus {
  const obj = zRawNUXStatus.parse(data);
  return {
    complete: deserializeBool(obj.complete),
    state_id: deserializeString(obj.state_id),
  };
}
export function serializeUserRoleSet(value: ReadonlyUserRoleSet) {
  return Array.from(value, (v) => v);
}

export function deserializeUserRoleSet(data: unknown): UserRoleSet {
  const arr = zGenericArray.parse(data);
  return new Set(arr.map((v: any) => deserializeUserRole(v)));
}
export function serializeT101(value: ReadonlyT101) {
  return Array.from(value, (v) => v);
}

export function deserializeT101(data: unknown): T101 {
  const arr = zGenericArray.parse(data);
  return new Set(arr.map((v: any) => deserializeAclAction(v)));
}

const zRawT117 = z.object({
  kind: z.unknown(),
});

export function deserializeT117(data: unknown): T117 {
  const obj = zRawT117.parse(data);
  return {
    kind: deserializeT116(obj.kind),
  };
}

const zRawT119 = z.object({
  kind: z.unknown(),
});

export function deserializeT119(data: unknown): T119 {
  const obj = zRawT119.parse(data);
  return {
    kind: deserializeT118(obj.kind),
  };
}

const zRawT121 = z.object({
  kind: z.unknown(),
});

export function deserializeT121(data: unknown): T121 {
  const obj = zRawT121.parse(data);
  return {
    kind: deserializeT120(obj.kind),
  };
}

const zRawT123 = z.object({
  kind: z.unknown(),
});

export function deserializeT123(data: unknown): T123 {
  const obj = zRawT123.parse(data);
  return {
    kind: deserializeT122(obj.kind),
  };
}

const zRawT126 = z.object({
  kind: z.unknown(),
});

export function deserializeT126(data: unknown): T126 {
  const obj = zRawT126.parse(data);
  return {
    kind: deserializeT125(obj.kind),
  };
}

const zRawT128 = z.object({
  kind: z.unknown(),
});

export function deserializeT128(data: unknown): T128 {
  const obj = zRawT128.parse(data);
  return {
    kind: deserializeT127(obj.kind),
  };
}
export function serializeT130(value: ReadonlyT130) {
  return {
    kind: value.kind,
    biscuitId: serializeBiomesId(value.biscuitId),
  };
}

const zRawT130 = z.object({
  kind: z.unknown(),
  biscuitId: z.unknown(),
});

export function deserializeT130(data: unknown): T130 {
  const obj = zRawT130.parse(data);
  return {
    kind: deserializeT129(obj.kind),
    biscuitId: deserializeBiomesId(obj.biscuitId),
  };
}

const zRawT132 = z.object({
  kind: z.unknown(),
  distance: z.unknown(),
});

export function deserializeT132(data: unknown): T132 {
  const obj = zRawT132.parse(data);
  return {
    kind: deserializeT131(obj.kind),
    distance: deserializeF64(obj.distance),
  };
}

const zRawT136 = z.object({
  kind: z.unknown(),
});

export function deserializeT136(data: unknown): T136 {
  const obj = zRawT136.parse(data);
  return {
    kind: deserializeT135(obj.kind),
  };
}

const zRawT138 = z.object({
  kind: z.unknown(),
});

export function deserializeT138(data: unknown): T138 {
  const obj = zRawT138.parse(data);
  return {
    kind: deserializeT137(obj.kind),
  };
}

const zRawT140 = z.object({
  kind: z.unknown(),
});

export function deserializeT140(data: unknown): T140 {
  const obj = zRawT140.parse(data);
  return {
    kind: deserializeT139(obj.kind),
  };
}

const zRawT142 = z.object({
  kind: z.unknown(),
});

export function deserializeT142(data: unknown): T142 {
  const obj = zRawT142.parse(data);
  return {
    kind: deserializeT141(obj.kind),
  };
}

const zRawT144 = z.object({
  kind: z.unknown(),
});

export function deserializeT144(data: unknown): T144 {
  const obj = zRawT144.parse(data);
  return {
    kind: deserializeT143(obj.kind),
  };
}

export function deserializeOptionalAnimationRepeatKind(
  data: unknown
): OptionalAnimationRepeatKind {
  return data === null || data === undefined
    ? undefined
    : deserializeAnimationRepeatKind(data);
}
export function serializeChallengeStateMap(value: ReadonlyChallengeStateMap) {
  return Array.from(value, ([k, v]) => [serializeBiomesId(k), v]);
}

export function deserializeChallengeStateMap(data: unknown): ChallengeStateMap {
  const arr = zGenericMapArray.parse(data);
  return new Map(
    arr.map(([k, v]: any) => [
      deserializeBiomesId(k),
      deserializeChallengeState(v),
    ])
  );
}
export function serializeTriggerTrees(value: ReadonlyTriggerTrees) {
  return Array.from(value, ([k, v]) => [
    serializeBiomesId(k),
    serializeTriggerStateMap(v),
  ]);
}

export function deserializeTriggerTrees(data: unknown): TriggerTrees {
  const arr = zGenericMapArray.parse(data);
  return new Map(
    arr.map(([k, v]: any) => [
      deserializeBiomesId(k),
      deserializeTriggerStateMap(v),
    ])
  );
}
export function serializeChallengeTime(value: ReadonlyChallengeTime) {
  return Array.from(value, ([k, v]) => [serializeBiomesId(k), v]);
}

export function deserializeChallengeTime(data: unknown): ChallengeTime {
  const arr = zGenericMapArray.parse(data);
  return new Map(
    arr.map(([k, v]: any) => [deserializeBiomesId(k), deserializeF64(v)])
  );
}
export function serializeTagRoundState(value: ReadonlyTagRoundState) {
  return {
    it_player: serializeBiomesId(value.it_player),
  };
}

const zRawTagRoundState = z.object({
  it_player: z.unknown(),
});

export function deserializeTagRoundState(data: unknown): TagRoundState {
  const obj = zRawTagRoundState.parse(data);
  return {
    it_player: deserializeBiomesId(obj.it_player),
  };
}

const zRawT175 = z.object({
  round_start: z.unknown(),
});

export function deserializeT175(data: unknown): T175 {
  const obj = zRawT175.parse(data);
  return {
    round_start: deserializeF64(obj.round_start),
  };
}

const zRawT176 = z.object({
  round_end: z.unknown(),
});

export function deserializeT176(data: unknown): T176 {
  const obj = zRawT176.parse(data);
  return {
    round_end: deserializeF64(obj.round_end),
  };
}

const zRawT177 = z.object({
  timestamp: z.unknown(),
});

export function deserializeT177(data: unknown): T177 {
  const obj = zRawT177.parse(data);
  return {
    timestamp: deserializeF64(obj.timestamp),
  };
}
export function serializeSpleefPlayerStats(value: ReadonlySpleefPlayerStats) {
  return {
    playerId: serializeBiomesId(value.playerId),
    rounds_won: value.rounds_won,
  };
}

const zRawSpleefPlayerStats = z.object({
  playerId: z.unknown(),
  rounds_won: z.unknown(),
});

export function deserializeSpleefPlayerStats(data: unknown): SpleefPlayerStats {
  const obj = zRawSpleefPlayerStats.parse(data);
  return {
    playerId: deserializeBiomesId(obj.playerId),
    rounds_won: deserializeI32(obj.rounds_won),
  };
}

const zRawT188 = z.object({
  time: z.unknown(),
});

export function deserializeT188(data: unknown): T188 {
  const obj = zRawT188.parse(data);
  return {
    time: deserializeF64(obj.time),
  };
}
export function serializeGiveMinigameKitData(
  value: ReadonlyGiveMinigameKitData
) {
  switch (value.kind) {
    case "simple_race":
      return {
        ...value,
        kind: "simple_race",
      };
    case "deathmatch":
      return {
        ...value,
        kind: "deathmatch",
      };
    case "spleef":
      return {
        ...value,
        kind: "spleef",
      };
  }
}

export function deserializeGiveMinigameKitData(
  data: unknown
): GiveMinigameKitData {
  const obj = zDiscriminatedObject.parse(data);
  switch (obj.kind) {
    case "simple_race":
      return {
        ...deserializeT174(obj),
        kind: "simple_race",
      };
    case "deathmatch":
      return {
        ...deserializeT174(obj),
        kind: "deathmatch",
      };
    case "spleef":
      return {
        ...deserializeT174(obj),
        kind: "spleef",
      };
    default:
      throw new Error(`Unknown OneOf variant: ${obj.kind}`);
  }
}

const zRawT201 = z.object({
  kind: z.unknown(),
  amount: z.unknown(),
  timestamp: z.unknown(),
});

export function deserializeT201(data: unknown): T201 {
  const obj = zRawT201.parse(data);
  return {
    kind: deserializeT200(obj.kind),
    amount: deserializeF32(obj.amount),
    timestamp: deserializeF64(obj.timestamp),
  };
}
export function serializeT203(value: ReadonlyT203) {
  return {
    kind: value.kind,
    fertilizer: serializeItem(value.fertilizer),
    timestamp: value.timestamp,
  };
}

const zRawT203 = z.object({
  kind: z.unknown(),
  fertilizer: z.unknown(),
  timestamp: z.unknown(),
});

export function deserializeT203(data: unknown): T203 {
  const obj = zRawT203.parse(data);
  return {
    kind: deserializeT202(obj.kind),
    fertilizer: deserializeItem(obj.fertilizer),
    timestamp: deserializeF64(obj.timestamp),
  };
}

const zRawT205 = z.object({
  kind: z.unknown(),
  timestamp: z.unknown(),
});

export function deserializeT205(data: unknown): T205 {
  const obj = zRawT205.parse(data);
  return {
    kind: deserializeT204(obj.kind),
    timestamp: deserializeF64(obj.timestamp),
  };
}

const zRawT207 = z.object({
  kind: z.unknown(),
  timestamp: z.unknown(),
});

export function deserializeT207(data: unknown): T207 {
  const obj = zRawT207.parse(data);
  return {
    kind: deserializeT206(obj.kind),
    timestamp: deserializeF64(obj.timestamp),
  };
}

const zRawT209 = z.object({
  kind: z.unknown(),
  timestamp: z.unknown(),
});

export function deserializeT209(data: unknown): T209 {
  const obj = zRawT209.parse(data);
  return {
    kind: deserializeT208(obj.kind),
    timestamp: deserializeF64(obj.timestamp),
  };
}

const zRawTeamMemberMetadata = z.object({
  joined_at: z.unknown(),
});

export function deserializeTeamMemberMetadata(
  data: unknown
): TeamMemberMetadata {
  const obj = zRawTeamMemberMetadata.parse(data);
  return {
    joined_at: deserializeF64(obj.joined_at),
  };
}
export function serializeTeamInvite(value: ReadonlyTeamInvite) {
  return {
    inviter_id: serializeBiomesId(value.inviter_id),
    invitee_id: serializeBiomesId(value.invitee_id),
    created_at: value.created_at,
  };
}

const zRawTeamInvite = z.object({
  inviter_id: z.unknown(),
  invitee_id: z.unknown(),
  created_at: z.unknown(),
});

export function deserializeTeamInvite(data: unknown): TeamInvite {
  const obj = zRawTeamInvite.parse(data);
  return {
    inviter_id: deserializeBiomesId(obj.inviter_id),
    invitee_id: deserializeBiomesId(obj.invitee_id),
    created_at: deserializeF64(obj.created_at),
  };
}
export function serializeTeamJoinRequest(value: ReadonlyTeamJoinRequest) {
  return {
    entity_id: serializeBiomesId(value.entity_id),
    created_at: value.created_at,
  };
}

const zRawTeamJoinRequest = z.object({
  entity_id: z.unknown(),
  created_at: z.unknown(),
});

export function deserializeTeamJoinRequest(data: unknown): TeamJoinRequest {
  const obj = zRawTeamJoinRequest.parse(data);
  return {
    entity_id: deserializeBiomesId(obj.entity_id),
    created_at: deserializeF64(obj.created_at),
  };
}

const zRawT231 = z.object({
  kind: z.unknown(),
  radius: z.unknown(),
});

export function deserializeT231(data: unknown): T231 {
  const obj = zRawT231.parse(data);
  return {
    kind: deserializeT230(obj.kind),
    radius: deserializeF64(obj.radius),
  };
}
export function serializeTradeSpec(value: ReadonlyTradeSpec) {
  return {
    trade_id: serializeBiomesId(value.trade_id),
    id1: serializeBiomesId(value.id1),
    id2: serializeBiomesId(value.id2),
  };
}

const zRawTradeSpec = z.object({
  trade_id: z.unknown(),
  id1: z.unknown(),
  id2: z.unknown(),
});

export function deserializeTradeSpec(data: unknown): TradeSpec {
  const obj = zRawTradeSpec.parse(data);
  return {
    trade_id: deserializeBiomesId(obj.trade_id),
    id1: deserializeBiomesId(obj.id1),
    id2: deserializeBiomesId(obj.id2),
  };
}

export function deserializeOptionalMat3f(data: unknown): OptionalMat3f {
  return data === null || data === undefined
    ? undefined
    : deserializeMat3f(data);
}

export function deserializeVec3iList(data: unknown): Vec3iList {
  const arr = zGenericArray.parse(data);
  return arr.map((x: any) => deserializeT29(x));
}

const zRawBox2 = z.object({
  v0: z.unknown(),
  v1: z.unknown(),
});

export function deserializeBox2(data: unknown): Box2 {
  const obj = zRawBox2.parse(data);
  return {
    v0: deserializeVec3f(obj.v0),
    v1: deserializeVec3f(obj.v1),
  };
}

export function deserializeOptionalVec3f(data: unknown): OptionalVec3f {
  return data === null || data === undefined
    ? undefined
    : deserializeVec3f(data);
}

export function deserializeVec3fList(data: unknown): Vec3fList {
  const arr = zGenericArray.parse(data);
  return arr.map((x: any) => deserializeVec3f(x));
}

export function deserializeOptionalVec2f(data: unknown): OptionalVec2f {
  return data === null || data === undefined
    ? undefined
    : deserializeVec2f(data);
}

export function deserializeTerrainUpdate(data: unknown): TerrainUpdate {
  const arr = zGenericArray.parse(data);
  return [deserializeVec3i(arr[0]), deserializeU32(arr[1])];
}
export function serializePricedItemSlot(value: ReadonlyPricedItemSlot) {
  return value === undefined || value === null
    ? undefined
    : serializeT48(value);
}

export function deserializePricedItemSlot(data: unknown): PricedItemSlot {
  return data === null || data === undefined ? undefined : deserializeT48(data);
}
export function serializeItemContainer(value: ReadonlyItemContainer) {
  return value.map((x) => serializeItemSlot(x));
}

export function deserializeItemContainer(data: unknown): ItemContainer {
  const arr = zGenericArray.parse(data);
  return arr.map((x: any) => deserializeItemSlot(x));
}
export function serializeOptionalItemBag(value: ReadonlyOptionalItemBag) {
  return value === undefined || value === null
    ? undefined
    : serializeItemBag(value);
}

export function deserializeOptionalItemBag(data: unknown): OptionalItemBag {
  return data === null || data === undefined
    ? undefined
    : deserializeItemBag(data);
}
export function serializeOwnedItemReference(value: ReadonlyOwnedItemReference) {
  switch (value.kind) {
    case "item":
      return {
        ...value,
        kind: "item",
      };
    case "hotbar":
      return {
        ...value,
        kind: "hotbar",
      };
    case "currency":
      return {
        ...value,
        kind: "currency",
      };
    case "wearable":
      return {
        ...serializeItemAssignmentReference(value),
        kind: "wearable",
      };
  }
}

export function deserializeOwnedItemReference(
  data: unknown
): OwnedItemReference {
  const obj = zDiscriminatedObject.parse(data);
  switch (obj.kind) {
    case "item":
      return {
        ...deserializeItemContainerReference(obj),
        kind: "item",
      };
    case "hotbar":
      return {
        ...deserializeItemContainerReference(obj),
        kind: "hotbar",
      };
    case "currency":
      return {
        ...deserializeItemBagReference(obj),
        kind: "currency",
      };
    case "wearable":
      return {
        ...deserializeItemAssignmentReference(obj),
        kind: "wearable",
      };
    default:
      throw new Error(`Unknown OneOf variant: ${obj.kind}`);
  }
}

const zRawEmoteFishingLinePhysicsPosition = z.object({
  velocity: z.unknown(),
  gravity: z.unknown(),
  start: z.unknown(),
});

export function deserializeEmoteFishingLinePhysicsPosition(
  data: unknown
): EmoteFishingLinePhysicsPosition {
  const obj = zRawEmoteFishingLinePhysicsPosition.parse(data);
  return {
    velocity: deserializeVec3f(obj.velocity),
    gravity: deserializeVec3f(obj.gravity),
    start: deserializeVec3f(obj.start),
  };
}

const zRawEmoteFishingLineReelInPosition = z.object({
  start: z.unknown(),
  duration: z.unknown(),
});

export function deserializeEmoteFishingLineReelInPosition(
  data: unknown
): EmoteFishingLineReelInPosition {
  const obj = zRawEmoteFishingLineReelInPosition.parse(data);
  return {
    start: deserializeVec3f(obj.start),
    duration: deserializeF64(obj.duration),
  };
}

const zRawEmoteFishingLineFixedPosition = z.object({
  pos: z.unknown(),
});

export function deserializeEmoteFishingLineFixedPosition(
  data: unknown
): EmoteFishingLineFixedPosition {
  const obj = zRawEmoteFishingLineFixedPosition.parse(data);
  return {
    pos: deserializeVec3f(obj.pos),
  };
}

const zRawWarpTarget = z.object({
  warp_to: z.unknown(),
  orientation: z.unknown(),
});

export function deserializeWarpTarget(data: unknown): WarpTarget {
  const obj = zRawWarpTarget.parse(data);
  return {
    warp_to: deserializeVec3f(obj.warp_to),
    orientation: deserializeVec2f(obj.orientation),
  };
}
export function serializeEntitiesAndExpiry(value: ReadonlyEntitiesAndExpiry) {
  return {
    entity_ids: serializeT92(value.entity_ids),
    expiry: value.expiry,
  };
}

const zRawEntitiesAndExpiry = z.object({
  entity_ids: z.unknown(),
  expiry: z.unknown(),
});

export function deserializeEntitiesAndExpiry(data: unknown): EntitiesAndExpiry {
  const obj = zRawEntitiesAndExpiry.parse(data);
  return {
    entity_ids: deserializeT92(obj.entity_ids),
    expiry: deserializeT93(obj.expiry),
  };
}
export function serializeAllNUXStatus(value: ReadonlyAllNUXStatus) {
  return Array.from(value, ([k, v]) => [k, v]);
}

export function deserializeAllNUXStatus(data: unknown): AllNUXStatus {
  const arr = zGenericMapArray.parse(data);
  return new Map(
    arr.map(([k, v]: any) => [deserializeI32(k), deserializeNUXStatus(v)])
  );
}
export function serializeT102(value: ReadonlyT102) {
  return [serializeBiomesId(value[0]), serializeT101(value[1])];
}

export function deserializeT102(data: unknown): T102 {
  const arr = zGenericArray.parse(data);
  return [deserializeBiomesId(arr[0]), deserializeT101(arr[1])];
}
export function serializeT104(value: ReadonlyT104) {
  return Array.from(value, ([k, v]) => [k, serializeT101(v)]);
}

export function deserializeT104(data: unknown): T104 {
  const arr = zGenericMapArray.parse(data);
  return new Map(
    arr.map(([k, v]: any) => [deserializeUserRole(k), deserializeT101(v)])
  );
}
export function serializeT105(value: ReadonlyT105) {
  return Array.from(value, ([k, v]) => [
    serializeBiomesId(k),
    serializeT101(v),
  ]);
}

export function deserializeT105(data: unknown): T105 {
  const arr = zGenericMapArray.parse(data);
  return new Map(
    arr.map(([k, v]: any) => [deserializeBiomesId(k), deserializeT101(v)])
  );
}

export function deserializeAabb(data: unknown): Aabb {
  const arr = zGenericArray.parse(data);
  return [deserializeVec3f(arr[0]), deserializeVec3f(arr[1])];
}

const zRawT112 = z.object({
  kind: z.unknown(),
  point: z.unknown(),
});

export function deserializeT112(data: unknown): T112 {
  const obj = zRawT112.parse(data);
  return {
    kind: deserializeT111(obj.kind),
    point: deserializeVec3f(obj.point),
  };
}
export function serializeNpcDamageSource(value: ReadonlyNpcDamageSource) {
  switch (value.kind) {
    case "dayNight":
      return {
        ...value,
        kind: "dayNight",
      };
    case "farFromHome":
      return {
        ...value,
        kind: "farFromHome",
      };
    case "adminKill":
      return {
        ...value,
        kind: "adminKill",
      };
    case "outOfWorldBounds":
      return {
        ...value,
        kind: "outOfWorldBounds",
      };
  }
}

export function deserializeNpcDamageSource(data: unknown): NpcDamageSource {
  const obj = zDiscriminatedObject.parse(data);
  switch (obj.kind) {
    case "dayNight":
      return {
        ...deserializeT117(obj),
        kind: "dayNight",
      };
    case "farFromHome":
      return {
        ...deserializeT119(obj),
        kind: "farFromHome",
      };
    case "adminKill":
      return {
        ...deserializeT121(obj),
        kind: "adminKill",
      };
    case "outOfWorldBounds":
      return {
        ...deserializeT123(obj),
        kind: "outOfWorldBounds",
      };
    default:
      throw new Error(`Unknown OneOf variant: ${obj.kind}`);
  }
}

const zRawPlaceableAnimation = z.object({
  type: z.unknown(),
  repeat: z.unknown(),
  start_time: z.unknown(),
});

export function deserializePlaceableAnimation(
  data: unknown
): PlaceableAnimation {
  const obj = zRawPlaceableAnimation.parse(data);
  return {
    type: deserializePlaceableAnimationType(obj.type),
    repeat: deserializeOptionalAnimationRepeatKind(obj.repeat),
    start_time: deserializeF64(obj.start_time),
  };
}
export function serializeLifetimeStatsMap(value: ReadonlyLifetimeStatsMap) {
  return Array.from(value, ([k, v]) => [k, serializeItemBag(v)]);
}

export function deserializeLifetimeStatsMap(data: unknown): LifetimeStatsMap {
  const arr = zGenericMapArray.parse(data);
  return new Map(
    arr.map(([k, v]: any) => [
      deserializeLifetimeStatsType(k),
      deserializeItemBag(v),
    ])
  );
}
export function serializePositionBeamMap(value: ReadonlyPositionBeamMap) {
  return Array.from(value, ([k, v]) => [serializeBiomesId(k), v]);
}

export function deserializePositionBeamMap(data: unknown): PositionBeamMap {
  const arr = zGenericMapArray.parse(data);
  return new Map(
    arr.map(([k, v]: any) => [deserializeBiomesId(k), deserializeVec2f(v)])
  );
}

const zRawPlaceEventInfo = z.object({
  time: z.unknown(),
  position: z.unknown(),
});

export function deserializePlaceEventInfo(data: unknown): PlaceEventInfo {
  const obj = zRawPlaceEventInfo.parse(data);
  return {
    time: deserializeF64(obj.time),
    position: deserializeVec3i(obj.position),
  };
}
export function serializeBuff(value: ReadonlyBuff) {
  return {
    item_id: serializeBiomesId(value.item_id),
    start_time: value.start_time,
    from_id: serializeOptionalBiomesId(value.from_id),
    is_disabled: value.is_disabled,
  };
}

const zRawBuff = z.object({
  item_id: z.unknown(),
  start_time: z.unknown(),
  from_id: z.unknown(),
  is_disabled: z.unknown(),
});

export function deserializeBuff(data: unknown): Buff {
  const obj = zRawBuff.parse(data);
  return {
    item_id: deserializeBiomesId(obj.item_id),
    start_time: deserializeT93(obj.start_time),
    from_id: deserializeOptionalBiomesId(obj.from_id),
    is_disabled: deserializeOptionalBool(obj.is_disabled),
  };
}
export function serializeOptionalTagRoundState(
  value: ReadonlyOptionalTagRoundState
) {
  return value === undefined || value === null
    ? undefined
    : serializeTagRoundState(value);
}

export function deserializeOptionalTagRoundState(
  data: unknown
): OptionalTagRoundState {
  return data === null || data === undefined
    ? undefined
    : deserializeTagRoundState(data);
}
export function serializeT169(value: ReadonlyT169) {
  return {
    checkpoint_ids: serializeBiomesIdSet(value.checkpoint_ids),
    start_ids: serializeBiomesIdSet(value.start_ids),
    end_ids: serializeBiomesIdSet(value.end_ids),
  };
}

const zRawT169 = z.object({
  checkpoint_ids: z.unknown(),
  start_ids: z.unknown(),
  end_ids: z.unknown(),
});

export function deserializeT169(data: unknown): T169 {
  const obj = zRawT169.parse(data);
  return {
    checkpoint_ids: deserializeBiomesIdSet(obj.checkpoint_ids),
    start_ids: deserializeBiomesIdSet(obj.start_ids),
    end_ids: deserializeBiomesIdSet(obj.end_ids),
  };
}
export function serializeT170(value: ReadonlyT170) {
  return {
    start_ids: serializeBiomesIdSet(value.start_ids),
  };
}

const zRawT170 = z.object({
  start_ids: z.unknown(),
});

export function deserializeT170(data: unknown): T170 {
  const obj = zRawT170.parse(data);
  return {
    start_ids: deserializeBiomesIdSet(obj.start_ids),
  };
}
export function serializeT171(value: ReadonlyT171) {
  return {
    start_ids: serializeBiomesIdSet(value.start_ids),
    arena_marker_ids: serializeBiomesIdSet(value.arena_marker_ids),
  };
}

const zRawT171 = z.object({
  start_ids: z.unknown(),
  arena_marker_ids: z.unknown(),
});

export function deserializeT171(data: unknown): T171 {
  const obj = zRawT171.parse(data);
  return {
    start_ids: deserializeBiomesIdSet(obj.start_ids),
    arena_marker_ids: deserializeBiomesIdSet(obj.arena_marker_ids),
  };
}
export function serializeDeathMatchPlayerState(
  value: ReadonlyDeathMatchPlayerState
) {
  return {
    playerId: serializeBiomesId(value.playerId),
    kills: value.kills,
    deaths: value.deaths,
    last_kill: value.last_kill,
    last_death: value.last_death,
  };
}

const zRawDeathMatchPlayerState = z.object({
  playerId: z.unknown(),
  kills: z.unknown(),
  deaths: z.unknown(),
  last_kill: z.unknown(),
  last_death: z.unknown(),
});

export function deserializeDeathMatchPlayerState(
  data: unknown
): DeathMatchPlayerState {
  const obj = zRawDeathMatchPlayerState.parse(data);
  return {
    playerId: deserializeBiomesId(obj.playerId),
    kills: deserializeI32(obj.kills),
    deaths: deserializeI32(obj.deaths),
    last_kill: deserializeOptionalF64(obj.last_kill),
    last_death: deserializeOptionalF64(obj.last_death),
  };
}
export function serializeT178(value: ReadonlyT178) {
  switch (value.kind) {
    case "waiting_for_players":
      return {
        ...value,
        kind: "waiting_for_players",
      };
    case "play_countdown":
      return {
        ...value,
        kind: "play_countdown",
      };
    case "playing":
      return {
        ...value,
        kind: "playing",
      };
    case "finished":
      return {
        ...value,
        kind: "finished",
      };
  }
}

export function deserializeT178(data: unknown): T178 {
  const obj = zDiscriminatedObject.parse(data);
  switch (obj.kind) {
    case "waiting_for_players":
      return {
        ...deserializeT174(obj),
        kind: "waiting_for_players",
      };
    case "play_countdown":
      return {
        ...deserializeT175(obj),
        kind: "play_countdown",
      };
    case "playing":
      return {
        ...deserializeT176(obj),
        kind: "playing",
      };
    case "finished":
      return {
        ...deserializeT177(obj),
        kind: "finished",
      };
    default:
      throw new Error(`Unknown OneOf variant: ${obj.kind}`);
  }
}
export function serializeT183(value: ReadonlyT183) {
  return {
    round_start: value.round_start,
    last_winner_id: serializeOptionalBiomesId(value.last_winner_id),
  };
}

const zRawT183 = z.object({
  round_start: z.unknown(),
  last_winner_id: z.unknown(),
});

export function deserializeT183(data: unknown): T183 {
  const obj = zRawT183.parse(data);
  return {
    round_start: deserializeF64(obj.round_start),
    last_winner_id: deserializeOptionalBiomesId(obj.last_winner_id),
  };
}
export function serializeT186(value: ReadonlyT186) {
  return Array.from(value, ([k, v]) => [
    serializeBiomesId(k),
    serializeSpleefPlayerStats(v),
  ]);
}

export function deserializeT186(data: unknown): T186 {
  const arr = zGenericMapArray.parse(data);
  return new Map(
    arr.map(([k, v]: any) => [
      deserializeBiomesId(k),
      deserializeSpleefPlayerStats(v),
    ])
  );
}
export function serializeReachedCheckpoints(value: ReadonlyReachedCheckpoints) {
  return Array.from(value, ([k, v]) => [serializeBiomesId(k), v]);
}

export function deserializeReachedCheckpoints(
  data: unknown
): ReachedCheckpoints {
  const arr = zGenericMapArray.parse(data);
  return new Map(
    arr.map(([k, v]: any) => [deserializeBiomesId(k), deserializeT188(v)])
  );
}
export function serializeFarmingPlayerAction(
  value: ReadonlyFarmingPlayerAction
) {
  switch (value.kind) {
    case "water":
      return {
        ...value,
        kind: "water",
      };
    case "fertilize":
      return {
        ...serializeT203(value),
        kind: "fertilize",
      };
    case "harvest":
      return {
        ...value,
        kind: "harvest",
      };
    case "adminDestroy":
      return {
        ...value,
        kind: "adminDestroy",
      };
    case "poke":
      return {
        ...value,
        kind: "poke",
      };
  }
}

export function deserializeFarmingPlayerAction(
  data: unknown
): FarmingPlayerAction {
  const obj = zDiscriminatedObject.parse(data);
  switch (obj.kind) {
    case "water":
      return {
        ...deserializeT201(obj),
        kind: "water",
      };
    case "fertilize":
      return {
        ...deserializeT203(obj),
        kind: "fertilize",
      };
    case "harvest":
      return {
        ...deserializeT205(obj),
        kind: "harvest",
      };
    case "adminDestroy":
      return {
        ...deserializeT207(obj),
        kind: "adminDestroy",
      };
    case "poke":
      return {
        ...deserializeT209(obj),
        kind: "poke",
      };
    default:
      throw new Error(`Unknown OneOf variant: ${obj.kind}`);
  }
}
export function serializeT212(value: ReadonlyT212) {
  return {
    type_ids: serializeBiomesIdList(value.type_ids),
  };
}

const zRawT212 = z.object({
  type_ids: z.unknown(),
});

export function deserializeT212(data: unknown): T212 {
  const obj = zRawT212.parse(data);
  return {
    type_ids: deserializeBiomesIdList(obj.type_ids),
  };
}

const zRawBucketedImageCloudBundle = z.object({
  webp_320w: z.unknown(),
  webp_640w: z.unknown(),
  webp_1280w: z.unknown(),
  png_1280w: z.unknown(),
  webp_original: z.unknown(),
  bucket: z.unknown(),
});

export function deserializeBucketedImageCloudBundle(
  data: unknown
): BucketedImageCloudBundle {
  const obj = zRawBucketedImageCloudBundle.parse(data);
  return {
    webp_320w: deserializeOptionalString(obj.webp_320w),
    webp_640w: deserializeOptionalString(obj.webp_640w),
    webp_1280w: deserializeOptionalString(obj.webp_1280w),
    png_1280w: deserializeOptionalString(obj.png_1280w),
    webp_original: deserializeOptionalString(obj.webp_original),
    bucket: deserializeT214(obj.bucket),
  };
}

const zRawTerrainRestorationEntry = z.object({
  position_index: z.unknown(),
  created_at: z.unknown(),
  restore_time: z.unknown(),
  terrain: z.unknown(),
  placer: z.unknown(),
  dye: z.unknown(),
  shape: z.unknown(),
});

export function deserializeTerrainRestorationEntry(
  data: unknown
): TerrainRestorationEntry {
  const obj = zRawTerrainRestorationEntry.parse(data);
  return {
    position_index: deserializeU16(obj.position_index),
    created_at: deserializeF64(obj.created_at),
    restore_time: deserializeF64(obj.restore_time),
    terrain: deserializeOptionalF64(obj.terrain),
    placer: deserializeOptionalF64(obj.placer),
    dye: deserializeOptionalF64(obj.dye),
    shape: deserializeOptionalF64(obj.shape),
  };
}
export function serializeTeamPendingInvites(value: ReadonlyTeamPendingInvites) {
  return Array.from(value, ([k, v]) => [
    serializeBiomesId(k),
    serializeTeamInvite(v),
  ]);
}

export function deserializeTeamPendingInvites(
  data: unknown
): TeamPendingInvites {
  const arr = zGenericMapArray.parse(data);
  return new Map(
    arr.map(([k, v]: any) => [deserializeBiomesId(k), deserializeTeamInvite(v)])
  );
}
export function serializeTeamPendingRequests(
  value: ReadonlyTeamPendingRequests
) {
  return value.map((x) => serializeTeamJoinRequest(x));
}

export function deserializeTeamPendingRequests(
  data: unknown
): TeamPendingRequests {
  const arr = zGenericArray.parse(data);
  return arr.map((x: any) => deserializeTeamJoinRequest(x));
}
export function serializeTeamMembers(value: ReadonlyTeamMembers) {
  return Array.from(value, ([k, v]) => [serializeBiomesId(k), v]);
}

export function deserializeTeamMembers(data: unknown): TeamMembers {
  const arr = zGenericMapArray.parse(data);
  return new Map(
    arr.map(([k, v]: any) => [
      deserializeBiomesId(k),
      deserializeTeamMemberMetadata(v),
    ])
  );
}

const zRawT229 = z.object({
  kind: z.unknown(),
  box: z.unknown(),
});

export function deserializeT229(data: unknown): T229 {
  const obj = zRawT229.parse(data);
  return {
    kind: deserializeT228(obj.kind),
    box: deserializeVec3f(obj.box),
  };
}
export function serializeTradeSpecList(value: ReadonlyTradeSpecList) {
  return value.map((x) => serializeTradeSpec(x));
}

export function deserializeTradeSpecList(data: unknown): TradeSpecList {
  const arr = zGenericArray.parse(data);
  return arr.map((x: any) => deserializeTradeSpec(x));
}

export function deserializeTerrainUpdateList(data: unknown): TerrainUpdateList {
  const arr = zGenericArray.parse(data);
  return arr.map((x: any) => deserializeTerrainUpdate(x));
}
export function serializePricedItemContainer(
  value: ReadonlyPricedItemContainer
) {
  return value.map((x) => serializePricedItemSlot(x));
}

export function deserializePricedItemContainer(
  data: unknown
): PricedItemContainer {
  const arr = zGenericArray.parse(data);
  return arr.map((x: any) => deserializePricedItemSlot(x));
}
export function serializeOptionalOwnedItemReference(
  value: ReadonlyOptionalOwnedItemReference
) {
  return value === undefined || value === null
    ? undefined
    : serializeOwnedItemReference(value);
}

export function deserializeOptionalOwnedItemReference(
  data: unknown
): OptionalOwnedItemReference {
  return data === null || data === undefined
    ? undefined
    : deserializeOwnedItemReference(data);
}
export function serializeOwnedItemReferenceList(
  value: ReadonlyOwnedItemReferenceList
) {
  return value.map((x) => serializeOwnedItemReference(x));
}

export function deserializeOwnedItemReferenceList(
  data: unknown
): OwnedItemReferenceList {
  const arr = zGenericArray.parse(data);
  return arr.map((x: any) => deserializeOwnedItemReference(x));
}
export function serializeT64(value: ReadonlyT64) {
  return [
    serializeOwnedItemReference(value[0]),
    serializeItemAndCount(value[1]),
  ];
}

export function deserializeT64(data: unknown): T64 {
  const arr = zGenericArray.parse(data);
  return [
    deserializeOwnedItemReference(arr[0]),
    deserializeItemAndCount(arr[1]),
  ];
}
export function serializeEmoteFishingLineEndPosition(
  value: ReadonlyEmoteFishingLineEndPosition
) {
  switch (value.kind) {
    case "physics":
      return {
        ...value,
        kind: "physics",
      };
    case "reel_in":
      return {
        ...value,
        kind: "reel_in",
      };
    case "fixed":
      return {
        ...value,
        kind: "fixed",
      };
  }
}

export function deserializeEmoteFishingLineEndPosition(
  data: unknown
): EmoteFishingLineEndPosition {
  const obj = zDiscriminatedObject.parse(data);
  switch (obj.kind) {
    case "physics":
      return {
        ...deserializeEmoteFishingLinePhysicsPosition(obj),
        kind: "physics",
      };
    case "reel_in":
      return {
        ...deserializeEmoteFishingLineReelInPosition(obj),
        kind: "reel_in",
      };
    case "fixed":
      return {
        ...deserializeEmoteFishingLineFixedPosition(obj),
        kind: "fixed",
      };
    default:
      throw new Error(`Unknown OneOf variant: ${obj.kind}`);
  }
}

const zRawEmoteThrowInfo = z.object({
  physics: z.unknown(),
  angular_velocity: z.unknown(),
});

export function deserializeEmoteThrowInfo(data: unknown): EmoteThrowInfo {
  const obj = zRawEmoteThrowInfo.parse(data);
  return {
    physics: deserializeEmoteFishingLinePhysicsPosition(obj.physics),
    angular_velocity: deserializeOptionalVec2f(obj.angular_velocity),
  };
}

export function deserializeOptionalWarpTarget(
  data: unknown
): OptionalWarpTarget {
  return data === null || data === undefined
    ? undefined
    : deserializeWarpTarget(data);
}
export function serializeGrabBagFilter(value: ReadonlyGrabBagFilter) {
  switch (value.kind) {
    case "block":
      return {
        ...serializeEntitiesAndExpiry(value),
        kind: "block",
      };
    case "only":
      return {
        ...serializeEntitiesAndExpiry(value),
        kind: "only",
      };
  }
}

export function deserializeGrabBagFilter(data: unknown): GrabBagFilter {
  const obj = zDiscriminatedObject.parse(data);
  switch (obj.kind) {
    case "block":
      return {
        ...deserializeEntitiesAndExpiry(obj),
        kind: "block",
      };
    case "only":
      return {
        ...deserializeEntitiesAndExpiry(obj),
        kind: "only",
      };
    default:
      throw new Error(`Unknown OneOf variant: ${obj.kind}`);
  }
}
export function serializeTargetedAcl(value: ReadonlyTargetedAcl) {
  return value === undefined || value === null
    ? undefined
    : serializeT102(value);
}

export function deserializeTargetedAcl(data: unknown): TargetedAcl {
  return data === null || data === undefined
    ? undefined
    : deserializeT102(data);
}

export function deserializeOptionalAabb(data: unknown): OptionalAabb {
  return data === null || data === undefined
    ? undefined
    : deserializeAabb(data);
}

const zRawT110 = z.object({
  kind: z.unknown(),
  aabb: z.unknown(),
});

export function deserializeT110(data: unknown): T110 {
  const obj = zRawT110.parse(data);
  return {
    kind: deserializeT109(obj.kind),
    aabb: deserializeAabb(obj.aabb),
  };
}

const zRawT114 = z.object({
  kind: z.unknown(),
  points: z.unknown(),
});

export function deserializeT114(data: unknown): T114 {
  const obj = zRawT114.parse(data);
  return {
    kind: deserializeT113(obj.kind),
    points: deserializeVec3fList(obj.points),
  };
}
export function serializeT134(value: ReadonlyT134) {
  return {
    kind: value.kind,
    attacker: serializeBiomesId(value.attacker),
    dir: value.dir,
  };
}

const zRawT134 = z.object({
  kind: z.unknown(),
  attacker: z.unknown(),
  dir: z.unknown(),
});

export function deserializeT134(data: unknown): T134 {
  const obj = zRawT134.parse(data);
  return {
    kind: deserializeT133(obj.kind),
    attacker: deserializeBiomesId(obj.attacker),
    dir: deserializeOptionalVec3f(obj.dir),
  };
}
export function serializeT146(value: ReadonlyT146) {
  return {
    kind: value.kind,
    type: serializeNpcDamageSource(value.type),
  };
}

const zRawT146 = z.object({
  kind: z.unknown(),
  type: z.unknown(),
});

export function deserializeT146(data: unknown): T146 {
  const obj = zRawT146.parse(data);
  return {
    kind: deserializeT145(obj.kind),
    type: deserializeNpcDamageSource(obj.type),
  };
}

export function deserializeOptionalPlaceableAnimation(
  data: unknown
): OptionalPlaceableAnimation {
  return data === null || data === undefined
    ? undefined
    : deserializePlaceableAnimation(data);
}

export function deserializeOptionalPlaceEventInfo(
  data: unknown
): OptionalPlaceEventInfo {
  return data === null || data === undefined
    ? undefined
    : deserializePlaceEventInfo(data);
}
export function serializeBuffsList(value: ReadonlyBuffsList) {
  return value.map((x) => serializeBuff(x));
}

export function deserializeBuffsList(data: unknown): BuffsList {
  const arr = zGenericArray.parse(data);
  return arr.map((x: any) => deserializeBuff(x));
}
export function serializeMinigameMetadata(value: ReadonlyMinigameMetadata) {
  switch (value.kind) {
    case "simple_race":
      return {
        ...serializeT169(value),
        kind: "simple_race",
      };
    case "deathmatch":
      return {
        ...serializeT170(value),
        kind: "deathmatch",
      };
    case "spleef":
      return {
        ...serializeT171(value),
        kind: "spleef",
      };
  }
}

export function deserializeMinigameMetadata(data: unknown): MinigameMetadata {
  const obj = zDiscriminatedObject.parse(data);
  switch (obj.kind) {
    case "simple_race":
      return {
        ...deserializeT169(obj),
        kind: "simple_race",
      };
    case "deathmatch":
      return {
        ...deserializeT170(obj),
        kind: "deathmatch",
      };
    case "spleef":
      return {
        ...deserializeT171(obj),
        kind: "spleef",
      };
    default:
      throw new Error(`Unknown OneOf variant: ${obj.kind}`);
  }
}
export function serializeT179(value: ReadonlyT179) {
  return value === undefined || value === null
    ? undefined
    : serializeT178(value);
}

export function deserializeT179(data: unknown): T179 {
  return data === null || data === undefined
    ? undefined
    : deserializeT178(data);
}
export function serializeT180(value: ReadonlyT180) {
  return Array.from(value, ([k, v]) => [
    serializeBiomesId(k),
    serializeDeathMatchPlayerState(v),
  ]);
}

export function deserializeT180(data: unknown): T180 {
  const arr = zGenericMapArray.parse(data);
  return new Map(
    arr.map(([k, v]: any) => [
      deserializeBiomesId(k),
      deserializeDeathMatchPlayerState(v),
    ])
  );
}
export function serializeT184(value: ReadonlyT184) {
  return {
    round_expires: value.round_expires,
    alive_round_players: serializeBiomesIdSet(value.alive_round_players),
    tag_round_state: serializeOptionalTagRoundState(value.tag_round_state),
  };
}

const zRawT184 = z.object({
  round_expires: z.unknown(),
  alive_round_players: z.unknown(),
  tag_round_state: z.unknown(),
});

export function deserializeT184(data: unknown): T184 {
  const obj = zRawT184.parse(data);
  return {
    round_expires: deserializeF64(obj.round_expires),
    alive_round_players: deserializeBiomesIdSet(obj.alive_round_players),
    tag_round_state: deserializeOptionalTagRoundState(obj.tag_round_state),
  };
}
export function serializeSimpleRaceInstanceState(
  value: ReadonlySimpleRaceInstanceState
) {
  return {
    player_state: value.player_state,
    started_at: value.started_at,
    deaths: value.deaths,
    reached_checkpoints: serializeReachedCheckpoints(value.reached_checkpoints),
    finished_at: value.finished_at,
  };
}

const zRawSimpleRaceInstanceState = z.object({
  player_state: z.unknown(),
  started_at: z.unknown(),
  deaths: z.unknown(),
  reached_checkpoints: z.unknown(),
  finished_at: z.unknown(),
});

export function deserializeSimpleRaceInstanceState(
  data: unknown
): SimpleRaceInstanceState {
  const obj = zRawSimpleRaceInstanceState.parse(data);
  return {
    player_state: deserializeT190(obj.player_state),
    started_at: deserializeF64(obj.started_at),
    deaths: deserializeI32(obj.deaths),
    reached_checkpoints: deserializeReachedCheckpoints(obj.reached_checkpoints),
    finished_at: deserializeOptionalF64(obj.finished_at),
  };
}
export function serializeMinigameInstanceActivePlayerInfo(
  value: ReadonlyMinigameInstanceActivePlayerInfo
) {
  return {
    entry_stash_id: serializeBiomesId(value.entry_stash_id),
    entry_position: value.entry_position,
    entry_warped_to: value.entry_warped_to,
    entry_time: value.entry_time,
  };
}

const zRawMinigameInstanceActivePlayerInfo = z.object({
  entry_stash_id: z.unknown(),
  entry_position: z.unknown(),
  entry_warped_to: z.unknown(),
  entry_time: z.unknown(),
});

export function deserializeMinigameInstanceActivePlayerInfo(
  data: unknown
): MinigameInstanceActivePlayerInfo {
  const obj = zRawMinigameInstanceActivePlayerInfo.parse(data);
  return {
    entry_stash_id: deserializeBiomesId(obj.entry_stash_id),
    entry_position: deserializeVec3f(obj.entry_position),
    entry_warped_to: deserializeOptionalVec3f(obj.entry_warped_to),
    entry_time: deserializeF64(obj.entry_time),
  };
}
export function serializeT196(value: ReadonlyT196) {
  return {
    box: value.box,
    clipboard_entity_id: serializeBiomesId(value.clipboard_entity_id),
  };
}

const zRawT196 = z.object({
  box: z.unknown(),
  clipboard_entity_id: z.unknown(),
});

export function deserializeT196(data: unknown): T196 {
  const obj = zRawT196.parse(data);
  return {
    box: deserializeBox2(obj.box),
    clipboard_entity_id: deserializeBiomesId(obj.clipboard_entity_id),
  };
}
export function serializeFarmingPlayerActionList(
  value: ReadonlyFarmingPlayerActionList
) {
  return value.map((x) => serializeFarmingPlayerAction(x));
}

export function deserializeFarmingPlayerActionList(
  data: unknown
): FarmingPlayerActionList {
  const arr = zGenericArray.parse(data);
  return arr.map((x: any) => deserializeFarmingPlayerAction(x));
}
export function serializeItemBuyerSpec(value: ReadonlyItemBuyerSpec) {
  switch (value.kind) {
    case "item_types":
      return {
        ...serializeT212(value),
        kind: "item_types",
      };
  }
}

export function deserializeItemBuyerSpec(data: unknown): ItemBuyerSpec {
  const obj = zDiscriminatedObject.parse(data);
  switch (obj.kind) {
    case "item_types":
      return {
        ...deserializeT212(obj),
        kind: "item_types",
      };
    default:
      throw new Error(`Unknown OneOf variant: ${obj.kind}`);
  }
}

export function deserializeTerrainRestorationEntryList(
  data: unknown
): TerrainRestorationEntryList {
  const arr = zGenericArray.parse(data);
  return arr.map((x: any) => deserializeTerrainRestorationEntry(x));
}
export function serializeVolume(value: ReadonlyVolume) {
  switch (value.kind) {
    case "box":
      return {
        ...value,
        kind: "box",
      };
    case "sphere":
      return {
        ...value,
        kind: "sphere",
      };
  }
}

export function deserializeVolume(data: unknown): Volume {
  const obj = zDiscriminatedObject.parse(data);
  switch (obj.kind) {
    case "box":
      return {
        ...deserializeT229(obj),
        kind: "box",
      };
    case "sphere":
      return {
        ...deserializeT231(obj),
        kind: "sphere",
      };
    default:
      throw new Error(`Unknown OneOf variant: ${obj.kind}`);
  }
}
export function serializeInventoryAssignmentPattern(
  value: ReadonlyInventoryAssignmentPattern
) {
  return value.map((x) => serializeT64(x));
}

export function deserializeInventoryAssignmentPattern(
  data: unknown
): InventoryAssignmentPattern {
  const arr = zGenericArray.parse(data);
  return arr.map((x: any) => deserializeT64(x));
}
export function serializeT66(value: ReadonlyT66) {
  return value.map((x) => serializeT64(x));
}

export function deserializeT66(data: unknown): T66 {
  const arr = zGenericArray.parse(data);
  return arr.map((x: any) => deserializeT64(x));
}
export function serializeT76(value: ReadonlyT76) {
  return value === undefined || value === null
    ? undefined
    : serializeEmoteFishingLineEndPosition(value);
}

export function deserializeT76(data: unknown): T76 {
  return data === null || data === undefined
    ? undefined
    : deserializeEmoteFishingLineEndPosition(data);
}

export function deserializeT80(data: unknown): T80 {
  return data === null || data === undefined
    ? undefined
    : deserializeEmoteThrowInfo(data);
}
export function serializeAcl(value: ReadonlyAcl) {
  return {
    everyone: serializeT101(value.everyone),
    roles: serializeT104(value.roles),
    entities: serializeT105(value.entities),
    teams: serializeT105(value.teams),
    creator: serializeTargetedAcl(value.creator),
    creatorTeam: serializeTargetedAcl(value.creatorTeam),
  };
}

const zRawAcl = z.object({
  everyone: z.unknown(),
  roles: z.unknown(),
  entities: z.unknown(),
  teams: z.unknown(),
  creator: z.unknown(),
  creatorTeam: z.unknown(),
});

export function deserializeAcl(data: unknown): Acl {
  const obj = zRawAcl.parse(data);
  return {
    everyone: deserializeT101(obj.everyone),
    roles: deserializeT104(obj.roles),
    entities: deserializeT105(obj.entities),
    teams: deserializeT105(obj.teams),
    creator: deserializeTargetedAcl(obj.creator),
    creatorTeam: deserializeTargetedAcl(obj.creatorTeam),
  };
}
export function serializeAclDomain(value: ReadonlyAclDomain) {
  switch (value.kind) {
    case "aabb":
      return {
        ...value,
        kind: "aabb",
      };
    case "point":
      return {
        ...value,
        kind: "point",
      };
    case "points":
      return {
        ...value,
        kind: "points",
      };
  }
}

export function deserializeAclDomain(data: unknown): AclDomain {
  const obj = zDiscriminatedObject.parse(data);
  switch (obj.kind) {
    case "aabb":
      return {
        ...deserializeT110(obj),
        kind: "aabb",
      };
    case "point":
      return {
        ...deserializeT112(obj),
        kind: "point",
      };
    case "points":
      return {
        ...deserializeT114(obj),
        kind: "points",
      };
    default:
      throw new Error(`Unknown OneOf variant: ${obj.kind}`);
  }
}
export function serializeDamageSource(value: ReadonlyDamageSource) {
  switch (value.kind) {
    case "suicide":
      return {
        ...value,
        kind: "suicide",
      };
    case "despawnWand":
      return {
        ...value,
        kind: "despawnWand",
      };
    case "block":
      return {
        ...serializeT130(value),
        kind: "block",
      };
    case "fall":
      return {
        ...value,
        kind: "fall",
      };
    case "attack":
      return {
        ...serializeT134(value),
        kind: "attack",
      };
    case "drown":
      return {
        ...value,
        kind: "drown",
      };
    case "fire":
      return {
        ...value,
        kind: "fire",
      };
    case "fireDamage":
      return {
        ...value,
        kind: "fireDamage",
      };
    case "fireHeal":
      return {
        ...value,
        kind: "fireHeal",
      };
    case "heal":
      return {
        ...value,
        kind: "heal",
      };
    case "npc":
      return {
        ...serializeT146(value),
        kind: "npc",
      };
  }
}

export function deserializeDamageSource(data: unknown): DamageSource {
  const obj = zDiscriminatedObject.parse(data);
  switch (obj.kind) {
    case "suicide":
      return {
        ...deserializeT126(obj),
        kind: "suicide",
      };
    case "despawnWand":
      return {
        ...deserializeT128(obj),
        kind: "despawnWand",
      };
    case "block":
      return {
        ...deserializeT130(obj),
        kind: "block",
      };
    case "fall":
      return {
        ...deserializeT132(obj),
        kind: "fall",
      };
    case "attack":
      return {
        ...deserializeT134(obj),
        kind: "attack",
      };
    case "drown":
      return {
        ...deserializeT136(obj),
        kind: "drown",
      };
    case "fire":
      return {
        ...deserializeT138(obj),
        kind: "fire",
      };
    case "fireDamage":
      return {
        ...deserializeT140(obj),
        kind: "fireDamage",
      };
    case "fireHeal":
      return {
        ...deserializeT142(obj),
        kind: "fireHeal",
      };
    case "heal":
      return {
        ...deserializeT144(obj),
        kind: "heal",
      };
    case "npc":
      return {
        ...deserializeT146(obj),
        kind: "npc",
      };
    default:
      throw new Error(`Unknown OneOf variant: ${obj.kind}`);
  }
}
export function serializeDeathmatchInstanceState(
  value: ReadonlyDeathmatchInstanceState
) {
  return {
    instance_state: serializeT179(value.instance_state),
    player_states: serializeT180(value.player_states),
  };
}

const zRawDeathmatchInstanceState = z.object({
  instance_state: z.unknown(),
  player_states: z.unknown(),
});

export function deserializeDeathmatchInstanceState(
  data: unknown
): DeathmatchInstanceState {
  const obj = zRawDeathmatchInstanceState.parse(data);
  return {
    instance_state: deserializeT179(obj.instance_state),
    player_states: deserializeT180(obj.player_states),
  };
}
export function serializeT185(value: ReadonlyT185) {
  switch (value.kind) {
    case "waiting_for_players":
      return {
        ...value,
        kind: "waiting_for_players",
      };
    case "round_countdown":
      return {
        ...serializeT183(value),
        kind: "round_countdown",
      };
    case "playing_round":
      return {
        ...serializeT184(value),
        kind: "playing_round",
      };
  }
}

export function deserializeT185(data: unknown): T185 {
  const obj = zDiscriminatedObject.parse(data);
  switch (obj.kind) {
    case "waiting_for_players":
      return {
        ...deserializeT174(obj),
        kind: "waiting_for_players",
      };
    case "round_countdown":
      return {
        ...deserializeT183(obj),
        kind: "round_countdown",
      };
    case "playing_round":
      return {
        ...deserializeT184(obj),
        kind: "playing_round",
      };
    default:
      throw new Error(`Unknown OneOf variant: ${obj.kind}`);
  }
}
export function serializeMinigameInstanceActivePlayerMap(
  value: ReadonlyMinigameInstanceActivePlayerMap
) {
  return Array.from(value, ([k, v]) => [
    serializeBiomesId(k),
    serializeMinigameInstanceActivePlayerInfo(v),
  ]);
}

export function deserializeMinigameInstanceActivePlayerMap(
  data: unknown
): MinigameInstanceActivePlayerMap {
  const arr = zGenericMapArray.parse(data);
  return new Map(
    arr.map(([k, v]: any) => [
      deserializeBiomesId(k),
      deserializeMinigameInstanceActivePlayerInfo(v),
    ])
  );
}
export function serializeT197(value: ReadonlyT197) {
  switch (value.kind) {
    case "aabb":
      return {
        ...serializeT196(value),
        kind: "aabb",
      };
  }
}

export function deserializeT197(data: unknown): T197 {
  const obj = zDiscriminatedObject.parse(data);
  switch (obj.kind) {
    case "aabb":
      return {
        ...deserializeT196(obj),
        kind: "aabb",
      };
    default:
      throw new Error(`Unknown OneOf variant: ${obj.kind}`);
  }
}
export function serializeOptionalVolume(value: ReadonlyOptionalVolume) {
  return value === undefined || value === null
    ? undefined
    : serializeVolume(value);
}

export function deserializeOptionalVolume(data: unknown): OptionalVolume {
  return data === null || data === undefined
    ? undefined
    : deserializeVolume(data);
}
export function serializeOptionalInventoryAssignmentPattern(
  value: ReadonlyOptionalInventoryAssignmentPattern
) {
  return value === undefined || value === null
    ? undefined
    : serializeT66(value);
}

export function deserializeOptionalInventoryAssignmentPattern(
  data: unknown
): OptionalInventoryAssignmentPattern {
  return data === null || data === undefined ? undefined : deserializeT66(data);
}
export function serializeEmoteFishingInfo(value: ReadonlyEmoteFishingInfo) {
  return {
    line_end_position: serializeT76(value.line_end_position),
    line_end_item: serializeOptionalItem(value.line_end_item),
  };
}

const zRawEmoteFishingInfo = z.object({
  line_end_position: z.unknown(),
  line_end_item: z.unknown(),
});

export function deserializeEmoteFishingInfo(data: unknown): EmoteFishingInfo {
  const obj = zRawEmoteFishingInfo.parse(data);
  return {
    line_end_position: deserializeT76(obj.line_end_position),
    line_end_item: deserializeOptionalItem(obj.line_end_item),
  };
}

export function deserializeOptionalEmoteThrowInfo(
  data: unknown
): OptionalEmoteThrowInfo {
  return data === null || data === undefined ? undefined : deserializeT80(data);
}
export function serializeOptionalDamageSource(
  value: ReadonlyOptionalDamageSource
) {
  return value === undefined || value === null
    ? undefined
    : serializeDamageSource(value);
}

export function deserializeOptionalDamageSource(
  data: unknown
): OptionalDamageSource {
  return data === null || data === undefined
    ? undefined
    : deserializeDamageSource(data);
}
export function serializeSpleefInstanceState(
  value: ReadonlySpleefInstanceState
) {
  return {
    instance_state: serializeT185(value.instance_state),
    observer_spawn_points: value.observer_spawn_points,
    player_stats: serializeT186(value.player_stats),
    round_number: value.round_number,
  };
}

const zRawSpleefInstanceState = z.object({
  instance_state: z.unknown(),
  observer_spawn_points: z.unknown(),
  player_stats: z.unknown(),
  round_number: z.unknown(),
});

export function deserializeSpleefInstanceState(
  data: unknown
): SpleefInstanceState {
  const obj = zRawSpleefInstanceState.parse(data);
  return {
    instance_state: deserializeT185(obj.instance_state),
    observer_spawn_points: deserializeVec3fList(obj.observer_spawn_points),
    player_stats: deserializeT186(obj.player_stats),
    round_number: deserializeI32(obj.round_number),
  };
}
export function serializeMinigameInstanceSpaceClipboardInfo(
  value: ReadonlyMinigameInstanceSpaceClipboardInfo
) {
  return {
    region: serializeT197(value.region),
  };
}

const zRawMinigameInstanceSpaceClipboardInfo = z.object({
  region: z.unknown(),
});

export function deserializeMinigameInstanceSpaceClipboardInfo(
  data: unknown
): MinigameInstanceSpaceClipboardInfo {
  const obj = zRawMinigameInstanceSpaceClipboardInfo.parse(data);
  return {
    region: deserializeT197(obj.region),
  };
}
export function serializeProtectionParams(value: ReadonlyProtectionParams) {
  return {
    acl: serializeAcl(value.acl),
  };
}

const zRawProtectionParams = z.object({
  acl: z.unknown(),
});

export function deserializeProtectionParams(data: unknown): ProtectionParams {
  const obj = zRawProtectionParams.parse(data);
  return {
    acl: deserializeAcl(obj.acl),
  };
}
export function serializeRestorationParams(value: ReadonlyRestorationParams) {
  return {
    acl: serializeAcl(value.acl),
    restore_delay_s: value.restore_delay_s,
  };
}

const zRawRestorationParams = z.object({
  acl: z.unknown(),
  restore_delay_s: z.unknown(),
});

export function deserializeRestorationParams(data: unknown): RestorationParams {
  const obj = zRawRestorationParams.parse(data);
  return {
    acl: deserializeAcl(obj.acl),
    restore_delay_s: deserializeF64(obj.restore_delay_s),
  };
}
export function serializeTrader(value: ReadonlyTrader) {
  return {
    id: serializeBiomesId(value.id),
    offer_assignment: serializeInventoryAssignmentPattern(
      value.offer_assignment
    ),
    accepted: value.accepted,
  };
}

const zRawTrader = z.object({
  id: z.unknown(),
  offer_assignment: z.unknown(),
  accepted: z.unknown(),
});

export function deserializeTrader(data: unknown): Trader {
  const obj = zRawTrader.parse(data);
  return {
    id: deserializeBiomesId(obj.id),
    offer_assignment: deserializeInventoryAssignmentPattern(
      obj.offer_assignment
    ),
    accepted: deserializeBool(obj.accepted),
  };
}
export function serializeOptionalEmoteFishingInfo(
  value: ReadonlyOptionalEmoteFishingInfo
) {
  return value === undefined || value === null
    ? undefined
    : serializeEmoteFishingInfo(value);
}

export function deserializeOptionalEmoteFishingInfo(
  data: unknown
): OptionalEmoteFishingInfo {
  return data === null || data === undefined
    ? undefined
    : deserializeEmoteFishingInfo(data);
}
export function serializeMinigameInstanceState(
  value: ReadonlyMinigameInstanceState
) {
  switch (value.kind) {
    case "simple_race":
      return {
        ...serializeSimpleRaceInstanceState(value),
        kind: "simple_race",
      };
    case "deathmatch":
      return {
        ...serializeDeathmatchInstanceState(value),
        kind: "deathmatch",
      };
    case "spleef":
      return {
        ...serializeSpleefInstanceState(value),
        kind: "spleef",
      };
  }
}

export function deserializeMinigameInstanceState(
  data: unknown
): MinigameInstanceState {
  const obj = zDiscriminatedObject.parse(data);
  switch (obj.kind) {
    case "simple_race":
      return {
        ...deserializeSimpleRaceInstanceState(obj),
        kind: "simple_race",
      };
    case "deathmatch":
      return {
        ...deserializeDeathmatchInstanceState(obj),
        kind: "deathmatch",
      };
    case "spleef":
      return {
        ...deserializeSpleefInstanceState(obj),
        kind: "spleef",
      };
    default:
      throw new Error(`Unknown OneOf variant: ${obj.kind}`);
  }
}
export function serializeOptionalMinigameInstanceSpaceClipboardInfo(
  value: ReadonlyOptionalMinigameInstanceSpaceClipboardInfo
) {
  return value === undefined || value === null
    ? undefined
    : serializeMinigameInstanceSpaceClipboardInfo(value);
}

export function deserializeOptionalMinigameInstanceSpaceClipboardInfo(
  data: unknown
): OptionalMinigameInstanceSpaceClipboardInfo {
  return data === null || data === undefined
    ? undefined
    : deserializeMinigameInstanceSpaceClipboardInfo(data);
}
export function serializeOptionalProtectionParams(
  value: ReadonlyOptionalProtectionParams
) {
  return value === undefined || value === null
    ? undefined
    : serializeProtectionParams(value);
}

export function deserializeOptionalProtectionParams(
  data: unknown
): OptionalProtectionParams {
  return data === null || data === undefined
    ? undefined
    : deserializeProtectionParams(data);
}
export function serializeOptionalRestorationParams(
  value: ReadonlyOptionalRestorationParams
) {
  return value === undefined || value === null
    ? undefined
    : serializeRestorationParams(value);
}

export function deserializeOptionalRestorationParams(
  data: unknown
): OptionalRestorationParams {
  return data === null || data === undefined
    ? undefined
    : deserializeRestorationParams(data);
}
export function serializeRichEmoteComponents(
  value: ReadonlyRichEmoteComponents
) {
  return {
    fishing_info: serializeOptionalEmoteFishingInfo(value.fishing_info),
    throw_info: value.throw_info,
    item_override: serializeOptionalItem(value.item_override),
  };
}

const zRawRichEmoteComponents = z.object({
  fishing_info: z.unknown(),
  throw_info: z.unknown(),
  item_override: z.unknown(),
});

export function deserializeRichEmoteComponents(
  data: unknown
): RichEmoteComponents {
  const obj = zRawRichEmoteComponents.parse(data);
  return {
    fishing_info: deserializeOptionalEmoteFishingInfo(obj.fishing_info),
    throw_info: deserializeOptionalEmoteThrowInfo(obj.throw_info),
    item_override: deserializeOptionalItem(obj.item_override),
  };
}
export function serializeOptionalRichEmoteComponents(
  value: ReadonlyOptionalRichEmoteComponents
) {
  return value === undefined || value === null
    ? undefined
    : serializeRichEmoteComponents(value);
}

export function deserializeOptionalRichEmoteComponents(
  data: unknown
): OptionalRichEmoteComponents {
  return data === null || data === undefined
    ? undefined
    : deserializeRichEmoteComponents(data);
}
