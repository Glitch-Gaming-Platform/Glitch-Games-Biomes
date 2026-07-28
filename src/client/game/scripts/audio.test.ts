import {
  COMBAT_MUSIC_CROSSFADE_SECONDS,
  DEFAULT_BACKGROUND_MUSIC_CROSSFADE_SECONDS,
  backgroundMusicCrossfadeSeconds,
  type AudioManager,
  type AudioTrackType,
} from "@/client/game/context_managers/audio_manager";
import type { ClientTable } from "@/client/game/game";
import {
  CH1_SAND_DUNGEON_MUSIC_PATH,
  CH1_WINTER_DUNGEON_MUSIC_PATH,
  HARTHMERE_BATTLE_MUSIC_PATH,
  HARTHMERE_BOSS_BATTLE_MUSIC_PATH,
  HARTHMERE_EXPLORATION_MUSIC_PATH,
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
import { ch1ElsewhenSlot } from "@/shared/harthmere/ch1_elsewhen_region";
import {
  HARTHMERE_BOSS_MUSIC_ENTITY_IDS,
  isHarthmereBossMusicName,
} from "@/shared/harthmere/boss_music";
import { HARTHMERE_EXTENSION_WORLD_BOUNDS } from "@/shared/harthmere/world_extension";
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

function npc(
  target: BiomesId | undefined,
  hp = 100,
  options: { id?: BiomesId; label?: string } = {}
) {
  return {
    id: options.id ?? (nextNpcId++ as BiomesId),
    position: { v: [0, 0, 0] },
    size: { v: [1, 1, 1] },
    npc_metadata: { type_id: 1 },
    label: options.label ? { text: options.label } : undefined,
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
  let playerPos: [number, number, number] = [0, 0, 0];
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
        return { v: playerPos };
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
      if (id === PLAYER_ID) {
        return { id: PLAYER_ID, health: playerHealth };
      }
      return npcs.find((candidate) => candidate.id === id);
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
    setPlayerPos(value: [number, number, number]) {
      playerPos = value;
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
  it("registers packaged, directly served Harthmere music tracks", () => {
    for (const musicPath of [
      HARTHMERE_BATTLE_MUSIC_PATH,
      HARTHMERE_BOSS_BATTLE_MUSIC_PATH,
      HARTHMERE_EXPLORATION_MUSIC_PATH,
      CH1_SAND_DUNGEON_MUSIC_PATH,
      CH1_WINTER_DUNGEON_MUSIC_PATH,
    ]) {
      assert.equal(resolveAudioUrl(musicPath), musicPath);
      assert.equal(
        fs.existsSync(
          path.join(process.cwd(), "public", musicPath.replace(/^\//, ""))
        ),
        true
      );
    }
  });

  it("gives combat and Muck priority over regional exploration music", () => {
    const harthmere: [number, number, number] = [
      HARTHMERE_EXTENSION_WORLD_BOUNDS.minX,
      53,
      -209,
    ];
    const sand = ch1ElsewhenSlot("ch1_dungeon_desert")!.arrival;

    assert.equal(selectBackgroundMusicTrack(0, false), "music");
    assert.equal(selectBackgroundMusicTrack(1, false), "muck_music");
    assert.equal(selectBackgroundMusicTrack(0, true), "battle_music");
    assert.equal(selectBackgroundMusicTrack(1, true), "battle_music");
    assert.equal(
      selectBackgroundMusicTrack(1, true, harthmere, true),
      "boss_battle_music"
    );
    assert.equal(
      selectBackgroundMusicTrack(0, false, harthmere),
      "harthmere_music"
    );
    assert.equal(selectBackgroundMusicTrack(1, false, harthmere), "muck_music");
    assert.equal(selectBackgroundMusicTrack(0, true, sand), "battle_music");
  });

  it("selects the additive Harthmere woods and each Elsewhen dungeon cue", () => {
    const sand = ch1ElsewhenSlot("ch1_dungeon_desert")!;
    const winter = ch1ElsewhenSlot("ch1_dungeon_winter")!;

    assert.equal(
      selectBackgroundMusicTrack(0, false, [
        HARTHMERE_EXTENSION_WORLD_BOUNDS.minX,
        53,
        HARTHMERE_EXTENSION_WORLD_BOUNDS.minZ,
      ]),
      "harthmere_music"
    );
    assert.equal(
      selectBackgroundMusicTrack(0, false, [
        HARTHMERE_EXTENSION_WORLD_BOUNDS.maxX - 1,
        53,
        HARTHMERE_EXTENSION_WORLD_BOUNDS.maxZ - 1,
      ]),
      "harthmere_music"
    );
    assert.equal(
      selectBackgroundMusicTrack(0, false, sand.arrival),
      "ch1_sand_music"
    );
    assert.equal(
      selectBackgroundMusicTrack(0, false, winter.arrival),
      "ch1_winter_music"
    );
    assert.equal(
      selectBackgroundMusicTrack(0, false, [
        HARTHMERE_EXTENSION_WORLD_BOUNDS.maxX,
        53,
        0,
      ]),
      "music"
    );
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
    assert.equal(
      backgroundMusicCrossfadeSeconds("harthmere_music", "battle_music"),
      COMBAT_MUSIC_CROSSFADE_SECONDS
    );
    assert.equal(
      backgroundMusicCrossfadeSeconds("battle_music", "boss_battle_music"),
      COMBAT_MUSIC_CROSSFADE_SECONDS
    );
    assert.equal(
      backgroundMusicCrossfadeSeconds("boss_battle_music", "ch1_sand_music"),
      COMBAT_MUSIC_CROSSFADE_SECONDS
    );
    assert.equal(
      backgroundMusicCrossfadeSeconds("ch1_sand_music", "music"),
      DEFAULT_BACKGROUND_MUSIC_CROSSFADE_SECONDS
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

  it("recognizes every named boss encounter without matching ordinary enemies", () => {
    for (const name of [
      "Muck-Scarred Helix",
      "The Gilded Bull",
      "The Ninth Winter",
      "The Failed Apprentice",
      "The First Choir",
      "First Choir Crone",
      "The Echo-Singer",
      "Vyrahel, the Vein-Keeper",
      "Thaedryn the Bellbound",
      "Hex Wraith",
      "Alpha Mucker",
      "The Root-Crowned Dead",
    ]) {
      assert.equal(isHarthmereBossMusicName(name), true, name);
    }
    assert.equal(isHarthmereBossMusicName("Old Wood Mucker"), false);
    assert.equal(isHarthmereBossMusicName("Cistern Hexer"), false);
  });

  it("uses the boss loop during a named boss fight and restores the dungeon cue", () => {
    const harness = audioHarness();
    harness.setPlayerPos(ch1ElsewhenSlot("ch1_dungeon_winter")!.arrival);

    harness.script.tick(0);
    harness.setNpcs([npc(PLAYER_ID, 100, { label: "The Failed Apprentice" })]);
    harness.script.tick(0);
    harness.setNpcs([]);
    harness.script.tick(0);

    assert.deepEqual(harness.tracks, [
      "ch1_winter_music",
      "boss_battle_music",
      "ch1_winter_music",
    ]);
  });

  it("uses fixed actor identities for bosses whose visible NPC names are generic", () => {
    for (const id of [
      HARTHMERE_BOSS_MUSIC_ENTITY_IDS.gildedBull,
      HARTHMERE_BOSS_MUSIC_ENTITY_IDS.ninthWinter,
      HARTHMERE_BOSS_MUSIC_ENTITY_IDS.muckScarredHelix,
      HARTHMERE_BOSS_MUSIC_ENTITY_IDS.thaedrynTheBellbound,
      HARTHMERE_BOSS_MUSIC_ENTITY_IDS.hexWraith,
      HARTHMERE_BOSS_MUSIC_ENTITY_IDS.alphaMucker,
    ]) {
      const harness = audioHarness();
      harness.setNpcs([npc(PLAYER_ID, 100, { id })]);
      harness.script.tick(0);
      assert.equal(harness.tracks.at(-1), "boss_battle_music");
    }
  });

  it("starts boss music from recent boss damage before chase state synchronizes", () => {
    const harness = audioHarness();
    const bossId = HARTHMERE_BOSS_MUSIC_ENTITY_IDS.gildedBull;
    harness.setNpcs([npc(undefined, 100, { id: bossId })]);
    harness.setPlayerHealth(
      health(80, {
        lastDamageSource: {
          kind: "attack",
          attacker: bossId,
          dir: undefined,
        },
        lastDamageTime: 100,
        lastDamageAmount: -20,
      })
    );
    harness.setNowSeconds(101);

    harness.script.tick(0);

    assert.equal(harness.tracks.at(-1), "boss_battle_music");
  });

  it("restores Harthmere exploration music after combat ends", () => {
    const harness = audioHarness();
    harness.setPlayerPos([
      HARTHMERE_EXTENSION_WORLD_BOUNDS.minX + 200,
      53,
      -300,
    ]);

    harness.script.tick(0);
    harness.setNpcs([npc(PLAYER_ID)]);
    harness.script.tick(0);
    harness.setNpcs([]);
    harness.script.tick(0);

    assert.deepEqual(harness.tracks, [
      "harthmere_music",
      "battle_music",
      "harthmere_music",
    ]);
  });

  it("lets Muck temporarily replace Harthmere exploration music", () => {
    const harness = audioHarness();
    harness.setPlayerPos([
      HARTHMERE_EXTENSION_WORLD_BOUNDS.minX + 200,
      53,
      -300,
    ]);

    harness.script.tick(0);
    harness.setMuckyness(1);
    harness.script.tick(0);
    harness.setMuckyness(0);
    harness.script.tick(0);

    assert.deepEqual(harness.tracks, [
      "harthmere_music",
      "muck_music",
      "harthmere_music",
    ]);
  });

  it("restores the correct dungeon cue after combat and normal music on exit", () => {
    const harness = audioHarness();
    harness.setPlayerPos(ch1ElsewhenSlot("ch1_dungeon_winter")!.arrival);

    harness.script.tick(0);
    harness.setNpcs([npc(PLAYER_ID)]);
    harness.script.tick(0);
    harness.setNpcs([]);
    harness.script.tick(0);
    harness.setPlayerPos([0, 0, 0]);
    harness.script.tick(0);

    assert.deepEqual(harness.tracks, [
      "ch1_winter_music",
      "battle_music",
      "ch1_winter_music",
      "music",
    ]);
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
