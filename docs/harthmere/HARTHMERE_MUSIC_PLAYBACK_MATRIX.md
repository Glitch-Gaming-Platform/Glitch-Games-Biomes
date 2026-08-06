# Harthmere music playback matrix

This is the runtime soundtrack inventory after the August 3, 2026 routing fix.
The background selector reevaluates continuously from player state and uses the
highest-priority matching row below.

## Automatic background music

| Priority | Runtime track             | Music file                                                                              | When it plays                                                                                                                                                                                                                                                                                                                  |
| -------: | ------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
|        1 | cutscene override         | The track named by the cutscene                                                         | While a cutscene is active with `musicOverride`. Current authored combat showcases request `battle_music`.                                                                                                                                                                                                                     |
|        2 | `business_minigame_music` | `harthmere-fiddle-race-v3-fast-loop.mp3` — **Harthmere Fiddle Race — Fast Loop** (4:20) | While an active customer-service shift is running and the player remains inside that business's authored interior footprint. It stops immediately when the shift ends or the player exits the building.                                                                                                                        |
|        3 | `boss_battle_music`       | `11-no-crown-above-the-storm-loop.mp3` — **No Crown Above the Storm** (2:52)            | While the player is actively fighting a recognized Harthmere boss.                                                                                                                                                                                                                                                             |
|        4 | `battle_music`            | `hauntsync-rpg-battle-chiptune.webm`                                                    | During ordinary active combat.                                                                                                                                                                                                                                                                                                 |
|        5 | `ch1_sand_music`          | `09-embers-test-the-oath-loop.mp3` — **Embers Test the Oath** (2:52)                    | Inside the Chapter 1 desert Elsewhen dungeon when no combat track owns the mix.                                                                                                                                                                                                                                                |
|        6 | `ch1_winter_music`        | `09-embers-test-the-oath-loop.mp3` — **Embers Test the Oath** (2:52)                    | Inside the Chapter 1 winter Elsewhen dungeon when no combat track owns the mix.                                                                                                                                                                                                                                                |
|        7 | `cave_music`              | `harthmere-environment/cave-music-loop.webm` (4:48)                                     | In an authored Harthmere cave (including its +1600 additive-world position), below Y=25 inside the additive Harthmere extension, below Y=20 elsewhere, or under strongly occluded sky with thick terrain overburden. It remains for a 1.5-second exit grace to avoid boundary flicker. A minigame suppresses this replacement. |
|        8 | `muck_music`              | `muck-music-1.webm` — **Harthmere Overworld Long Loop** (3:48)                          | Whenever camera Muck exposure is greater than zero and no higher-priority condition applies.                                                                                                                                                                                                                                   |
|        9 | `legacy_area_*`           | One of the four `legacy-protected-areas/*-loop.webm` exploration themes                 | While the player is physically inside one of the 19 audited large legacy protection areas. The assignment is stable per place. The Grove is explicitly excluded so it retains its original music. Small 32×32/64×64 claims, player robots, and generic Admin/WIP volumes do not participate.                                   |
|       10 | `grove_music`             | `music-1.webm` — original Kyle Flynn Grove theme                                        | Ordinary exploration throughout The Grove rectangle: `300 <= x <= 650` and `-360 <= z <= -40`, including its legacy protection volumes. Its handoff is exclusive so the world and Grove songs never overlap.                                                                                                                   |
|       11 | `music`                   | `muck-music-1.webm` — **Harthmere Overworld Long Loop** (3:48)                          | Default ordinary-world exploration, including the complete additive Harthmere rectangle, when no higher-priority condition applies.                                                                                                                                                                                            |

The default world and Muck states intentionally use the same authored
overworld master. They remain separate logical track types so diagnostics show
why the selector chose the music. Large legacy protected areas replace only
the ordinary regional exploration bed. The Grove is excluded from that system
and retains its original theme throughout the full Grove region.

## Combat timing and boss recognition

Ordinary combat music starts when any of these is true:

- the living player took attack damage within the last 8 seconds;
- a living NPC within 64 metres currently targets the player; or
- a living NPC within 64 metres took damage from the player within the last 8
  seconds.

Boss music uses the same combat timing but upgrades the track for a recognized
boss identity or name. The current name catalog includes Muck-Scarred Helix,
The Gilded Bull, The Ninth Winter, The Failed Apprentice, The First Choir,
The Echo-Singer, Vyrahel, Thaedryn the Bellbound, Hex Wraith, Alpha Mucker,
and The Root-Crowned Dead.

Entering or leaving ordinary/boss combat crossfades over 0.75 seconds. Other
background changes crossfade over 5 seconds.

## Mix changes that do not replace the selected music

- Underwater play applies a low-pass filter to the current background track
  and adds the Harthmere underwater ambience loop.
- An audible nearby video/audio-source entity attenuates background music; it
  does not select another soundtrack track.
- Mountain summit wind is an effects-channel ambience, not music. It plays on
  supported open-sky snow at `y >= 100`, or other supported open terrain at
  `y >= 118`, and stops for caves, water, combat, Muck, minigames, or cutscenes.

## Music-like assets outside automatic world playback

- `disco.webm` is the boombox sound and `arcade.webm` is the arcade-machine
  theme. They are interactive/diegetic audio assets, not background-selector
  tracks.
- `music-1.webm` (Kyle Flynn) is the active original Grove theme.
- The four `legacy-protected-areas/*-loop.webm` files are original
  ElevenLabs-generated exploration themes. Mobile uses matching AAC-LC files
  under `audio/mobile/`.
- `08-banners-at-first-light-loop.mp3` remains registered and packaged as
  `harthmere_music`, but the automatic exploration selector never chooses it;
  Harthmere exploration uses the world loop instead.
- `05-the-sand-that-remembers-loop.mp3`,
  `06-the-long-winter-mouth-loop.mp3`, `muck-music-alternates/`, and the
  alternate cave/cavern files are preserved masters or experiments; the
  automatic selector does not load them.

## Startup and diagnostics contract

The audio manager loads the requested automatic track after the first valid
browser audio gesture and loads later selections on demand. If the gameplay
script chooses a region while loading is still in progress, the manager
remembers that requested track and starts it when ready instead of forcing the
old default slot.

`audioDiagnostics()` reports the requested track, current logical track,
current asset path, all loaded logical tracks and paths, and recent transitions.
For browser acceptance, use those diagnostics or an actual selected-track
network request; unrelated creature audio requests do not prove that background
music started.
