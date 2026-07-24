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
import { emptyCutsceneUiState } from "@/client/game/resources/cutscene";
import {
  AudioScript,
  COMBAT_MUSIC_DAMAGE_GRACE_SECONDS,
  healthIndicatesRecentCombatDamage,
  selectBackgroundMusicTrack,
} from "@/client/game/scripts/audio";
import type { BiomesId } from "@/shared/ids";
import assert from "assert";
import fs from "fs";
import path from "path";

const PLAYER_ID = 101 as BiomesId;
const OTHER_PLAYER_ID = 202 as BiomesId;
let nextNpcId = 1000;

type TestHealth = {
  hp: number;
  maxHp: number;
  lastDamageSource:
    | { kind: "attack"; attacker: BiomesId; dir: undefined }
    | { kind: "fall"; distance: number }
    | undefined;
  lastDamageTime: number | undefined;
  lastDamageInventoryConsequence: undefined;
  lastDamageAmount: number | undefined;
};

function health(hp: number, overrides: Partial<TestHealth> = {}): TestHealth {
  return {
    hp,
    maxHp: 100,
    lastDamageSource: undefined,
    lastDamageTime: undefined,
    lastDamageInventoryConsequence: undefined,
    lastDamageAmount: undefined,
    ...overrides,
  };
}

function npc(target: BiomesId | undefined, hp = 100) {
  return {
    id: nextNpcId++ as BiomesId,
    position: { v: [0, 0, 0] },
    size: { v: [1, 1, 1] },
    npc_metadata: { type_id: 1 },
    health: health(hp),
    npc_combat_state:
      target === undefined ? undefined : { attack_target: target },
  };
}

function audioHarness() {
  type TestAudioSource = {
    position: { v: [number, number, number] };
    video_component: { video_url: string; muted: boolean };
  };

  let muckyness = 0;
  let inWater = false;
  let nowSeconds = 100;
  let playerHealth = health(100);
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
      if (path === "/clock") {
        return { time: nowSeconds };
      }
      if (path === "/camera/environment") {
        return { inWater, muckyness: { get: () => muckyness } };
      }
      if (path === "/scene/cutscene") {
        return emptyCutsceneUiState();
      }
      throw new Error(`Unexpected resource ${path}`);
    },
  };
  const table = {
    get(id: BiomesId) {
      return id === PLAYER_ID
        ? { id: PLAYER_ID, health: playerHealth }
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
      playerHealth = { ...playerHealth, hp: value };
    },
    setPlayerHealth(value: ReturnType<typeof health>) {
      playerHealth = value;
    },
    setNowSeconds(value: number) {
      nowSeconds = value;
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

  it("recognizes only recent attack damage as a combat signal", () => {
    const recentAttack = health(92, {
      lastDamageSource: {
        kind: "attack",
        attacker: OTHER_PLAYER_ID,
        dir: undefined,
      },
      lastDamageTime: 100,
      lastDamageAmount: -8,
    });

    assert.equal(healthIndicatesRecentCombatDamage(recentAttack, 101), true);
    assert.equal(
      healthIndicatesRecentCombatDamage(
        recentAttack,
        100 + COMBAT_MUSIC_DAMAGE_GRACE_SECONDS + 0.01
      ),
      false
    );
    assert.equal(
      healthIndicatesRecentCombatDamage(
        {
          ...recentAttack,
          lastDamageSource: { kind: "fall", distance: 6 },
        },
        101
      ),
      false
    );
    assert.equal(
      healthIndicatesRecentCombatDamage(
        { ...recentAttack, lastDamageAmount: 8 },
        101
      ),
      false
    );
    assert.equal(
      healthIndicatesRecentCombatDamage({ ...recentAttack, hp: 0 }, 101),
      false
    );
  });

  it("REGRESSION: uses native player damage when chase state is unavailable", () => {
    const harness = audioHarness();
    harness.setPlayerHealth(
      health(92, {
        lastDamageSource: {
          kind: "attack",
          attacker: OTHER_PLAYER_ID,
          dir: undefined,
        },
        lastDamageTime: 100,
        lastDamageAmount: -8,
      })
    );

    harness.setNowSeconds(101);
    harness.script.tick(0);
    harness.setNowSeconds(100 + COMBAT_MUSIC_DAMAGE_GRACE_SECONDS + 0.01);
    harness.script.tick(0);

    assert.deepEqual(harness.tracks, ["battle_music", "music"]);
  });

  it("starts when the player hits a native NPC before chase state synchronizes", () => {
    const harness = audioHarness();
    const recentlyHitNpc = npc(undefined);
    recentlyHitNpc.health = health(75, {
      lastDamageSource: {
        kind: "attack",
        attacker: PLAYER_ID,
        dir: undefined,
      },
      lastDamageTime: 100,
      lastDamageAmount: -25,
    });
    harness.setNpcs([recentlyHitNpc]);
    harness.setNowSeconds(101);

    harness.script.tick(0);

    assert.equal(harness.tracks.at(-1), "battle_music");
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

  it("REGRESSION: stays active beyond damage grace while ECS says the chase continues", () => {
    const harness = audioHarness();
    harness.setNpcs([npc(PLAYER_ID)]);
    harness.setNowSeconds(100 + COMBAT_MUSIC_DAMAGE_GRACE_SECONDS + 30);

    harness.script.tick(0);
    harness.setNowSeconds(100 + COMBAT_MUSIC_DAMAGE_GRACE_SECONDS + 60);
    harness.script.tick(0);
    harness.setNpcs([npc(undefined)]);
    harness.script.tick(0);

    assert.deepEqual(harness.tracks, ["battle_music", "battle_music", "music"]);
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

  it("restores ambient music when the public chase state is absent", () => {
    const harness = audioHarness();
    harness.setMuckyness(1);
    harness.setNpcs([npc(undefined)]);

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
