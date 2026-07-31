// Source-level contract tests (same pattern as
// playerHarthmereHiddenContainerCollision.test.ts): the cutscene system only
// works if its client wiring stays intact, so lock the critical lines.

import assert from "assert";
import fs from "fs";
import path from "path";

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("cutscene client integration contract", () => {
  it("director script ticks BEFORE CameraScript in the render script list", () => {
    const source = read("src/client/game/scripts/init_renderer.ts");
    const directorIdx = source.indexOf("new CutsceneDirectorScript(");
    const cameraIdx = source.indexOf("new CameraScript(");
    assert.ok(directorIdx >= 0, "CutsceneDirectorScript must be registered");
    assert.ok(cameraIdx >= 0);
    assert.ok(
      directorIdx < cameraIdx,
      "CutsceneDirectorScript must be registered before CameraScript so " +
        "camera poses land in the same frame"
    );
  });

  it("player motion is locked while a cutscene holds input", () => {
    const source = read("src/client/game/scripts/player.ts");
    const director = read("src/client/game/scripts/cutscene_director.ts");
    assert.match(source, /motionLocked\(\)\s*{[\s\S]*?\/scene\/cutscene/);
    assert.match(source, /cutscene\.active && cutscene\.lockInput/);
    assert.match(director, /if \(this\.activeDef\?\.settings\.lockPlayer\)/);
  });

  it("player damage is gated by cutscene invulnerability (healing exempt)", () => {
    const source = read("src/client/game/scripts/player.ts");
    assert.match(
      source,
      /applyHpChange[\s\S]{0,400}hpDelta < 0[\s\S]{0,200}cutscene\.active && cutscene\.invulnerable/
    );
  });

  it("audio script honors the cutscene music override", () => {
    const source = read("src/client/game/scripts/audio.ts");
    assert.match(source, /cutscene\.active && cutscene\.musicOverride/);
    assert.match(source, /setBackgroundMusicTrack\(\s*cutscene\.active/);
  });

  it("live-creature bridge merges puppet overrides and fast-publishes during scenes", () => {
    const source = read(
      "src/client/game/scripts/harthmere_live_creature_bridge_script.ts"
    );
    assert.match(source, /readRenderablePuppetOverrides\(\)/);
    assert.match(source, /mergeCutscenePuppetOverrides\(/);
    assert.match(source, /cutsceneOverrides\.length === 0/);
  });

  it("routes player-like cinematic NPCs through the native avatar renderer", () => {
    const bridge = read("src/shared/harthmere/live_creature_ecs_bridge.ts");
    const assets = read(
      "src/client/game/renderers/local_dev/harthmere_assets.ts"
    );
    const npcs = read("src/client/game/resources/npcs.ts");
    const npcRenderer = read("src/client/game/renderers/npcs.ts");
    const playerMesh = read("src/client/game/resources/player_mesh.ts");
    assert.match(bridge, /nativeNpcRenderer/);
    assert.match(bridge, /nativeNpcRenderer: true/);
    assert.match(assets, /!record\.nativeNpcRenderer/);
    assert.match(assets, /makeSnapshotCutscenePlayerMesh/);
    assert.match(assets, /HARTHMERE_NATIVE_CUTSCENE_ACTOR_REQUIRED/);
    assert.match(assets, /addHarthmereProceduralLifePlacement\(_placement/);
    assert.match(
      assets,
      /rounded-box Three\.js avatar fallback[\s\S]*return false/
    );
    assert.match(npcs, /readRenderablePuppetOverrides\(\)/);
    assert.match(npcs, /cutsceneHeldItemAttachment/);
    assert.match(npcs, /cutsceneNpcAnimationAction/);
    assert.match(npcRenderer, /cutsceneNpcIds/);
    assert.match(
      playerMesh,
      /return equippedAttach \?\? exactArmAttach \?\? fuzzyHandAttach \?\? root/
    );
    assert.match(playerMesh, /snapshot-cutscene-player-mesh-v1/);
    assert.match(playerMesh, /applySnapshotCutscenePlayerAnimation/);
    assert.doesNotMatch(
      npcs,
      /HARTHMERE_NPC_GALOIS_VISIBLE_FALLBACK[\s\S]*makeLocalDevVoxelNpcGltf/
    );
  });

  it("preserves authored cutscene NPC yaw before talk-facing fallback", () => {
    const npcs = read("src/client/game/resources/npcs.ts");
    assert.match(
      npcs,
      /motionOverrides\?\.orientation\s*\?\?\s*\(\s*localPlayer\.talkingToNpc === entity\.id && npcPosition\s*\?/
    );
    assert.doesNotMatch(
      npcs,
      /motionOverrides\?\.orientation\s*\?\?\s*\(localPlayer\.talkingToNpc === entity\.id && npcPosition\)\s*\?/
    );
  });

  it("boots authored Harthmere scenes and supports direct preview URLs", () => {
    const game = read("src/client/components/Game.tsx");
    const library = read("src/client/game/cutscene/harthmere_library.ts");
    const scenes = read("src/shared/cutscene/harthmere_scenes.ts");
    assert.match(game, /useHarthmereCutsceneLibrary/);
    assert.match(library, /cutscenePreview/);
    assert.match(library, /cutsceneVideo/);
    assert.match(library, /biomes-cutscene-preview-output/);
    assert.match(library, /biomes-cutscene-video-output/);
    assert.match(library, /requestCutsceneById/);
    assert.match(library, /requestCutsceneVideoById/);
    assert.match(scenes, /jackieVsMuckersCutscene/);
    assert.match(scenes, /JACKIE_VS_MUCKERS_DURATION_SECONDS = 15/);
  });

  it("renders reusable combat reactions and impact VFX for cinematic actors", () => {
    const director = read("src/client/game/scripts/cutscene_director.ts");
    const assets = read(
      "src/client/game/renderers/local_dev/harthmere_assets.ts"
    );
    const npcs = read("src/client/game/resources/npcs.ts");
    assert.match(director, /combatImpactParticleMaterials/);
    assert.match(director, /effect\.effect === "combatImpact"/);
    assert.match(assets, /case "hitReact"/);
    assert.match(assets, /case "death"/);
    assert.match(npcs, /hitReact: "creatureHit"/);
    assert.match(npcs, /death: "creatureDeath"/);
  });

  it("records the engine canvas and exposes an FFmpeg MP4 workflow", () => {
    const video = read("src/client/game/cutscene/video_capture_service.ts");
    const audio = read("src/client/game/context_managers/audio_manager.ts");
    const director = read("src/client/game/scripts/cutscene_director.ts");
    const encoder = read("scripts/cutscenes/encode-cutscene-mp4.sh");
    assert.match(video, /recordingCanvas\.captureStream/);
    assert.match(video, /copyRenderedGameFrame/);
    assert.match(video, /getActiveRendererController/);
    assert.match(video, /new MediaRecorder/);
    assert.match(video, /requestCutsceneById/);
    assert.match(audio, /createMediaStreamDestination/);
    assert.match(director, /publishCutscenePlayback/);
    assert.match(encoder, /libx264/);
    assert.match(encoder, /ffprobe/);
    assert.match(encoder, /setpts=/);
    assert.match(encoder, /\+faststart/);
  });

  it("cutscene resource is registered and typed", () => {
    const types = read("src/client/game/resources/types.ts");
    assert.match(types, /"\/scene\/cutscene": PathDef<\[\], CutsceneUiState>/);
    const init = read("src/client/game/resources/init.ts");
    assert.match(init, /addCutsceneResources\(loader, builder\)/);
  });

  it("overlay is mounted in BiomesChrome", () => {
    const source = read("src/client/components/BiomesChrome.tsx");
    assert.match(source, /<CutsceneOverlay \/>/);
  });

  it("director writes the waypoint camera override and never bypasses it", () => {
    const source = read("src/client/game/scripts/cutscene_director.ts");
    assert.match(source, /"\/scene\/waypoint_camera\/active"/);
    // Finish path must clear the camera override.
    assert.match(source, /kind: "empty"/);
    // End-state commits are token-guarded only after successful async work.
    assert.match(source, /runCutsceneCommitOnce\(token/);
    // Server placement uses update_spawn: false so Anima keeps its anchors.
    assert.match(source, /update_spawn: false/);
    assert.doesNotMatch(source, /update_spawn: true/);
  });

  it("uses a dedicated cinematic fade instead of clobbering the warp effect", () => {
    const director = read("src/client/game/scripts/cutscene_director.ts");
    const overlay = read("src/client/components/CutsceneOverlay.tsx");
    assert.match(director, /fadeOpacity/);
    assert.doesNotMatch(director, /beginOrUpdateWarpEffect/);
    assert.match(overlay, /data-cutscene-fade/);
    assert.match(director, /effect\.direction === "out" && effect\.blocking/);
  });

  it("consumes advance input only while a player-input shot is ready", () => {
    const director = read("src/client/game/scripts/cutscene_director.ts");
    const overlay = read("src/client/components/CutsceneOverlay.tsx");
    assert.match(director, /until\?\.kind === "playerInput"/);
    assert.match(director, /currentShotElapsed >= shot\.duration/);
    assert.match(overlay, /state\.canAdvance/);
    assert.match(overlay, /state\.canAdvance \|\| state\.lockInput/);
  });

  it("connects deterministic engine capture to the renderer", () => {
    const director = read("src/client/game/scripts/cutscene_director.ts");
    const renderer = read("src/client/game/renderers/renderer_controller.ts");
    const promo = read("src/client/game/cutscene/promo_capture.ts");
    assert.match(director, /case "capture"/);
    assert.match(director, /deltaSeconds: 0/);
    assert.match(renderer, /projectionMatrix\.clone\(\)/);
    assert.match(renderer, /matrixWorldInverse\.clone\(\)/);
    assert.match(promo, /captureAtParam === null/);
    assert.match(promo, /captureAtParam\.trim\(\) === ""/);
  });

  it("waypoint camera override is still the first check in CameraScript.tick", () => {
    const source = read("src/client/game/scripts/camera.ts");
    const tickIdx = source.indexOf("tick(dt: number) {");
    assert.ok(tickIdx >= 0);
    const afterTick = source.slice(tickIdx, tickIdx + 400);
    assert.match(afterTick, /\/scene\/waypoint_camera\/active/);
  });
});
