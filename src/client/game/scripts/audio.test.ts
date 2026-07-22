import {
  COMBAT_MUSIC_CROSSFADE_SECONDS,
  DEFAULT_BACKGROUND_MUSIC_CROSSFADE_SECONDS,
  backgroundMusicCrossfadeSeconds,
  type AudioManager,
  type AudioTrackType,
} from "@/client/game/context_managers/audio_manager";
import type { ClientTable } from "@/client/game/game";
import {
  HARTHMERE_BATTLE_MUSIC_PATH,
  resolveAudioUrl,
} from "@/client/game/resources/audio";
import type { ClientResources } from "@/client/game/resources/types";
import {
  AudioScript,
  combatTargetFromNpcStateData,
  selectBackgroundMusicTrack,
} from "@/client/game/scripts/audio";
import type { BiomesId } from "@/shared/ids";
import { serializeNpcCustomState } from "@/shared/npc/serde";
import assert from "assert";
import fs from "fs";
import path from "path";

const PLAYER_ID = 101 as BiomesId;
const OTHER_PLAYER_ID = 202 as BiomesId;
let nextNpcId = 1000;

function health(hp: number) {
  return {
    hp,
    maxHp: 100,
    lastDamageSource: undefined,
    lastDamageTime: undefined,
    lastDamageInventoryConsequence: undefined,
    lastDamageAmount: undefined,
  };
}

function npc(target: BiomesId | undefined, hp = 100, data?: Uint8Array) {
  return {
    id: nextNpcId++ as BiomesId,
    position: { v: [0, 0, 0] },
    size: { v: [1, 1, 1] },
    npc_metadata: { type_id: 1 },
    health: health(hp),
    npc_state: {
      data:
        data ??
        serializeNpcCustomState({
          chaseAttack: { attackTarget: target },
        }),
    },
  };
}

function audioHarness() {
  type TestAudioSource = {
    position: { v: [number, number, number] };
    video_component: { video_url: string; muted: boolean };
  };

  let muckyness = 0;
  let inWater = false;
  let playerHp = 100;
  let mediaVolume = 1;
  let npcs: ReturnType<typeof npc>[] = [];
  let audioSources: TestAudioSource[] = [];
  const tracks: AudioTrackType[] = [];
  const attenuations: number[] = [];
  const effects: string[] = [];

  const resources = {
    get(path: string) {
      if (path === "/scene/camera") {
        return { pos: () => [0, 0, 0] as [number, number, number] };
      }
      if (path === "/ecs/c/position") {
        return { v: [0, 0, 0] as [number, number, number] };
      }
      if (path === "/camera/environment") {
        return { inWater, muckyness: { get: () => muckyness } };
      }
      throw new Error(`Unexpected resource ${path}`);
    },
  };
  const table = {
    get(id: BiomesId) {
      return id === PLAYER_ID
        ? { id: PLAYER_ID, health: health(playerHp) }
        : undefined;
    },
    scan(query: unknown) {
      const index = (query as { index?: string }).index;
      if (index === "audio_source_selector") {
        return audioSources;
      }
      if (index === "npc_metadata_selector") {
        return npcs;
      }
      throw new Error(`Unexpected table query ${String(index)}`);
    },
  };
  const audioManager = {
    getVolume() {
      return mediaVolume;
    },
    setBackgroundMusicTrack(track: AudioTrackType) {
      tracks.push(track);
    },
    setBackgroundMusicAttenuation(value: number) {
      attenuations.push(value);
    },
    setBackgroundMusicEffect(effect: string) {
      effects.push(effect);
    },
  };
  const script = new AudioScript(
    PLAYER_ID,
    resources as unknown as ClientResources,
    table as unknown as ClientTable,
    audioManager as unknown as AudioManager
  );

  return {
    script,
    tracks,
    attenuations,
    effects,
    setMuckyness(value: number) {
      muckyness = value;
    },
    setInWater(value: boolean) {
      inWater = value;
    },
    setPlayerHp(value: number) {
      playerHp = value;
    },
    setMediaVolume(value: number) {
      mediaVolume = value;
    },
    setNpcs(value: ReturnType<typeof npc>[]) {
      npcs = value;
    },
    setAudioSources(value: TestAudioSource[]) {
      audioSources = value;
    },
  };
}

describe("combat background music", () => {
  it("registers a packaged, directly served battle track", () => {
    assert.equal(
      resolveAudioUrl(HARTHMERE_BATTLE_MUSIC_PATH),
      HARTHMERE_BATTLE_MUSIC_PATH
    );
    assert.equal(
      fs.existsSync(
        path.join(
          process.cwd(),
          "public",
          HARTHMERE_BATTLE_MUSIC_PATH.replace(/^\//, "")
        )
      ),
      true
    );
  });

  it("gives combat priority over both ambient music variants", () => {
    assert.equal(selectBackgroundMusicTrack(0, false), "music");
    assert.equal(selectBackgroundMusicTrack(1, false), "muck_music");
    assert.equal(selectBackgroundMusicTrack(0, true), "battle_music");
    assert.equal(selectBackgroundMusicTrack(1, true), "battle_music");
  });

  it("uses a responsive fade entering and leaving combat", () => {
    assert.equal(
      backgroundMusicCrossfadeSeconds("music", "muck_music"),
      DEFAULT_BACKGROUND_MUSIC_CROSSFADE_SECONDS
    );
    assert.equal(
      backgroundMusicCrossfadeSeconds("music", "battle_music"),
      COMBAT_MUSIC_CROSSFADE_SECONDS
    );
    assert.equal(
      backgroundMusicCrossfadeSeconds("battle_music", "muck_music"),
      COMBAT_MUSIC_CROSSFADE_SECONDS
    );
  });

  it("reads chase targets and safely ignores malformed NPC state", () => {
    const data = serializeNpcCustomState({
      chaseAttack: { attackTarget: PLAYER_ID },
    });
    assert.equal(combatTargetFromNpcStateData(data), PLAYER_ID);
    assert.equal(
      combatTargetFromNpcStateData(new Uint8Array([0xff, 0x00, 0x01])),
      undefined
    );
  });

  it("starts for a pursuer and restores the underlying ambient track", () => {
    const harness = audioHarness();

    harness.script.tick(0);
    harness.setNpcs([npc(PLAYER_ID)]);
    harness.script.tick(0);
    harness.setNpcs([]);
    harness.script.tick(0);

    assert.deepEqual(harness.tracks, ["music", "battle_music", "music"]);
  });

  it("stays active until the final pursuer disengages", () => {
    const harness = audioHarness();
    const first = npc(PLAYER_ID);
    const second = npc(PLAYER_ID);

    harness.setNpcs([first, second]);
    harness.script.tick(0);
    harness.setNpcs([npc(undefined), second]);
    harness.script.tick(0);
    harness.setMuckyness(1);
    harness.setNpcs([npc(undefined), npc(OTHER_PLAYER_ID)]);
    harness.script.tick(0);

    assert.deepEqual(harness.tracks, [
      "battle_music",
      "battle_music",
      "muck_music",
    ]);
  });

  it("ignores dead pursuers, stale other-player targets, and combat after player death", () => {
    const harness = audioHarness();

    harness.setNpcs([npc(PLAYER_ID, 0), npc(OTHER_PLAYER_ID)]);
    harness.script.tick(0);
    harness.setNpcs([npc(PLAYER_ID)]);
    harness.setPlayerHp(0);
    harness.script.tick(0);

    assert.deepEqual(harness.tracks, ["music", "music"]);
  });

  it("does not let malformed state break restoration", () => {
    const harness = audioHarness();
    harness.setMuckyness(1);
    harness.setNpcs([npc(undefined, 100, new Uint8Array([0xff, 0x00, 0x01]))]);

    assert.doesNotThrow(() => harness.script.tick(0));
    assert.deepEqual(harness.tracks, ["muck_music"]);
  });

  it("keeps attenuation finite when media volume is muted", () => {
    const harness = audioHarness();
    harness.setMediaVolume(0);
    harness.setAudioSources([
      {
        position: { v: [0, 0, 0] },
        video_component: { video_url: "https://example.invalid", muted: false },
      },
    ]);

    harness.script.tick(0);

    assert.equal(harness.attenuations.at(-1), 0);
    assert.equal(Number.isFinite(harness.attenuations.at(-1)), true);
  });

  it("preserves the underwater filter while combat music is selected", () => {
    const harness = audioHarness();
    harness.setInWater(true);
    harness.setNpcs([npc(PLAYER_ID)]);

    harness.script.tick(0);

    assert.equal(harness.tracks.at(-1), "battle_music");
    assert.equal(harness.effects.at(-1), "water");
  });
});
