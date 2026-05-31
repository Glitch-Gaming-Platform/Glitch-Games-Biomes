/// <reference types="mocha" />

import assert from "assert";
import {
  HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1,
  HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS_V1,
  HARTHMERE_BUSINESS_BIKKIE_GRAPHICS_V1,
  HARTHMERE_BUSINESS_OUTPOST_MAP_MARKERS_V1,
  HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1,
  HARTHMERE_BUSINESS_OUTPOSTS_V1,
  HARTHMERE_BUSINESS_SERVICE_ANIMATION_CUE_SPECS_V1,
  HARTHMERE_BUSINESS_SERVICE_ITEM_CATALOG_V1,
  HARTHMERE_GROVE_BUSINESS_BUILDING_REFERENCE_COORDINATES_V1,
  HARTHMERE_GROVE_BUSINESS_BUILDING_SOURCE_SCAN_V1,
  HARTHMERE_GROVE_BUSINESS_PEOPLE_REFERENCE_COORDINATES_V1,
  HARTHMERE_GROVE_BUSINESS_PEOPLE_SOURCE_SCAN_V1,
  applyHarthmereBusinessCozyServiceRewardV1,
  createHarthmereBusinessCozyServiceRewardV1,
  createHarthmereBusinessCustomerQueueV1,
  defaultHarthmereBusinessCustomerStatsV1,
  getHarthmereBusinessBikkieGraphicForServiceCueV1,
  getHarthmereBusinessBikkieGraphicsV1,
  getHarthmereBusinessServiceAnimationCueSpecV1,
  validateHarthmereGroveBusinessCoordinateReferenceRolesV1,
  validateHarthmereBusinessBikkieGraphicsV1,
  validateHarthmereBusinessOutpostLiveWorldNavigationV1,
  validateHarthmereBusinessOutpostPassabilityV1,
  validateHarthmereBusinessServiceItemReferencesV1,
} from "../business_customer_simulator_v1";
import { GROVE_ECONOMY_STARTER_NPCS_V1 } from "../grove_economy_starter_v1";
import { HARTHMERE_ECONOMY_BUSINESS_TYPES_V1 } from "../mmo_economy_authority_v1";

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
        assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 36, `${HARTHMERE_BUSINESS_OUTPOSTS_V1[i].outpostId} is too close to ${HARTHMERE_BUSINESS_OUTPOSTS_V1[j].outpostId}`);
      }
    }
  });

  it("materializes every outpost as a server-owned procedural voxel building with passable customer paths", () => {
    assert.equal(Object.keys(HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1).length, HARTHMERE_BUSINESS_OUTPOSTS_V1.length);
    for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS_V1) {
      const record = HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1[outpost.outpostId];
      assert.ok(record, `${outpost.outpostId} needs a procedural building record`);
      assert.equal(record.serverOwned, true);
      assert.equal(record.sourceOfTruth, "backend_procedural_voxel_building");
      assert.equal(record.generationMode, "building_system_materialization_plan");
      assert.equal(record.materializationPlan.materializesSolidVoxelBuilding, true);
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
        businessSpecificFixtures.every((fixture) => fixture.label !== "Service worktable" || !/restaurant|medical|weapons|refinery|portal|farming|courier|hospitality|security|waste|repair|design|property/.test(outpost.businessType)),
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
});
