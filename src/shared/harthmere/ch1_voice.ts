// CHAPTER_1_VOICE_CAST
//
// Stable voice identities for Chapter 1. This module deliberately sits
// between the narrative data and the generic voice catalog so cutscenes,
// committed MP3 generation, and runtime TTS all use the same actor descriptor.

import {
  dialogueDurationSeconds,
  type CutsceneDef,
} from "@/shared/cutscene/schema";
import { HARTHMERE_BUSINESS_OWNER_NPC_SEEDS } from "@/shared/harthmere/business_owner_npc_seed";
import { CH1_NPC_ENTITY_IDS, type Ch1NpcKey } from "@/shared/harthmere/ch1_ids";
import {
  SNAPSHOT_GROVE_NPCS,
  snapshotGroveNpcEntityId,
} from "@/shared/harthmere/snapshot_grove_content";
import { SNAPSHOT_LIVE_NPC_LORE } from "@/shared/harthmere/snapshot_live_npc_bible";
import {
  harthmereVoiceProfileForActor,
  type HarthmereNpcVoiceProfile,
  type HarthmereVoiceActorInput,
  type HarthmereVoiceGender,
} from "@/shared/harthmere/npc_voice_profiles";

export const CH1_VOICE_CAST_VERSION = 1 as const;

export interface Ch1VoiceActorDefinition {
  /** Chapter-local, filename-safe identity; never contains unrevealed lore. */
  id: string;
  source: "chapter_1_identity";
  entityId?: number;
  displayName: string;
  role?: string;
  background?: string;
  voiceStyle?: string;
  profile: HarthmereNpcVoiceProfile;
  aliases: readonly string[];
}

const CH1_NEW_CAST_PRESENTATION: Readonly<
  Partial<Record<Ch1NpcKey, HarthmereVoiceGender>>
> = Object.freeze({
  lou_ardan: "male",
  cressa_vane: "female",
  halden_rook: "male",
  nadia_sorrel: "female",
  iris_fen: "female",
  teak_morrow: "male",
  augur9: "neutral",
  wen_halloway: "female",
  hallr_ironmouth: "male",
});

interface Ch1RuntimeVoiceCastMember {
  key: Exclude<Ch1NpcKey, "marrow">;
  displayName: string;
  role: string;
  voiceStyle: string;
  aliases?: readonly string[];
}

// Keep this client-safe: writer notes and reveal-only narrative metadata stay
// in ch1_cast.ts and are consumed only by the server-side recording catalog.
const CH1_RUNTIME_VOICE_CAST: readonly Ch1RuntimeVoiceCastMember[] =
  Object.freeze([
    {
      key: "lou_ardan",
      displayName: "Dr. Lucien Ardan",
      role: "Curator of Care, Collective Medical Directorate",
      voiceStyle:
        "Unhurried, precise, warm without being soft. Never raises his voice.",
      aliases: ["Dr. Ardan", "Lou", "A voice behind you"],
    },
    {
      key: "cressa_vane",
      displayName: "Arbiter Cressa Vane",
      role: "Collective political liaison",
      voiceStyle:
        "Procedural, exhausted, entirely reasonable. Never threatens.",
    },
    {
      key: "halden_rook",
      displayName: "Halden Rook",
      role: "Harthmere exile and gate-warden",
      voiceStyle:
        "Formal, cold, measured, unexpectedly gentle with children and animals.",
    },
    {
      key: "nadia_sorrel",
      displayName: "Dr. Nadia Sorrel",
      role: "Research partner displaced through time",
      voiceStyle: "Fast, impatient, and always in the middle of an argument.",
      aliases: ["Nadia Sorrel", "Sorrel"],
    },
    {
      key: "iris_fen",
      displayName: "Iris Fen",
      role: "A calm eight-year-old displaced through a fracture gate",
      voiceStyle:
        "Young, calm, and matter-of-fact about things that should be impossible.",
    },
    {
      key: "teak_morrow",
      displayName: 'Teague "Teak" Morrow',
      role: "Take Terra cell runner",
      voiceStyle: "Cynical, funny, nervous, and quicker than he looks.",
      aliases: ["Teak", "Teague Morrow"],
    },
    {
      key: "augur9",
      displayName: "AUGUR-9",
      role: "Autonomous research custodian robot",
      voiceStyle:
        "Degraded and artifact-like, precise when the recording is intact.",
      aliases: ["Mucked Robot", "Auggie"],
    },
    {
      key: "wen_halloway",
      displayName: "Wen Halloway",
      role: "Collective refinery clerk",
      voiceStyle: "Tired, careful, restrained, and quietly disapproving.",
    },
    {
      key: "hallr_ironmouth",
      displayName: "Jarl Hallr Ironmouth",
      role: "Keeper of the stopped-winter settlement",
      voiceStyle: "Slow, formal, and monstrously tired.",
    },
  ]);

function chapterActor(input: {
  id: string;
  entityId?: number;
  displayName: string;
  role?: string;
  background?: string;
  voiceStyle?: string;
  aliases?: readonly string[];
  profileInput: HarthmereVoiceActorInput;
}): Ch1VoiceActorDefinition {
  return Object.freeze({
    id: input.id,
    source: "chapter_1_identity" as const,
    entityId: input.entityId,
    displayName: input.displayName,
    role: input.role,
    background: input.background,
    voiceStyle: input.voiceStyle,
    profile: harthmereVoiceProfileForActor(input.profileInput),
    aliases: Object.freeze([input.displayName, ...(input.aliases ?? [])]),
  });
}

const NEW_CAST_VOICE_ACTORS = CH1_RUNTIME_VOICE_CAST.map((member) =>
  chapterActor({
    id: member.key,
    entityId: Number(CH1_NPC_ENTITY_IDS[member.key]),
    displayName: member.displayName,
    role: member.role,
    voiceStyle: member.voiceStyle,
    aliases: member.aliases,
    profileInput: {
      source: "chapter_1_identity",
      id: member.key,
      entityId: Number(CH1_NPC_ENTITY_IDS[member.key]),
      displayName: member.displayName,
      name: member.displayName,
      role: member.role,
      kind: member.key === "augur9" ? "robot" : "humanoid",
      gender: CH1_NEW_CAST_PRESENTATION[member.key],
      voiceStyle: member.voiceStyle,
    },
  })
);

const TESTIMONY_SPEAKERS = new Set([
  "Alva",
  "Helsa",
  "Grover",
  "Coretta",
  "Emily",
  "Patsy",
  "Richard",
  "Runna",
  "Drona",
  "Gizela",
  "Davi",
  "Allix",
]);

const RETURNING_GROVE_VOICE_ACTORS = SNAPSHOT_GROVE_NPCS.filter(
  // Jackie speaks throughout the chapter; use her existing Grove identity so
  // the new scenes do not unexpectedly recast a familiar character.
  (npc) => npc.displayName === "Jackie"
).map((npc) =>
  chapterActor({
    id: `returning_${npc.id}`,
    entityId: Number(snapshotGroveNpcEntityId(npc)),
    displayName: npc.displayName,
    role: npc.role,
    background: npc.background,
    profileInput: {
      source: "snapshot_grove",
      id: npc.id,
      entityId: Number(snapshotGroveNpcEntityId(npc)),
      displayName: npc.displayName,
      name: npc.displayName,
      role: npc.role,
      kind: "humanoid",
      background: npc.background,
    },
  })
);

const TESTIMONY_VOICE_ACTORS = SNAPSHOT_LIVE_NPC_LORE.filter((npc) =>
  TESTIMONY_SPEAKERS.has(npc.displayName)
).map((npc) =>
  chapterActor({
    id: `testimony_${npc.id}`,
    displayName: npc.displayName,
    role: npc.role,
    background: npc.background,
    voiceStyle: npc.voice,
    profileInput: {
      source: "snapshot_live_lore",
      id: npc.id,
      displayName: npc.displayName,
      name: npc.displayName,
      role: npc.role,
      kind: "humanoid",
      background: npc.background,
      voiceStyle: npc.voice,
    },
  })
);

const CH1_BUSINESS_SPEAKER_NAMES = new Set(["Foreman Calla Ashe"]);

const RETURNING_BUSINESS_VOICE_ACTORS =
  HARTHMERE_BUSINESS_OWNER_NPC_SEEDS.filter((npc) =>
    CH1_BUSINESS_SPEAKER_NAMES.has(npc.displayName)
  ).map((npc) =>
    chapterActor({
      id: `returning_${npc.ownerNpcId}`,
      entityId: Number(npc.entityId),
      displayName: npc.displayName,
      role: npc.roleTitle,
      background: npc.description,
      profileInput: {
        source: "business_owner",
        id: npc.ownerNpcId,
        entityId: Number(npc.entityId),
        displayName: npc.displayName,
        name: npc.displayName,
        role: npc.roleTitle,
        kind: "humanoid",
        background: npc.description,
      },
    })
  );

export const CH1_VOICE_ACTORS: readonly Ch1VoiceActorDefinition[] =
  Object.freeze([
    ...NEW_CAST_VOICE_ACTORS,
    ...RETURNING_GROVE_VOICE_ACTORS,
    ...TESTIMONY_VOICE_ACTORS,
    ...RETURNING_BUSINESS_VOICE_ACTORS,
  ]);

const ACTOR_BY_ENTITY_ID = new Map(
  CH1_VOICE_ACTORS.flatMap((actor) =>
    actor.entityId === undefined ? [] : [[actor.entityId, actor] as const]
  )
);
const ACTOR_BY_VOICE = new Map(
  CH1_VOICE_ACTORS.map((actor) => [actor.profile.voiceParameterId, actor])
);
const ACTOR_BY_SPEAKER = new Map<string, Ch1VoiceActorDefinition>();

function normalizedSpeaker(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

for (const actor of CH1_VOICE_ACTORS) {
  for (const alias of actor.aliases) {
    ACTOR_BY_SPEAKER.set(normalizedSpeaker(alias), actor);
  }
}

export function ch1VoiceActorForSpeaker(
  speaker: string | undefined
): Ch1VoiceActorDefinition | undefined {
  return speaker ? ACTOR_BY_SPEAKER.get(normalizedSpeaker(speaker)) : undefined;
}

export function ch1VoiceActorForDescriptor(
  voice: string | undefined
): Ch1VoiceActorDefinition | undefined {
  return voice ? ACTOR_BY_VOICE.get(voice) : undefined;
}

function actorForCastBinding(
  binding: CutsceneDef["cast"][number]["binding"]
): Ch1VoiceActorDefinition | undefined {
  if (binding.kind === "entity") {
    return ACTOR_BY_ENTITY_ID.get(Number(binding.entityId));
  }
  if (
    binding.kind === "nearestNpc" &&
    /mucked robot|augur-9/i.test(binding.labelMatch ?? "")
  ) {
    return ch1VoiceActorForSpeaker("AUGUR-9");
  }
  return undefined;
}

function isNarratedInsteadOfSpoken(input: {
  sceneId: string;
  shotId: string;
  speaker?: string;
}) {
  // These captions describe reconstructed images or the player's own stored
  // voice. They remain subtitled but must not be performed by an NPC actor.
  return (
    input.speaker === "A recording" ||
    input.speaker === "Custodian Key 7" ||
    (input.sceneId.includes("ch1-recon-corridor") &&
      input.shotId === "she-is-running")
  );
}

function naturalChapterVoiceDurationSeconds(input: {
  text: string;
  actor: Ch1VoiceActorDefinition;
  authoredDuration?: number;
}) {
  const wordCount = input.text.trim().split(/\s+/).filter(Boolean).length;
  const expressivePauseCount = (input.text.match(/[.!?…—]/g) ?? []).length;
  // ElevenLabs respects punctuation more strongly than the subtitle-reading
  // estimate. Give each phrase room to breathe, with extra recovery time for
  // AUGUR-9's deliberately broken and artifact-like delivery.
  const naturalEstimate =
    1.2 +
    wordCount * 0.4 +
    expressivePauseCount * 0.45 +
    (input.actor.profile.actorKind === "robot" ? 1.5 : 0);
  return Math.min(
    20,
    Math.max(
      dialogueDurationSeconds({
        text: input.text,
        duration: input.authoredDuration,
      }),
      naturalEstimate
    )
  );
}

/**
 * Adds stable voice descriptors and enough shot time for natural delivery
 * without changing spoiler-safe subtitle attribution. Player and narration
 * lines remain text-only, which prevents a generic NPC voice from speaking for
 * the player.
 */
export function withCh1DialogueVoices(def: CutsceneDef): CutsceneDef {
  const actorByRole = new Map(
    def.cast.flatMap((member) => {
      const actor = actorForCastBinding(member.binding);
      return actor ? [[member.role, actor] as const] : [];
    })
  );

  return {
    ...def,
    shots: def.shots.map((shot) => {
      const actions = shot.actions.map((action) => {
        if (
          action.kind !== "dialogue" ||
          isNarratedInsteadOfSpoken({
            sceneId: def.id,
            shotId: shot.id,
            speaker: action.speaker,
          })
        ) {
          return action;
        }
        const actor =
          ch1VoiceActorForSpeaker(action.speaker) ??
          (action.role ? actorByRole.get(action.role) : undefined);
        if (!actor) {
          return action;
        }
        return {
          ...action,
          // Keep anonymous labels such as "A voice behind you" intact until
          // the authored reveal, while giving role-only template lines a name.
          speaker: action.speaker ?? actor.displayName,
          voice: actor.profile.voiceParameterId,
          duration: naturalChapterVoiceDurationSeconds({
            text: action.text,
            actor,
            authoredDuration: action.duration,
          }),
        };
      });
      const latestDialogueEnd = actions.reduce((latest, action) => {
        if (action.kind !== "dialogue" || !action.voice) {
          return latest;
        }
        return Math.max(
          latest,
          action.at + dialogueDurationSeconds(action) + 0.25
        );
      }, 0);
      const duration = Math.max(shot.duration, latestDialogueEnd);
      return {
        ...shot,
        // Keep the subtitle and scene alive for the natural performance. The
        // hard ceiling remains finite and leaves two seconds of safety margin.
        duration,
        until:
          shot.until?.kind === "dialogueDone"
            ? {
                ...shot.until,
                maxDuration: Math.max(shot.until.maxDuration, duration + 2),
              }
            : shot.until,
        actions,
      };
    }),
  };
}
