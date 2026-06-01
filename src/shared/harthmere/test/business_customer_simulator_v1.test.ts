/// <reference types="mocha" />

import assert from "assert";
import { isTerrainID, safeGetTerrainId } from "../../asset_defs/terrain";
import {
  HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1,
  HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS_V1,
  HARTHMERE_BUSINESS_MINIGAME_SPECS_V1,
  HARTHMERE_BUSINESS_BIKKIE_GRAPHICS_V1,
  HARTHMERE_BUSINESS_OUTPOST_MAP_MARKERS_V1,
  HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1,
  HARTHMERE_BUSINESS_OUTPOST_REBUILD_REVISION_V1,
  HARTHMERE_BUSINESS_OUTPOST_SAFE_SITES_V1,
  HARTHMERE_BUSINESS_OUTPOST_TERRAIN_GROUND_Y_BY_ID_V1,
  HARTHMERE_BUSINESS_OUTPOSTS_V1,
  isPointInsideHarthmereBusinessSafeSiteV1,
  validateHarthmereBusinessOutpostSafeSitingV1,
  HARTHMERE_BUSINESS_SERVICE_ANIMATION_CUE_SPECS_V1,
  HARTHMERE_BUSINESS_SERVICE_ITEM_CATALOG_V1,
  HARTHMERE_GROVE_BUSINESS_BUILDING_REFERENCE_COORDINATES_V1,
  HARTHMERE_GROVE_BUSINESS_BUILDING_SOURCE_SCAN_V1,
  HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES_V1,
  HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_V1,
  HARTHMERE_GROVE_BUSINESS_PEOPLE_REFERENCE_COORDINATES_V1,
  HARTHMERE_GROVE_BUSINESS_PEOPLE_SOURCE_SCAN_V1,
  applyHarthmereBusinessCozyServiceRewardV1,
  createHarthmereBusinessOutpostRebuildMaterializationPlansV1,
  createHarthmereBusinessCozyServiceRewardV1,
  createHarthmereBusinessCustomerQueueV1,
  createHarthmereBusinessMiniGameDecisionForOfferV1,
  defaultHarthmereBusinessCustomerStatsV1,
  harthmereBusinessOutpostGroundYV1,
  getHarthmereBusinessBikkieGraphicForServiceCueV1,
  getHarthmereBusinessBikkieGraphicsV1,
  getHarthmereBusinessServiceAnimationCueSpecV1,
  resolveHarthmereBusinessMiniGameDecisionV1,
  validateHarthmereGroveBusinessCoordinateReferenceRolesV1,
  validateHarthmereBusinessBikkieGraphicsV1,
  validateHarthmereBusinessOutpostLiveWorldNavigationV1,
  validateHarthmereBusinessOutpostPassabilityV1,
  validateHarthmereBusinessOutpostProductionReadinessV1,
  validateHarthmereBusinessServiceItemReferencesV1,
} from "../business_customer_simulator_v1";
import { BikkieIds } from "../../bikkie/ids";
import { GROVE_ECONOMY_STARTER_NPCS_V1 } from "../grove_economy_starter_v1";
import { HARTHMERE_ECONOMY_BUSINESS_TYPES_V1 } from "../mmo_economy_authority_v1";

const EXPECTED_OUTPOST_PRESENTATION = {
  outpost_refinery_ashline: ["grove_workshop_warehouse", "spark", "arcane_lanterns", "Four-lane sample conveyor"],
  outpost_biome_repair_north: ["grove_workshop_warehouse", "hammer", "workshop_crates", "Diagnostic tree panel"],
  outpost_design_glassyard: ["grove_wood_shop", "star", "garden_planters", "Mood palette chip board"],
  outpost_security_redoubt: ["grove_workshop_warehouse", "shield", "workshop_crates", "Intel threat card table"],
  outpost_portal_eastgate: ["grove_stone_storefront", "spark", "arcane_lanterns", "Portal gate traffic board"],
  outpost_rare_foods_southplot: ["grove_wood_shop", "leaf", "market_baskets", "Freshness triage counter"],
  outpost_tools_cinderlane: ["grove_workshop_warehouse", "hammer", "workshop_crates", "Gear material matching bench"],
  outpost_magic_moonstall: ["grove_stone_storefront", "spark", "arcane_lanterns", "Risk outcome ward board"],
  outpost_exploration_westtrail: ["grove_wood_shop", "star", "workshop_crates", "Route freshness map table"],
  outpost_property_keylot: ["grove_wood_shop", "star", "garden_planters", "Build stage permit board"],
  outpost_trader_brightcart: ["grove_wood_shop", "star", "market_baskets", "Live price board"],
  outpost_hunter_ridgecooler: ["grove_wood_shop", "leaf", "market_baskets", "Cold chain larder shelf"],
  outpost_clinic_greenlamp: ["grove_stone_storefront", "cross", "clean_clinic_lanterns", "Severity triage board"],
  outpost_teleport_returnstone: ["grove_stone_storefront", "spark", "arcane_lanterns", "Access rights console"],
  outpost_sanitation_clearbarrel: ["grove_workshop_warehouse", "hammer", "workshop_crates", "Waste classification board"],
  outpost_repair_hingehall: ["grove_workshop_warehouse", "hammer", "workshop_crates", "Work order card board"],
  outpost_restaurant_redpot: ["grove_wood_shop", "star", "garden_planters", "Buff service line"],
  outpost_courier_stampspur: ["grove_wood_shop", "parcel", "workshop_crates", "Trust ladder board"],
  outpost_hospitality_lanternrest: ["grove_wood_shop", "key", "garden_planters", "Room key wall"],
} as const;

const EXPECTED_OUTPOST_LOCATIONS = {
  outpost_refinery_ashline: [673.9607002774867, 66, -44.2340338348435],
  outpost_biome_repair_north: [766.3165027736272, 62, 38.15010652462001],
  outpost_design_glassyard: [1183.0170734645067, 45, 138.49653880112697],
  outpost_security_redoubt: [1451.8214258969656, 46, 76.83012025065366],
  outpost_portal_eastgate: [1578.3584113411857, 65, -136.1081433897003],
  outpost_rare_foods_southplot: [1723.0393328285693, 49, -587.6317928761343],
  outpost_tools_cinderlane: [1630.2156864624603, 42, -779.5120794973495],
  outpost_magic_moonstall: [1726.6306120121526, 26, -906.2236258204618],
  outpost_exploration_westtrail: [1541.436211800648, 51, -695.2005299046266],
  outpost_property_keylot: [1229.236784706693, 53, -789.3263381042989],
  outpost_trader_brightcart: [985.6255482322824, 52, -934.0141827281337],
  outpost_hunter_ridgecooler: [776.1540415580398, 36, -666.9863482524036],
  outpost_clinic_greenlamp: [656.2165898145233, 64, -182.1346179092896],
  outpost_teleport_returnstone: [41.873235725931465, 40, -30.097021931250612],
  outpost_sanitation_clearbarrel: [434.6602350827924, 44, -346.6819172551751],
  outpost_repair_hingehall: [428.8887539912923, 45, -316.7794260638374],
  outpost_restaurant_redpot: [425.11624353121545, 43, -382.02543201953387],
  outpost_courier_stampspur: [750.9801218122271, 46, -550.5216277478082],
  outpost_hospitality_lanternrest: [605.6295568653649, 47, -483.82449044213433],
} as const;

describe("business_customer_simulator_v1", () => {
  it("stores 50 unique customer-only NPCs away from the permanent map", () => {
    assert.equal(HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1.length, 50);
    const ids = new Set<string>();
    const visualSignatures = new Set<string>();
    for (const npc of HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1) {
      assert.equal(npc.customerOnly, true);
      assert.equal(npc.mapPlacement, "none");
      assert.equal(npc.spawnPolicy, "business_owner_session_only");
      assert.ok(npc.businessPreferences.length >= 2);
      assert.ok(npc.patience >= 40);
      ids.add(npc.npcId);
      visualSignatures.add(Object.values(npc.appearance).join("|"));
    }
    assert.equal(ids.size, 50);
    assert.equal(visualSignatures.size, 50);
  });

  it("separates report building references from Grove people/NPC reference coordinates", () => {
    const audit = validateHarthmereGroveBusinessCoordinateReferenceRolesV1();
    assert.equal(audit.ok, true, audit.errors.join(", "));
    assert.equal(audit.buildingReferenceCount, 8);
    assert.equal(audit.peopleReferenceCount, 6);
    assert.equal(HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES_V1.length, 14);
    assert.equal(HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_V1.materializesBuildings, false);
    assert.equal(
      HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_V1.placementPolicy,
      "design_and_furniture_reference_only_do_not_build_here",
    );
    assert.equal(
      HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_V1.interiorCapturePolicy,
      "four_cardinal_views_per_coordinate_with_slow_post_load_settle",
    );
    assert.equal(
      HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_V1.findings.length,
      HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES_V1.length,
    );
    assert.equal(
      HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_V1.interiorFindings.length,
      HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES_V1.length,
    );
    assert.ok(
      HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_V1.reusableInteriorCues.some(
        (cue) => cue.includes("service counters"),
      ),
    );
    assert.equal(HARTHMERE_GROVE_BUSINESS_PEOPLE_REFERENCE_COORDINATES_V1.length, 6);
    assert.equal(HARTHMERE_GROVE_BUSINESS_PEOPLE_SOURCE_SCAN_V1.coordinatesAreOutposts, false);
    assert.equal(HARTHMERE_GROVE_BUSINESS_PEOPLE_SOURCE_SCAN_V1.materializesBuildings, false);
    assert.equal(
      HARTHMERE_GROVE_BUSINESS_PEOPLE_SOURCE_SCAN_V1.placementPolicy,
      "people_reference_only_do_not_build_here",
    );
    assert.ok(
      HARTHMERE_GROVE_BUSINESS_PEOPLE_SOURCE_SCAN_V1.findings.every((finding) =>
        finding.semanticUse.some((use) => use.includes("not a business outpost site")),
      ),
    );
    assert.equal(GROVE_ECONOMY_STARTER_NPCS_V1.length, 6);
    assert.ok(
      GROVE_ECONOMY_STARTER_NPCS_V1.every((npc) =>
        npc.proceduralAppearanceSpec.voxelSeed.length > 0 &&
        npc.proceduralAppearanceSpec.palette.length > 0 &&
        npc.proceduralAppearanceSpec.silhouette.length > 0
      ),
      "Grove economy people references should stay on procedural appearance specs, not hand-placed building props",
    );
  });

  it("defines a complete service mini-game for every production business type", () => {
    const businessTypes = Object.keys(HARTHMERE_ECONOMY_BUSINESS_TYPES_V1);
    assert.equal(businessTypes.length, 19);
    assert.deepEqual(Object.keys(HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS_V1).sort(), businessTypes.sort());
    for (const typeId of businessTypes) {
      const definition = HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS_V1[typeId as keyof typeof HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS_V1];
      assert.ok(definition.offers.length >= 3, `${typeId} needs multiple service choices`);
      assert.ok(definition.askTemplates.length >= 3, `${typeId} needs multiple customer asks`);
      assert.equal(definition.progression.length, 4);
      assert.ok(definition.dailyReturnTriggers.length >= 3);
      assert.ok(definition.challengeGrowth.length >= 4);
      assert.ok(definition.empireReinforcement.length >= 3);
      assert.equal(definition.mechanicSpec, HARTHMERE_BUSINESS_MINIGAME_SPECS_V1[typeId as keyof typeof HARTHMERE_BUSINESS_MINIGAME_SPECS_V1]);
      assert.equal(definition.mechanicSpec.typeId, typeId);
      assert.equal(definition.mechanicSpec.uiElements.length, 5);
      assert.equal(definition.mechanicSpec.customerTypes.length, 4);
      assert.equal(definition.mechanicSpec.difficultyScaling.length, 4);
      assert.equal(definition.mechanicSpec.edgeCases.length, 3);
      assert.equal(definition.mechanicSpec.edgeFailureActions.length, 3);
      assert.equal(definition.mechanicSpec.interiorFixtureLabels.length, 4);
      assert.equal(definition.navigation.movementPolicy, "walk_queue_counter_exit");
      assert.deepEqual(definition.navigation.serviceFlow, ["enter", "join queue", "approach counter", "wait for service", "react", "exit"]);
      assert.ok(definition.navigation.passableClearance.aisleWidthBlocks >= 2);
      assert.ok(definition.navigation.passableClearance.counterClearanceBlocks >= 2);
      assert.equal(definition.navigation.stuckRecovery.fallbackPolicy, "repath_then_sidestep_then_exit");
      assert.ok(definition.navigation.stuckRecovery.fallbackExitAfterMs >= 10000);
      for (const ask of definition.askTemplates) {
        assert.ok(definition.offers.some((offer) => offer.offerId === ask.desiredOfferId), `${typeId} ask ${ask.askId} must match an offer`);
      }
    }
  });

  it("implements the documented mini-game rules for every business offer and edge case", () => {
    for (const [typeId, definition] of Object.entries(HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS_V1)) {
      const spec = definition.mechanicSpec;
      assert.equal(spec.offerRules.length, definition.offers.length, `${typeId} needs one mechanic rule per offer`);
      for (const offer of definition.offers) {
        const decision = createHarthmereBusinessMiniGameDecisionForOfferV1(typeId as any, offer.offerId);
        const result = resolveHarthmereBusinessMiniGameDecisionV1({
          typeId: typeId as any,
          offerId: offer.offerId,
          decision,
        });
        assert.equal(result.ok, true, `${typeId}:${offer.offerId} valid decision should pass ${result.warnings.join(", ")}`);
        const firstKey = Object.keys(decision)[0];
        assert.ok(firstKey, `${typeId}:${offer.offerId} should have an auditable decision field`);
        const invalid = { ...decision, [firstKey]: "__wrong__" };
        const failed = resolveHarthmereBusinessMiniGameDecisionV1({
          typeId: typeId as any,
          offerId: offer.offerId,
          decision: invalid,
        });
        assert.equal(failed.ok, false, `${typeId}:${offer.offerId} wrong ${firstKey} should fail`);
      }
      for (const edgeCase of spec.edgeFailureActions) {
        const offer = definition.offers[0];
        const failed = resolveHarthmereBusinessMiniGameDecisionV1({
          typeId: typeId as any,
          offerId: offer.offerId,
          decision: {
            ...createHarthmereBusinessMiniGameDecisionForOfferV1(typeId as any, offer.offerId),
            ...edgeCase.when,
          },
        });
        assert.equal(failed.ok, false, `${typeId}:${edgeCase.failureId} should fail`);
        assert.ok(failed.warnings.includes(edgeCase.warning), `${typeId}:${edgeCase.failureId} should report ${edgeCase.warning}`);
      }
    }
  });

  it("assigns Bikkie graphics with metadata to every business service surface", () => {
    const businessTypes = Object.keys(HARTHMERE_ECONOMY_BUSINESS_TYPES_V1);
    assert.deepEqual(Object.keys(HARTHMERE_BUSINESS_BIKKIE_GRAPHICS_V1).sort(), businessTypes.sort());
    const validation = validateHarthmereBusinessBikkieGraphicsV1();
    assert.equal(validation.ok, true, JSON.stringify(validation));
    for (const typeId of businessTypes) {
      const graphics = getHarthmereBusinessBikkieGraphicsV1(typeId as keyof typeof HARTHMERE_BUSINESS_BIKKIE_GRAPHICS_V1);
      const definition = HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS_V1[typeId as keyof typeof HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS_V1];
      assert.ok(graphics.length >= 3, `${typeId} should have several Bikkie graphics`);
      assert.deepEqual(definition.bikkieGraphics, graphics);
      assert.ok(graphics.some((graphic) => graphic.role === "primary_station"), `${typeId} needs a primary station`);
      for (const graphic of graphics) {
        assert.ok(Number(graphic.bikkieId) > 0, `${graphic.graphicId} needs a Bikkie id`);
        assert.ok(graphic.label.length >= 3, `${graphic.graphicId} needs a label`);
        assert.ok(graphic.description.length >= 10, `${graphic.graphicId} needs description metadata`);
        assert.ok(graphic.businessUse.length >= 10, `${graphic.graphicId} needs business-use metadata`);
        assert.ok(graphic.colors.length > 0, `${graphic.graphicId} needs color metadata`);
        assert.ok(graphic.visual, `${graphic.graphicId} needs a resolved visual`);
        assert.match(graphic.visual.primaryHex, /^#[0-9a-f]{6}$/);
        assert.ok(graphic.visual.glyph.length >= 1);
        assert.equal(graphic.visual.label, graphic.label);
        if (graphic.galoisPath) {
          assert.equal(graphic.visual.iconAssetPath, `icons/${graphic.galoisPath}`);
        }
        if (graphic.kind === "crafting_station") {
          assert.ok(graphic.boxSize, `${graphic.graphicId} needs box size metadata`);
          assert.equal(graphic.boxSize!.length, 3);
        }
      }
    }
  });

  it("maps the most relevant Bikkie graphics onto business recipes, stations, and service cues", () => {
    const namesFor = (typeId: keyof typeof HARTHMERE_BUSINESS_BIKKIE_GRAPHICS_V1) =>
      new Set(getHarthmereBusinessBikkieGraphicsV1(typeId).map((graphic) => graphic.bikkieName));
    assert.ok(namesFor("food_service_restaurant").has("Kitchen"));
    assert.ok(namesFor("food_service_restaurant").has("Angler's Table"));
    assert.ok(namesFor("biome_farming_rare_foods").has("Seed Mill"));
    assert.ok(namesFor("biome_farming_rare_foods").has("Composter"));
    assert.ok(namesFor("weapons_tools").has("Workbench"));
    assert.ok(namesFor("weapons_tools").has("Thermoblaster"));
    assert.ok(namesFor("biome_design_studio").has("Dye-O-Matic"));
    assert.ok(namesFor("biome_design_studio").has("Tailoring Booth"));
    assert.ok(namesFor("custom_home_property_development").has("Builder's Wand"));
    assert.ok(namesFor("waste_sanitation_cleanup").has("Ye Olde Muck Buster"));
    assert.equal(getHarthmereBusinessBikkieGraphicForServiceCueV1("procedural_plate_slide_counter")?.bikkieName, "Kitchen");
    assert.equal(getHarthmereBusinessBikkieGraphicForServiceCueV1("procedural_parcel_weigh_tag")?.bikkieName, "Parcel");
    assert.equal(getHarthmereBusinessBikkieGraphicForServiceCueV1("procedural_blueprint_unroll_point")?.bikkieName, "Paper");
  });

  it("keeps every service interaction on a procedural voxel-safe animation cue", () => {
    const cues = new Set<string>();
    for (const definition of Object.values(HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS_V1)) {
      for (const offer of definition.offers) {
        assert.match(offer.animationCue, /^procedural_[a-z0-9_]+$/);
        cues.add(offer.animationCue);
        const spec = getHarthmereBusinessServiceAnimationCueSpecV1(offer.animationCue);
        assert.ok(spec, `${offer.animationCue} needs a cue spec`);
        assert.equal(spec.safety.procedural, true);
        assert.equal(spec.safety.voxelSafe, true);
        assert.equal(spec.safety.noRootMotion, true);
        assert.equal(spec.safety.noSkeletonRequirement, true);
        assert.equal(spec.safety.rotationOnlyPose, true);
        assert.ok(spec.durationMs >= 650 && spec.durationMs <= 1300);
        assert.ok(spec.ownerChannels.length >= 3);
        assert.ok(spec.propMotion.length > 5);
        assert.ok(spec.customerReaction.endsWith("_accept"));
      }
    }
    assert.equal(cues.size, Object.values(HARTHMERE_BUSINESS_SERVICE_ANIMATION_CUE_SPECS_V1).length);
  });

  it("cross-references every service ask item against the customer-service item catalog", () => {
    const validation = validateHarthmereBusinessServiceItemReferencesV1();
    assert.equal(validation.ok, true);
    assert.deepEqual(validation.missingRequiredItems, []);
    assert.deepEqual(validation.missingProducedItems, []);
    for (const definition of Object.values(HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS_V1)) {
      for (const offer of definition.offers) {
        for (const itemId of Object.keys({ ...offer.requiredItems, ...(offer.producedItems ?? {}) })) {
          const item = HARTHMERE_BUSINESS_SERVICE_ITEM_CATALOG_V1[itemId];
          assert.ok(item, `${itemId} should be in the catalog`);
          assert.equal(item.productionUse, "customer_service_minigame");
          assert.ok(item.displayName.length >= 3);
        }
      }
    }
  });

  it("creates deterministic customer queues with real NPCs and matching asks", () => {
    const stats = defaultHarthmereBusinessCustomerStatsV1("business_food");
    const result = createHarthmereBusinessCustomerQueueV1({
      businessId: "business_food",
      typeId: "food_service_restaurant",
      sessionId: "session_1",
      nowMs: 1000,
      count: 5,
      nextTicketNumber: 7,
      stats,
    });
    assert.equal(result.queue.length, 5);
    assert.equal(result.nextTicketNumber, 12);
    for (const ticket of result.queue) {
      assert.ok(HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1.some((npc) => npc.npcId === ticket.npcId));
      assert.equal(ticket.status, "waiting");
      assert.ok(ticket.requestedOfferId);
      assert.ok(ticket.patienceRemaining > 0);
    }
  });

  it("tracks cozy non-money service rewards without replacing money rewards", () => {
    const definition = HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS_V1.food_service_restaurant;
    const offer = definition.offers.find((entry) => entry.offerId === "serve_worker_meal")!;
    const ticket = createHarthmereBusinessCustomerQueueV1({
      businessId: "business_food",
      typeId: "food_service_restaurant",
      sessionId: "session_1",
      nowMs: 1000,
      count: 1,
      nextTicketNumber: 1,
    }).queue[0];
    const stats = defaultHarthmereBusinessCustomerStatsV1("business_food");
    stats.totalServed = 19;
    const reward = createHarthmereBusinessCozyServiceRewardV1({
      businessId: "business_food",
      typeId: "food_service_restaurant",
      npcId: ticket.npcId,
      npcDisplayName: "Jessa Mint",
      offer,
      ticket,
      streak: 10,
      dailyBonusGold: 15,
      stats,
    });
    applyHarthmereBusinessCozyServiceRewardV1(stats, ticket.npcId, reward);
    assert.ok(reward.serviceXp > 0);
    assert.ok(reward.likeabilityDelta > 0);
    assert.ok(stats.serviceXp >= reward.serviceXp, JSON.stringify({ statsServiceXp: stats.serviceXp, rewardServiceXp: reward.serviceXp }));
    assert.ok(stats.likeability > 0);
    assert.ok((stats.friendshipPointsByNpcId[ticket.npcId] ?? 0) > 0);
    assert.ok(stats.favoriteCustomerNpcIds.includes(ticket.npcId));
    assert.ok(stats.thankYouNotes.some((note) => note.includes("your counter")));
    assert.ok(stats.repeatCustomerMemories.length > 0);
    assert.ok(stats.collectiblesEarned.length > 0);
    assert.ok(stats.decorationUnlocks.length > 0);
  });

  it("places one spread-out non-Grove job business outpost per business type", () => {
    const businessTypes = Object.keys(HARTHMERE_ECONOMY_BUSINESS_TYPES_V1);
    assert.equal(HARTHMERE_BUSINESS_OUTPOSTS_V1.length, 19);
    assert.deepEqual(HARTHMERE_BUSINESS_OUTPOSTS_V1.map((outpost) => outpost.businessType).sort(), businessTypes.sort());
    for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS_V1) {
      assert.notEqual(outpost.townId, "harthmere_grove");
      const expectedLocation = EXPECTED_OUTPOST_LOCATIONS[
        outpost.outpostId as keyof typeof EXPECTED_OUTPOST_LOCATIONS
      ];
      assert.ok(expectedLocation, `${outpost.outpostId} must have a fixed blueprint location`);
      assert.deepEqual(
        [outpost.position.x, outpost.position.y, outpost.position.z],
        expectedLocation,
        `${outpost.outpostId} location must not move while fixing construction`,
      );
      assert.ok(outpost.displayName.length > 5);
      assert.ok(outpost.job.title.length > 5);
      assert.ok(outpost.job.starterTask.length > 10);
      assert.ok(outpost.building.width >= 16);
      assert.ok(outpost.building.depth >= 12);
    }
    for (let i = 0; i < HARTHMERE_BUSINESS_OUTPOSTS_V1.length; i += 1) {
      for (let j = i + 1; j < HARTHMERE_BUSINESS_OUTPOSTS_V1.length; j += 1) {
        const a = HARTHMERE_BUSINESS_OUTPOSTS_V1[i].position;
        const b = HARTHMERE_BUSINESS_OUTPOSTS_V1[j].position;
        assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 28, `${HARTHMERE_BUSINESS_OUTPOSTS_V1[i].outpostId} is too close to ${HARTHMERE_BUSINESS_OUTPOSTS_V1[j].outpostId}`);
      }
    }
  });

  it("materializes every outpost as a server-owned procedural voxel building with passable customer paths", () => {
    assert.equal(Object.keys(HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1).length, HARTHMERE_BUSINESS_OUTPOSTS_V1.length);
    for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS_V1) {
      const record = HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1[outpost.outpostId];
      const expectedGroundY = harthmereBusinessOutpostGroundYV1(outpost);
      assert.ok(record, `${outpost.outpostId} needs a procedural building record`);
      assert.equal(record.serverOwned, true);
      assert.equal(record.sourceOfTruth, "backend_procedural_voxel_building");
      assert.equal(record.generationMode, "building_system_materialization_plan");
      assert.equal(record.materializationPlan.materializesSolidVoxelBuilding, true);
      assert.equal(record.origin.y, expectedGroundY, `${outpost.outpostId} origin must snap to its hilly terrain pad`);
      assert.equal(record.plot.groundY, expectedGroundY, `${outpost.outpostId} plot ground must match the pad`);
      assert.equal(record.materializationPlan.origin.y, expectedGroundY, `${outpost.outpostId} materialization plan must use the pad Y`);
      assert.equal(record.terrainGrounding.padGroundY, expectedGroundY);
      assert.equal(record.terrainGrounding.maxTerrainY, expectedGroundY);
      assert.ok(record.terrainGrounding.minTerrainY <= expectedGroundY);
      assert.ok(record.terrainGrounding.maxLocalStepVoxels <= 2);
      assert.ok(record.terrainGrounding.samples.some((sample) => sample.label === "front_door" && sample.y === expectedGroundY));
      assert.equal(
        record.blueprint.footprint.width >= 24,
        true,
        `${outpost.outpostId} width=${record.blueprint.footprint.width} must be wide enough for a playable business minigame`,
      );
      assert.equal(
        record.blueprint.footprint.depth >= 20,
        true,
        `${outpost.outpostId} depth=${record.blueprint.footprint.depth} must be deep enough for customer queue, counter, and staff stations`,
      );
      assert.ok(record.materializationPlan.safeZone, `${outpost.outpostId} must create a safe-zone record`);
      assert.equal(record.materializationPlan.safeZone?.safeFromMuck, true);
      assert.ok(record.materializationPlan.edits.some((edit) => edit.label === "safe_ground"), `${outpost.outpostId} must include safe-ground edits`);
      assert.ok(
        record.materializationPlan.edits.some((edit) => edit.label === "safe_ground" && edit.position[1] === expectedGroundY),
        `${outpost.outpostId} must place safe-ground edits exactly on its terrain pad`,
      );
      assert.deepEqual(record.visualReferenceCoordinates, HARTHMERE_GROVE_BUSINESS_BUILDING_REFERENCE_COORDINATES_V1);
      assert.equal(record.visualReferenceCoordinates.length, 8);
      assert.equal(
        record.buildingStyleKit.sourceScanVersion,
        HARTHMERE_GROVE_BUSINESS_BUILDING_SOURCE_SCAN_V1.version,
      );
      assert.equal(HARTHMERE_GROVE_BUSINESS_BUILDING_SOURCE_SCAN_V1.scannedCoordinates.length, 8);
      assert.equal(
        HARTHMERE_GROVE_BUSINESS_BUILDING_SOURCE_SCAN_V1.authoredPlacementFindings.filter(
          (finding) => finding.sourceKind === "authored_placement_cluster",
        ).length,
        3,
      );
      assert.ok(
        record.buildingStyleKit.sourceAssetVocabulary.includes("arch_wall_wood_door"),
        `${outpost.outpostId} must reference the scanned Grove door vocabulary`,
      );
      assert.ok(
        record.buildingStyleKit.sourceAssetVocabulary.includes("arch_wall_window_glass"),
        `${outpost.outpostId} must reference the scanned Grove window vocabulary`,
      );
      for (const requiredGuideAsset of [
        "arch_wall_stone",
        "arch_wall_window_stone",
        "arch_roof_gable",
        "arch_stairs_wide_stone",
        "obj_wall_stairs",
        "bench_fp",
        "cabinet",
        "bookcase_2",
        "shelf_large",
        "shelf_small_bottles",
        "candle_triple",
        "crate_wooden_fp",
        "chest",
        "tree_crooked",
        "tree_high",
        "logs",
        "rock_small",
      ]) {
        assert.ok(
          record.buildingStyleKit.sourceAssetVocabulary.includes(requiredGuideAsset),
          `${outpost.outpostId} must keep ${requiredGuideAsset} from the updated Grove construction guide vocabulary`,
        );
      }
      assert.ok(
        record.buildingStyleKit.sourceAssetVocabulary.includes("table_long"),
        `${outpost.outpostId} must reference the scanned Grove service-table vocabulary`,
      );
      assert.ok(
        record.buildingStyleKit.sourceFeatureTags.includes("clear customer aisle"),
        `${outpost.outpostId} must preserve the scan-derived customer aisle requirement`,
      );
      assert.ok(record.buildingStyleKit.referenceLanguage.startsWith("grove_"));
      assert.equal(record.buildingStyleKit.foundation, "stone_foundation");
      assert.equal(record.buildingStyleKit.doorStyle, "wood_glass_panel");
      assert.equal(record.buildingStyleKit.windowStyle, "large_framed_shop_glass");
      assert.ok(record.buildingStyleKit.styleNotes.some((note) => note.includes("Grove") || note.includes("grove")));
      const exactPresentation = EXPECTED_OUTPOST_PRESENTATION[
        outpost.outpostId as keyof typeof EXPECTED_OUTPOST_PRESENTATION
      ];
      assert.ok(exactPresentation, `${outpost.outpostId} must have an exact guide presentation contract`);
      assert.equal(record.buildingStyleKit.referenceLanguage, exactPresentation[0], `${outpost.outpostId} uses the wrong Grove building language`);
      assert.equal(record.buildingStyleKit.signIcon, exactPresentation[1], `${outpost.outpostId} uses the wrong business sign icon`);
      assert.equal(record.buildingStyleKit.exteriorDressing, exactPresentation[2], `${outpost.outpostId} uses the wrong exterior dressing`);
      assert.ok(
        record.interiorFixtures.some((fixture) => fixture.label === exactPresentation[3]),
        `${outpost.outpostId} must include its business-specific fixture ${exactPresentation[3]}`,
      );
      const wallPositions = new Set(
        record.materializationPlan.edits
          .filter((edit) => edit.label === "wall")
          .map((edit) => edit.position.join(":")),
      );
      const doorX = record.origin.x + Math.floor(record.blueprint.footprint.width / 2);
      assert.equal(record.entrance.x, doorX);
      assert.equal(record.queueNode.x, doorX);
      assert.equal(record.serviceCounter.x, doorX);
      for (const y of [record.origin.y + 1, record.origin.y + 2]) {
        assert.equal(
          wallPositions.has([doorX, y, record.origin.z].join(":")),
          false,
          `${outpost.outpostId} must keep the report-specified 1x2 south-wall doorway void clear`,
        );
      }
      assert.equal(
        wallPositions.has([doorX - 1, record.origin.y + 1, record.origin.z].join(":")),
        true,
        `${outpost.outpostId} must keep a solid wall jamb left of the doorway`,
      );
      assert.equal(
        wallPositions.has([doorX + 1, record.origin.y + 1, record.origin.z].join(":")),
        true,
        `${outpost.outpostId} must keep a solid wall jamb right of the doorway`,
      );
      assert.ok(
        record.materializationPlan.edits.some((edit) =>
          edit.label === "stair" &&
          edit.position[0] === doorX &&
          edit.position[1] === record.origin.y &&
          edit.position[2] === record.origin.z - 1
        ),
        `${outpost.outpostId} must place the report-specified front stair at the doorway`,
      );
      const editsByLabel = (label: string) =>
        record.materializationPlan.edits.filter((edit) => edit.label === label);
      const editValuesByLabel = (label: string) =>
        new Set(editsByLabel(label).map((edit) => edit.value));
      const terrain = (name: string) => safeGetTerrainId(name) as any;
      for (const edit of record.materializationPlan.edits) {
        assert.equal(
          isTerrainID(Number(edit.value)),
          true,
          `${outpost.outpostId} edit ${edit.label} at ${edit.position.join(":")} must publish a real terrain block id, not a Bikkie item id`,
        );
      }
      assert.ok(
        editValuesByLabel("frame").has(terrain("oak_log")) &&
          editValuesByLabel("frame").has(terrain("oak_lumber")) &&
          editValuesByLabel("frame").has(terrain("simple_glass")),
        `${outpost.outpostId} must materialize Grove-style oak door frames and real glass window voxels`,
      );
      assert.ok(
        editsByLabel("interior").length >= 12,
        `${outpost.outpostId} must materialize real interior furniture and consumable samples`,
      );
      assert.ok(
        editsByLabel("storage_container").length >= 1,
        `${outpost.outpostId} must materialize stock/storage furniture, not just metadata`,
      );
      assert.ok(
        editValuesByLabel("business_marker").has(terrain("simple_glass")) ||
          editValuesByLabel("business_marker").has(terrain("oak_lumber")),
        `${outpost.outpostId} must have a physical customer dashboard access point inside the business`,
      );
      const x0 = record.origin.x;
      const x1 = record.origin.x + record.blueprint.footprint.width - 1;
      const z0 = record.origin.z;
      const z1 = record.origin.z + record.blueprint.footprint.depth - 1;
      const roofYs = new Set(editsByLabel("roof").map((edit) => edit.position[1]));
      assert.ok(
        roofYs.size >= 2 &&
          editsByLabel("roof").some((edit) =>
            edit.position[0] < x0 ||
            edit.position[0] > x1 ||
            edit.position[2] < z0 ||
            edit.position[2] > z1
          ),
        `${outpost.outpostId} must materialize a real roof plus overhang, not a flat floor-looking slab`,
      );
      assert.ok(
        editsByLabel("frame").some((edit) =>
          edit.position[1] >= record.origin.y + 4 &&
          edit.position[2] <= record.origin.z - 1
        ),
        `${outpost.outpostId} must materialize a supported storefront awning above the entrance`,
      );
      assert.ok(
        editsByLabel("door_lock").some((edit) => edit.position[2] <= record.origin.z),
        `${outpost.outpostId} must materialize a visible door/lock marker beside the open doorway`,
      );
      assert.ok(
        record.primaryBikkieGraphic &&
          record.interiorFixtures.some((fixture) =>
            fixture.role === "primary_station" &&
            fixture.bikkieGraphicId === record.primaryBikkieGraphic!.graphicId
          ) &&
          editsByLabel("business_marker").length >= 2,
        `${outpost.outpostId} must physically place its primary service station while keeping Bikkie metadata out of terrain edits`,
      );
      const blockingPhysicalLabels = new Set([
        "wall",
        "frame",
        "interior",
        "storage_container",
        "business_marker",
        "door_lock",
        "upgrade_addition",
      ]);
      for (const [nodeName, node] of Object.entries({
        entrance: record.entrance,
        queue: record.queueNode,
        serviceCounter: record.serviceCounter,
        exit: record.exitNode,
      })) {
        assert.equal(
          record.materializationPlan.edits.some((edit) =>
            blockingPhysicalLabels.has(edit.label) &&
            edit.position[0] === node.x &&
            edit.position[1] === node.y &&
            edit.position[2] === node.z
          ),
          false,
          `${outpost.outpostId} must keep ${nodeName} clear of physical decor and wall voxels`,
        );
      }
      const staffWorkPoint = {
        x: Math.min(
          record.origin.x + record.blueprint.footprint.width - 3,
          record.serviceCounter.x + 4,
        ),
        y: record.serviceCounter.y,
        z: Math.min(
          record.origin.z + record.blueprint.footprint.depth - 3,
          record.serviceCounter.z + 1,
        ),
      };
      assert.ok(
        staffWorkPoint.x > record.origin.x &&
          staffWorkPoint.x < record.origin.x + record.blueprint.footprint.width - 1 &&
          staffWorkPoint.z > record.origin.z &&
          staffWorkPoint.z < record.origin.z + record.blueprint.footprint.depth - 1,
        `${outpost.outpostId} must reserve an interior staff NPC work point`,
      );
      assert.equal(
        record.materializationPlan.edits.some((edit) =>
          blockingPhysicalLabels.has(edit.label) &&
          edit.position[0] === staffWorkPoint.x &&
          edit.position[1] === staffWorkPoint.y &&
          edit.position[2] === staffWorkPoint.z
        ),
        false,
        `${outpost.outpostId} must keep the staff NPC work point clear of blocking voxels`,
      );
      if (outpost.building.floors > 1) {
        assert.ok(
          editsByLabel("upgrade_addition").length >=
            (record.blueprint.footprint.width - 4) * (record.blueprint.footprint.depth - 6),
          `${outpost.outpostId} must materialize a real upper-floor deck for multi-floor business play`,
        );
        assert.ok(
          editsByLabel("stair").some((edit) => edit.position[1] > record.origin.y + 1),
          `${outpost.outpostId} must materialize an internal stair for the upper floor`,
        );
      }
      if (outpost.businessType === "food_service_restaurant") {
        assert.ok(
          record.interiorFixtures.some((fixture) =>
            fixture.role === "primary_station" &&
            /kitchen|cook|buff|service/i.test(fixture.label)
          ) &&
            record.materializationPlan.edits.some((edit) =>
              edit.label === "business_marker" &&
              (edit.value === terrain("stone_brick") || edit.value === terrain("oak_lumber"))
            ),
          `${outpost.outpostId} must include a physical voxel kitchen station`,
        );
      }
      if (outpost.businessType === "repair_maintenance_person") {
        assert.ok(
          record.interiorFixtures.some((fixture) =>
            fixture.role === "primary_station" &&
            /repair|work|bench|order/i.test(fixture.label)
          ) &&
            record.materializationPlan.edits.some((edit) =>
              edit.label === "business_marker" &&
              (edit.value === terrain("stone_polished") || edit.value === terrain("oak_lumber"))
            ),
          `${outpost.outpostId} must include a physical voxel repair workbench`,
        );
      }
      assert.deepEqual(record.bikkieGraphics, getHarthmereBusinessBikkieGraphicsV1(outpost.businessType));
      assert.equal(record.primaryBikkieGraphic?.role, "primary_station");
      assert.ok(record.materializationPlan.inWorldMarkers?.some((marker) => marker.markerId === `${outpost.outpostId}:business-counter`));
      assert.ok(record.materializationPlan.inWorldMarkers?.some((marker) => marker.markerId === `${outpost.outpostId}:customer-dashboard`));
      assert.equal(record.dashboardAccessPoint.interaction, "open_business_dashboard");
      assert.equal(record.dashboardAccessPoint.visibleFromEntrance, true);
      assert.equal(record.dashboardAccessPoint.keyboardlessTraversal, true);
      assert.ok(
        record.dashboardAccessPoint.position.x >= record.origin.x + 2 &&
          record.dashboardAccessPoint.position.x <= record.origin.x + record.blueprint.footprint.width - 2,
        `${outpost.outpostId} dashboard access point must sit inside the generated business`,
      );
      assert.ok(
        record.dashboardAccessPoint.position.z >= record.origin.z + 3 &&
          record.dashboardAccessPoint.position.z <= record.serviceCounter.z + 1,
        `${outpost.outpostId} dashboard access point must be reachable between the entry flow and counter`,
      );
      assert.ok(record.interiorFixtures.some((fixture) => fixture.role === "dashboard_access" && !fixture.blocksNavigation));
      assert.ok(record.interiorFixtures.some((fixture) => fixture.role === "service_counter" && !fixture.blocksNavigation));
      assert.ok(record.interiorFixtures.some((fixture) => fixture.role === "primary_station" && fixture.bikkieGraphicId === record.primaryBikkieGraphic?.graphicId));
      const fixtureIds = new Set(record.interiorFixtures.map((fixture) => fixture.fixtureId));
      assert.equal(fixtureIds.size, record.interiorFixtures.length, `${outpost.outpostId} must not duplicate interior fixture IDs`);
      const businessSpecificFixtures = record.interiorFixtures.filter((fixture) => fixture.businessSpecific);
      assert.ok(businessSpecificFixtures.length >= 5);
      assert.ok(
        businessSpecificFixtures.some((fixture) => fixture.role === "workstation" || fixture.role === "primary_station"),
        `${outpost.outpostId} must include a business-specific work station`,
      );
      assert.ok(
        businessSpecificFixtures.some((fixture) => fixture.role === "stock_storage"),
        `${outpost.outpostId} must include business-specific stock/storage decor`,
      );
      assert.ok(
        businessSpecificFixtures.every((fixture) => fixture.label !== "Service worktable" || !/restaurant|medical|weapons|refinery|portal|farming|courier|hospitality|security|waste|repair|design|property|exploration/.test(outpost.businessType)),
        `${outpost.outpostId} must use a business-specific decor set instead of only the generic fallback`,
      );
      assert.equal(record.interiorAudit.minigameReady, true);
      assert.equal(record.interiorAudit.hasAccessibleDoor, true);
      assert.equal(record.interiorAudit.hasReadableWindows, true);
      assert.equal(record.interiorAudit.hasCustomerDashboardAccess, true);
      assert.equal(record.interiorAudit.hasBusinessSpecificDecor, true);
      assert.ok(record.interiorAudit.customerQueueCapacity >= 4);
      assert.ok(record.interiorAudit.staffWorkstations >= 2);
      assert.ok(record.materializationPlan.inWorldMarkers?.some((marker) => marker.markerId.includes(":bikkie:") && marker.label.includes(record.primaryBikkieGraphic!.label)));
      const marker = HARTHMERE_BUSINESS_OUTPOST_MAP_MARKERS_V1.find(
        (entry) => entry.outpostId === outpost.outpostId,
      );
      assert.equal(marker?.primaryBikkieGraphic?.bikkieId, record.primaryBikkieGraphic?.bikkieId);
      assert.equal(marker?.primaryBikkieVisual?.visualId, record.primaryBikkieGraphic?.visual.visualId);
      assert.ok(record.structuralAudit.foundationEdits > 0);
      assert.ok(
        record.materializationPlan.edits.some((edit) =>
          edit.label === "foundation" && edit.position[1] < record.origin.y - 1
        ),
        `${outpost.outpostId} must include retaining foundation supports below uneven safe-zone terrain`,
      );
      assert.ok(record.structuralAudit.floorEdits > 0);
      assert.ok(record.structuralAudit.wallEdits > 0);
      assert.ok(record.structuralAudit.roofEdits > 0);
      assert.ok(record.clearances.frontDoorMeters >= 2);
      assert.ok(record.clearances.shopCustomerSpaceMeters >= 4);
      assert.ok(record.clearances.publicEntranceMeters >= 3);
      assert.ok(record.customerSpace.areaMeters >= 200);
      const audit = validateHarthmereBusinessOutpostPassabilityV1(record);
      assert.equal(audit.ok, true, `${outpost.outpostId} passability errors: ${audit.errors.join(", ")}`);
      assert.ok(audit.auditTags.includes("customer_path_clear"));
      const liveAudit = validateHarthmereBusinessOutpostLiveWorldNavigationV1(record);
      assert.equal(liveAudit.ok, true, `${outpost.outpostId} live navigation errors: ${liveAudit.unreachableRoutes.join(", ")} ${liveAudit.unresolvedCollisions.join(", ")}`);
      assert.equal(liveAudit.navmeshBake, "server_voxel_hydrated_grid");
      assert.equal(liveAudit.crowdActorCount, 3);
      assert.ok(liveAudit.routeCount >= 3);
      assert.ok(liveAudit.auditTags.includes("dynamic_blockers_checked"));
    }
  });

  it("has no business outpost production-readiness gaps", () => {
    const audit = validateHarthmereBusinessOutpostProductionReadinessV1();
    assert.equal(audit.ok, true, audit.gaps.join("\n"));
    assert.equal(audit.checkedOutposts, 19);
    assert.deepEqual(audit.uniqueGroundYValues, [
      26, 36, 40, 42, 43, 44, 45, 46, 47, 49, 51, 52, 53, 62, 64, 65, 66,
    ]);
    assert.ok(audit.auditTags.includes("hilly_terrain_grounding_checked"));
    assert.equal(
      Object.keys(HARTHMERE_BUSINESS_OUTPOST_TERRAIN_GROUND_Y_BY_ID_V1).length,
      HARTHMERE_BUSINESS_OUTPOSTS_V1.length,
    );
  });

  it("keeps production-coordinate business pads clear of existing Grove reference buildings", () => {
    const distanceToRect = (
      point: readonly [number, number, number],
      rect: { minX: number; maxX: number; minZ: number; maxZ: number },
    ) => {
      const dx =
        point[0] < rect.minX
          ? rect.minX - point[0]
          : point[0] > rect.maxX
            ? point[0] - rect.maxX
            : 0;
      const dz =
        point[2] < rect.minZ
          ? rect.minZ - point[2]
          : point[2] > rect.maxZ
            ? point[2] - rect.maxZ
            : 0;
      return Math.hypot(dx, dz);
    };

    for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS_V1) {
      const record =
        HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1[outpost.outpostId];
      const [minX, minZ] = [record.plot.bounds.xMin, record.plot.bounds.zMin];
      const [maxX, maxZ] = [record.plot.bounds.xMax, record.plot.bounds.zMax];
      const worldPad = { minX, maxX, minZ, maxZ };
      const nearestReferenceMeters = Math.min(
        ...HARTHMERE_GROVE_BUSINESS_BUILDING_REFERENCE_COORDINATES_V1.map(
          (coordinate) => distanceToRect(coordinate, worldPad),
        ),
      );
      assert.ok(
        nearestReferenceMeters >= 20,
        `${outpost.outpostId} shifted world pad must not overlap or crowd existing Grove reference buildings; nearest=${nearestReferenceMeters.toFixed(1)}m`,
      );
    }
  });

  it("fails live-world navigation when a permanent player object seals the service counter", () => {
    const record = HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1.outpost_restaurant_redpot;
    const audit = validateHarthmereBusinessOutpostLiveWorldNavigationV1(record, {
      dynamicBlockers: [{
        blockerId: "player_counter_wall",
        kind: "player_object",
        position: record.serviceCounter,
        radiusMeters: 1,
        temporary: false,
      }],
    });
    assert.equal(audit.ok, false);
    assert.ok(audit.unreachableRoutes.some((route) => route.includes("service") || route.includes("counter")));
  });

  it("creates cleanup-plus-rebuild plans for production business outpost migrations", () => {
    const plans = createHarthmereBusinessOutpostRebuildMaterializationPlansV1();
    assert.equal(plans.length, HARTHMERE_BUSINESS_OUTPOSTS_V1.length * 2);
    assert.ok(HARTHMERE_BUSINESS_OUTPOST_REBUILD_REVISION_V1.includes("solid-voxel"));
    for (let index = 0; index < plans.length; index += 2) {
      const cleanup = plans[index];
      const rebuild = plans[index + 1];
      assert.ok(cleanup.requestId.endsWith("_backend_cleanup_before_rebuild_v2"));
      assert.equal(cleanup.partialMaterialization, true);
      assert.ok(cleanup.edits.length > 500, `${cleanup.requestId} needs enough deletion edits to remove stale shells`);
      assert.ok(cleanup.edits.every((edit) => edit.label === "demolition_cleanup" && edit.value === 0));
      const outpostId = cleanup.requestId.replace("_backend_cleanup_before_rebuild_v2", "");
      const record = HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1[outpostId];
      assert.ok(
        record &&
          cleanup.edits.some((edit) =>
            edit.position[0] === record.origin.x + 1 &&
            edit.position[1] === record.origin.y + 2 &&
            edit.position[2] === record.origin.z + 1
          ),
        `${cleanup.requestId} must clear stale interior/slab voxels before rebuilding the real business`,
      );
      assert.ok(
        cleanup.edits.some((edit) =>
          edit.position[0] === record.plot.bounds.xMin &&
          edit.position[1] === record.origin.y - 4 &&
          edit.position[2] === record.plot.bounds.zMin
        ),
        `${cleanup.requestId} must clear the full raised safe-zone pad volume before rebuilding`,
      );
      assert.ok(
        rebuild.edits.some((edit) =>
          edit.label === "safe_ground" &&
          edit.position[1] === record.origin.y &&
          edit.value !== 0
        ),
        `${rebuild.requestId} must pave a raised safe-zone pad at the final business floor height`,
      );
      assert.equal(rebuild.materializesSolidVoxelBuilding, true);
      assert.ok(rebuild.edits.some((edit) => edit.label === "foundation"));
      assert.ok(rebuild.edits.some((edit) => edit.label === "wall"));
      assert.ok(rebuild.edits.some((edit) => edit.label === "business_marker"));
    }
  });

  it("publishes all four minigame fixture labels as named interior fixtures for every outpost", () => {
    for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS_V1) {
      const record = HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1[outpost.outpostId];
      const spec = HARTHMERE_BUSINESS_MINIGAME_SPECS_V1[outpost.businessType as keyof typeof HARTHMERE_BUSINESS_MINIGAME_SPECS_V1];
      assert.ok(spec, `${outpost.outpostId} needs a minigame spec`);
      for (const label of spec.interiorFixtureLabels) {
        assert.ok(
          record.interiorFixtures.some((fixture) => fixture.label === label),
          `${outpost.outpostId} must include fixture "${label}" from minigame spec interiorFixtureLabels`,
        );
      }
      // Validate the four minigame spec fixtures have the correct roles in order
      const businessSpecific = record.interiorFixtures.filter((f) => f.businessSpecific);
      const [primaryBoard, , stockSurface] = spec.interiorFixtureLabels;
      assert.ok(
        businessSpecific.some((f) => f.label === primaryBoard && f.role === "workstation"),
        `${outpost.outpostId} primary board fixture must be role "workstation"`,
      );
      assert.ok(
        businessSpecific.some((f) => f.label === stockSurface && f.role === "stock_storage"),
        `${outpost.outpostId} stock surface fixture must be role "stock_storage"`,
      );
    }
  });

  it("stores cleanup rebuild plans covering the full materialized footprint not just declared dimensions", () => {
    const plans = createHarthmereBusinessOutpostRebuildMaterializationPlansV1();
    for (let index = 0; index < plans.length; index += 2) {
      const cleanup = plans[index];
      const outpostId = cleanup.requestId.replace("_backend_cleanup_before_rebuild_v2", "");
      const record = HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1[outpostId];
      if (!record) continue;
      // Every voxel from the rebuild plan must be covered by the cleanup plan
      const cleanupKeys = new Set(cleanup.edits.map((edit) => edit.position.join(":")));
      const rebuild = plans[index + 1];
      for (const edit of rebuild.edits) {
        if (edit.label === "safe_ground" || edit.label === "boundary_marker") continue;
        assert.ok(
          cleanupKeys.has(edit.position.join(":")),
          `${outpostId} cleanup must cover rebuild position ${edit.position.join(":")} (label: ${edit.label})`,
        );
      }
    }
  });

  it("reports legacy outpost records with missing validation arrays instead of throwing", () => {
    const legacyRecord = JSON.parse(JSON.stringify(
      HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1.outpost_restaurant_redpot
    ));
    delete legacyRecord.buildingStyleKit.styleNotes;
    delete legacyRecord.interiorFixtures;
    delete legacyRecord.materializationPlan.edits;

    const passability = validateHarthmereBusinessOutpostPassabilityV1(legacyRecord);
    assert.equal(passability.ok, false);
    assert.ok(passability.errors.includes("outpost_style_kit_missing_style_notes"));
    assert.ok(passability.errors.includes("outpost_missing_interior_fixtures"));
    assert.ok(passability.errors.includes("outpost_materialization_plan_missing_edits"));

    const navigation = validateHarthmereBusinessOutpostLiveWorldNavigationV1(legacyRecord);
    assert.equal(navigation.navmeshBake, "server_voxel_hydrated_grid");
    assert.ok(Array.isArray(navigation.unreachableRoutes));
  });

  it("sites all 19 businesses without stacking on buildings, roads, or reference structures", () => {
    const siting = validateHarthmereBusinessOutpostSafeSitingV1();
    assert.equal(
      siting.ok,
      true,
      `business siting errors: ${siting.errors.join(", ")}`,
    );
    assert.equal(siting.checkedSites, 19);
  });

  it("relocates muck to a real nearby muck area for every business safe site", () => {
    for (const site of HARTHMERE_BUSINESS_OUTPOST_SAFE_SITES_V1) {
      assert.ok(
        site.muckRelocation.distanceMeters > 0,
        `${site.outpostId} must relocate muck to a separate area`,
      );
      // The relocation target must be outside the protected safe site.
      assert.equal(
        isPointInsideHarthmereBusinessSafeSiteV1({
          x: site.muckRelocation.center.x,
          z: site.muckRelocation.center.z,
        }),
        false,
        `${site.outpostId} muck relocation anchor must sit outside any business safe site`,
      );
    }
  });

  it("treats the inside of every business safe site as safe and far-away wilds as unsafe", () => {
    for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS_V1) {
      assert.equal(
        isPointInsideHarthmereBusinessSafeSiteV1({
          x: outpost.position.x,
          z: outpost.position.z,
        }),
        true,
        `${outpost.outpostId} center must be inside its own safe site`,
      );
    }
    assert.equal(
      isPointInsideHarthmereBusinessSafeSiteV1({ x: 332, z: -390 }),
      false,
      "the Watchtower muck clearing must remain an unsafe muck area",
    );
  });

  it("grades a flat, fertile, green garden yard around every business building", () => {
    for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS_V1) {
      const record = HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1[outpost.outpostId];
      const grass = safeGetTerrainId("grass");
      const dirt = safeGetTerrainId("dirt");
      const groundY = record.origin.y;

      // Grass safe-ground laid beyond the plot bounds (the garden ring yard).
      const gardenGrass = record.materializationPlan.edits.filter(
        (edit) =>
          edit.label === "safe_ground" &&
          edit.position[1] === groundY &&
          (edit.position[0] < record.plot.bounds.xMin ||
            edit.position[0] >= record.plot.bounds.xMax ||
            edit.position[2] < record.plot.bounds.zMin ||
            edit.position[2] >= record.plot.bounds.zMax),
      );
      assert.ok(
        gardenGrass.length > 0,
        `${outpost.outpostId} must pave a green garden yard ring`,
      );
      assert.ok(
        gardenGrass.some((edit) => Number(edit.value) === Number(grass)),
        `${outpost.outpostId} garden yard must use grass`,
      );

      // Sub-grade dirt fill directly below the pad to remove drops/holes.
      const subGrade = record.materializationPlan.edits.filter(
        (edit) =>
          edit.label === "foundation" &&
          edit.position[1] === groundY - 1 &&
          Number(edit.value) === Number(dirt),
      );
      assert.ok(
        subGrade.length > 0,
        `${outpost.outpostId} must fill sub-grade dirt so the yard is flat`,
      );

      // Every edit remains a real terrain voxel (no Bikkie/item ids, no holes).
      assert.ok(
        record.materializationPlan.edits.every((edit) =>
          isTerrainID(Number(edit.value)),
        ),
        `${outpost.outpostId} grading must use only terrain voxels`,
      );
    }
  });

  it("clears the full graded garden site before rebuild so no muck or hill remains", () => {
    const plans = createHarthmereBusinessOutpostRebuildMaterializationPlansV1();
    for (let index = 0; index < plans.length; index += 2) {
      const cleanup = plans[index];
      const outpostId = cleanup.requestId.replace(
        "_backend_cleanup_before_rebuild_v2",
        "",
      );
      const record = HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1[outpostId];
      if (!record) continue;
      const cleanupKeys = new Set(cleanup.edits.map((edit) => edit.position.join(":")));
      // Garden-ring grass and sub-grade fill must be covered by cleanup too.
      for (const edit of record.materializationPlan.edits) {
        if (edit.label === "safe_ground" || edit.label === "boundary_marker") continue;
        assert.ok(
          cleanupKeys.has(edit.position.join(":")),
          `${outpostId} cleanup must cover graded edit ${edit.position.join(":")} (${edit.label})`,
        );
      }
    }
  });
});
