/// <reference types="mocha" />

import assert from "assert";
import {
  HARTHMERE_BUSINESS_CUSTOMER_NPCS,
  HARTHMERE_BUSINESS_SERVICE_ANIMATION_CUE_SPECS,
} from "../business_customer_simulator";
import {
  buildHarthmereBusinessCustomerProceduralRig,
  createHarthmereBusinessServiceProceduralClip,
  renderHarthmereBusinessProceduralAnimationRuntimeAuditHtml,
  renderHarthmereBusinessProceduralAnimationVisualAuditHtml,
  renderHarthmereBusinessServiceFrameSvg,
  validateHarthmereBusinessProceduralAnimationRuntimeAudit,
  validateHarthmereBusinessProceduralAnimationVisualAudit,
} from "../business_service_procedural_animations";

const HEX = /^#[0-9a-f]{6}$/i;

describe("business_service_procedural_animations", () => {
  it("builds a unique voxel-style rig and color palette for every customer-only NPC design", () => {
    const signatures = new Set<string>();
    for (const npc of HARTHMERE_BUSINESS_CUSTOMER_NPCS) {
      const rig = buildHarthmereBusinessCustomerProceduralRig(npc);
      assert.equal(rig.npcId, npc.npcId);
      assert.equal(rig.displayName, npc.displayName);
      assert.equal(rig.rendererFamily, "grove_townsperson_procedural");
      for (const slot of ["head", "torso", "legs", "feet", "belt"] as const) {
        assert.ok(
          rig.characterAppearance.clothing[slot],
          `${npc.npcId} missing ${slot} clothing`
        );
      }
      assert.ok(rig.characterAppearance.face.hairStyle.length > 0);
      assert.ok(rig.characterAppearance.body.bodyType.length > 0);
      assert.ok(rig.bodyScale.width >= 0.8 && rig.bodyScale.width <= 1.2);
      assert.ok(rig.bodyScale.height >= 0.8 && rig.bodyScale.height <= 1.2);
      for (const color of Object.values(rig.palette)) assert.match(color, HEX);
      for (const field of [
        "hairStyle",
        "hairColor",
        "bodyBuild",
        "heightBand",
        "shoulderShape",
        "posture",
        "gait",
        "eyeColor",
        "eyeShape",
        "browShape",
        "noseShape",
        "noseBridge",
        "skinTone",
        "outfit",
        "accessory",
        "voice",
      ] as const) {
        assert.ok(
          rig.coverageTags.some((tag) => tag.startsWith(`${field}:`)),
          `${npc.npcId} missing ${field} coverage`
        );
      }
      signatures.add(
        [
          rig.palette.skin,
          rig.palette.hair,
          rig.palette.eyes,
          rig.palette.outfit,
          rig.palette.accessory,
          rig.bodyScale.width.toFixed(2),
          rig.bodyScale.height.toFixed(2),
        ].join("|")
      );
    }
    assert.equal(signatures.size, HARTHMERE_BUSINESS_CUSTOMER_NPCS.length);
  });

  it("generates procedural service clips for every service cue without skeletons, root motion, or unsafe transforms", () => {
    const cueIds = Object.keys(HARTHMERE_BUSINESS_SERVICE_ANIMATION_CUE_SPECS);
    assert.ok(cueIds.length > 50);
    for (const cueId of cueIds) {
      const clip = createHarthmereBusinessServiceProceduralClip({
        cueId,
        customerNpc: HARTHMERE_BUSINESS_CUSTOMER_NPCS[0],
        sampleCount: 5,
      });
      const spec = HARTHMERE_BUSINESS_SERVICE_ANIMATION_CUE_SPECS[cueId];
      assert.equal(clip.cueId, cueId);
      assert.equal(clip.family, spec.family);
      assert.equal(clip.durationMs, spec.durationMs);
      assert.equal(clip.frames.length, 5);
      assert.equal(clip.frames[0].timeMs, 0);
      assert.equal(clip.frames[clip.frames.length - 1].timeMs, spec.durationMs);
      assert.equal(clip.safety.procedural, true);
      assert.equal(clip.safety.voxelSafe, true);
      assert.equal(clip.safety.noRootMotion, true);
      assert.equal(clip.safety.noSkeletonRequirement, true);
      assert.equal(clip.safety.rotationOnlyPose, true);
      assert.equal(clip.safety.rootMotionMeters, 0);
      assert.ok(clip.safety.maxFootDriftMeters <= 0.02);
      assert.ok(clip.safety.maxPartRotationDeg <= 150);
      assert.deepEqual(clip.warnings, []);
      for (const frame of clip.frames) {
        assert.ok(frame.normalizedTime >= 0 && frame.normalizedTime <= 1);
        assert.equal(frame.prop.visible, true);
        assert.match(frame.prop.color, HEX);
        assert.equal(frame.prop.source, "bikkie");
        assert.ok(
          frame.prop.bikkieId,
          `${cueId} should carry a Bikkie prop id`
        );
        assert.ok(
          frame.prop.graphicId?.includes(":"),
          `${cueId} should carry a business graphic id`
        );
        assert.ok(
          frame.prop.visual,
          `${cueId} should carry a resolved Bikkie visual`
        );
        assert.match(frame.prop.visual.primaryHex, HEX);
        assert.notEqual(frame.prop.visual.source, "metadata");
        for (const pose of [
          ...Object.values(frame.owner),
          ...Object.values(frame.customer),
        ]) {
          assert.ok(Number.isFinite(pose.rotationDeg));
          assert.ok(pose.scaleX > 0 && pose.scaleY > 0);
        }
      }
    }
  });

  it("covers the full customer by cue matrix for base cases and edge-safe finite output", function () {
    this.timeout(10000);
    const cueIds = Object.keys(HARTHMERE_BUSINESS_SERVICE_ANIMATION_CUE_SPECS);
    let combinations = 0;
    for (const npc of HARTHMERE_BUSINESS_CUSTOMER_NPCS) {
      for (const cueId of cueIds) {
        const clip = createHarthmereBusinessServiceProceduralClip({
          cueId,
          customerNpc: npc,
          sampleCount: 3,
        });
        combinations += 1;
        assert.equal(clip.customerRig.npcId, npc.npcId);
        assert.deepEqual(clip.warnings, []);
        for (const frame of clip.frames) {
          const svg = renderHarthmereBusinessServiceFrameSvg(clip, frame);
          assert.ok(svg.includes(`data-cue-id="${cueId}"`));
          assert.ok(svg.includes(`data-npc-id="${npc.npcId}"`));
          assert.equal(svg.includes("NaN"), false);
          assert.equal(svg.includes("undefined"), false);
        }
      }
    }
    assert.equal(
      combinations,
      HARTHMERE_BUSINESS_CUSTOMER_NPCS.length * cueIds.length
    );
  });

  it("handles missing cues with a visible fallback instead of crashing the service counter", () => {
    const clip = createHarthmereBusinessServiceProceduralClip({
      cueId: "procedural_missing_business_counter_cue",
      customerNpc: HARTHMERE_BUSINESS_CUSTOMER_NPCS[0],
    });
    assert.equal(clip.family, "counter_handoff");
    assert.ok(
      clip.warnings.includes(
        "unknown_cue_fallback:procedural_missing_business_counter_cue"
      )
    );
    assert.equal(clip.safety.noRootMotion, true);
    assert.equal(clip.frames[0].prop.source, "procedural_fallback");
    assert.match(clip.frames[0].prop.visual.primaryHex, HEX);
    const svg = renderHarthmereBusinessServiceFrameSvg(clip, clip.frames[0]);
    assert.ok(svg.includes("procedural_missing_business_counter_cue"));
    assert.ok(
      svg.includes('data-visual-source="galois_icon"') ||
        svg.includes('data-visual-source="procedural_voxel"')
    );
    assert.equal(svg.includes("NaN"), false);
  });

  it("renders Bikkie prop metadata into service-frame SVGs", () => {
    const clip = createHarthmereBusinessServiceProceduralClip({
      cueId: "procedural_plate_slide_counter",
      customerNpc: HARTHMERE_BUSINESS_CUSTOMER_NPCS[0],
      sampleCount: 3,
    });
    const frame = clip.frames[1];
    assert.equal(frame.prop.bikkieName, "Kitchen");
    assert.equal(frame.prop.bikkieKind, "crafting_station");
    assert.deepEqual(frame.prop.boxSize, [1, 1, 4]);
    const svg = renderHarthmereBusinessServiceFrameSvg(clip, frame);
    assert.ok(svg.includes('data-prop-source="bikkie"'));
    assert.ok(svg.includes('data-visual-source="galois_icon"'));
    assert.ok(svg.includes('data-visual-kind="station"'));
    assert.ok(svg.includes(`data-bikkie-id="${frame.prop.bikkieId}"`));
    assert.ok(
      svg.includes(
        'data-galois-path="placeables/crafting_stations/oak_kitchen"'
      )
    );
    assert.ok(
      svg.includes(
        'data-icon-asset-path="icons/placeables/crafting_stations/oak_kitchen"'
      )
    );
  });

  it("renders a production visual audit page covering every customer design and every service cue", () => {
    const html = renderHarthmereBusinessProceduralAnimationVisualAuditHtml();
    assert.ok(
      html.includes("Business Service Procedural Animation Visual Audit")
    );
    assert.ok(
      html.includes(
        `data-customer-count="${HARTHMERE_BUSINESS_CUSTOMER_NPCS.length}"`
      )
    );
    assert.ok(
      html.includes(
        `data-cue-count="${
          Object.keys(HARTHMERE_BUSINESS_SERVICE_ANIMATION_CUE_SPECS).length
        }"`
      )
    );
    assert.equal(html.includes("NaN"), false);
    assert.equal(html.includes("undefined"), false);
  });

  it("passes the full procedural visual audit validator", function () {
    // The complete 65-customer SVG matrix can cross Mocha's default timeout
    // when the full server-bootstrap suite is sharing one process.
    this.timeout(20_000);
    const audit = validateHarthmereBusinessProceduralAnimationVisualAudit();
    assert.equal(audit.ok, true, audit.warnings.slice(0, 10).join(", "));
    assert.equal(audit.customerCount, 65);
    assert.equal(audit.renderedCustomerCells, 65);
    assert.equal(
      audit.cueCount,
      Object.keys(HARTHMERE_BUSINESS_SERVICE_ANIMATION_CUE_SPECS).length
    );
    assert.equal(audit.renderedCueCells, audit.cueCount);
  });

  it("renders a live runtime audit page with moving coverage for every cue and customer design", () => {
    const audit = validateHarthmereBusinessProceduralAnimationRuntimeAudit();
    assert.equal(audit.ok, true, audit.warnings.slice(0, 10).join(", "));
    assert.equal(
      audit.customerCoverageCount,
      HARTHMERE_BUSINESS_CUSTOMER_NPCS.length
    );
    assert.equal(
      audit.cueCoverageCount,
      Object.keys(HARTHMERE_BUSINESS_SERVICE_ANIMATION_CUE_SPECS).length
    );
    assert.equal(audit.movingComboCount, audit.comboCount);

    const html = renderHarthmereBusinessProceduralAnimationRuntimeAuditHtml();
    assert.ok(html.includes("Business Service Animation Runtime Audit"));
    assert.ok(html.includes("requestAnimationFrame"));
    assert.ok(html.includes("__harthmereBusinessAnimationRuntimeAudit"));
    assert.ok(
      html.includes(
        `data-customer-count="${HARTHMERE_BUSINESS_CUSTOMER_NPCS.length}"`
      )
    );
    assert.ok(
      html.includes(
        `data-cue-count="${
          Object.keys(HARTHMERE_BUSINESS_SERVICE_ANIMATION_CUE_SPECS).length
        }"`
      )
    );
    assert.equal(html.includes("NaN"), false);
    assert.equal(html.includes("undefined"), false);
  });
});
