import { HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS } from "@/shared/harthmere/business_customer_npc_seed";
import { HARTHMERE_BUSINESS_OWNER_NPC_SEEDS } from "@/shared/harthmere/business_owner_npc_seed";
import {
  HARTHMERE_ADDITIVE_TOWN_NPC_DIALOGUE,
  harthmereAdditiveTownNpcEntityId,
  harthmereAdditiveTownNpcVoiceProfile,
} from "@/shared/harthmere/additive_town_npc_dialogue";
import { ch1AllScenes } from "@/shared/cutscene/ch1_scenes";
import { CH1_NEW_CAST, CH1_TESTIMONIES } from "@/shared/harthmere/ch1_cast";
import {
  CH1_VOICE_ACTORS,
  ch1VoiceActorForDescriptor,
  ch1VoiceActorForSpeaker,
} from "@/shared/harthmere/ch1_voice";
import { HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS } from "@/shared/harthmere/live_entity_production_seed";
import { HARTHMERE_NAMED_NPCS } from "@/shared/harthmere/npc_compendium";
import { HARTHMERE_REMAINING_NPCS } from "@/shared/harthmere/npc_compendium";
import {
  SNAPSHOT_GROVE_NPCS,
  snapshotGroveNpcEntityId,
} from "@/shared/harthmere/snapshot_grove_content";
import { SNAPSHOT_LIVE_NPC_LORE } from "@/shared/harthmere/snapshot_live_npc_bible";
import type {
  HarthmereNpcVoiceProfile,
  HarthmereVoiceActorInput,
} from "@/shared/harthmere/npc_voice_profiles";
import {
  harthmereVoiceProfileForActor,
  stableHarthmereVoiceHash,
  stripHarthmereSpeechMarkup,
} from "@/shared/harthmere/npc_voice_profiles";

export const HARTHMERE_NPC_VOICE_CATALOG_VERSION =
  "harthmere-npc-voice-catalog" as const;

export interface HarthmereStaticVoiceLine {
  lineId: string;
  text: string;
  recordingPath: string;
}

export interface HarthmereNpcVoiceCatalogEntry {
  source: string;
  id: string;
  entityId?: number;
  displayName: string;
  role?: string;
  background?: string;
  profile: HarthmereNpcVoiceProfile;
  staticLines: HarthmereStaticVoiceLine[];
}

function slugForVoicePath(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function uniqueCleanLines(lines: readonly (string | undefined)[]) {
  const seen = new Set<string>();
  const cleanLines: string[] = [];
  for (const line of lines) {
    const clean = stripHarthmereSpeechMarkup(line);
    if (!clean || seen.has(clean)) {
      continue;
    }
    seen.add(clean);
    cleanLines.push(clean);
  }
  return cleanLines;
}

function dialogueLinesFromObject(dialogue: unknown) {
  if (!dialogue || typeof dialogue !== "object") {
    return [];
  }
  return Object.values(dialogue as Record<string, unknown>).flatMap((value) =>
    typeof value === "string" ? [value] : []
  );
}

function staticLinesForActor(input: {
  source: string;
  id: string;
  displayName: string;
  lines: readonly (string | undefined)[];
}) {
  const actorSlug = slugForVoicePath(
    `${input.source}-${input.id}-${input.displayName}`
  );
  return uniqueCleanLines(input.lines).map((text, index) => {
    const lineId = `line-${String(index + 1).padStart(2, "0")}`;
    return {
      lineId,
      text,
      recordingPath: `harthmere/voices/generated/current/${actorSlug}/${lineId}.mp3`,
    };
  });
}

function catalogEntry(
  actor: HarthmereVoiceActorInput & {
    source: string;
    id: string;
    displayName: string;
    entityId?: number;
    staticLines: readonly (string | undefined)[];
    /** Reuse an existing actor identity when adding chapter-specific lines. */
    profile?: HarthmereNpcVoiceProfile;
  }
): HarthmereNpcVoiceCatalogEntry {
  const profile = actor.profile ?? harthmereVoiceProfileForActor(actor);
  return {
    source: actor.source,
    id: actor.id,
    entityId:
      typeof actor.entityId === "number"
        ? actor.entityId
        : Number(actor.entityId) || undefined,
    displayName: actor.displayName,
    role: actor.role,
    background: actor.background,
    profile,
    staticLines: staticLinesForActor({
      source: actor.source,
      id: actor.id,
      displayName: actor.displayName,
      lines: actor.staticLines,
    }),
  };
}

export function buildHarthmereNpcVoiceCatalog(): HarthmereNpcVoiceCatalogEntry[] {
  const entries: HarthmereNpcVoiceCatalogEntry[] = [];

  for (const npc of HARTHMERE_NAMED_NPCS) {
    entries.push(
      catalogEntry({
        source: "harthmere_named",
        id: npc.id,
        displayName: npc.name,
        name: npc.name,
        role: npc.role,
        kind: npc.kind,
        background: npc.bibleBackstory,
        voiceStyle: npc.voiceStyle,
        staticLines: dialogueLinesFromObject(npc.dialogue),
      })
    );
  }

  for (const npc of HARTHMERE_REMAINING_NPCS) {
    entries.push(
      catalogEntry({
        source: "harthmere_remaining",
        id: npc.id,
        displayName: npc.name,
        name: npc.name,
        role: npc.role,
        kind: npc.kind,
        background: npc.bibleBackstory,
        voiceStyle: npc.voiceStyle,
        staticLines: dialogueLinesFromObject(npc.dialogue),
      })
    );
  }

  // The additive Harthmere town roster is seeded from server/shim/main.ts and
  // historically bypassed the shared voice catalog. Register its exact
  // runtime actor identities here so intros and opt-in lore conversations hit
  // committed MP3s instead of paid runtime synthesis.
  for (const npc of HARTHMERE_ADDITIVE_TOWN_NPC_DIALOGUE) {
    entries.push(
      catalogEntry({
        source: "harthmere_additive_town",
        id: `additive-town-${npc.offset}`,
        entityId: harthmereAdditiveTownNpcEntityId(npc.offset),
        displayName: npc.displayName,
        name: npc.displayName,
        role: npc.role,
        kind: npc.kind,
        background: `${npc.story} ${npc.location}`,
        voiceStyle: npc.voiceStyle,
        sex: npc.sex,
        staticLines: [npc.intro, npc.story, npc.location],
        profile: harthmereAdditiveTownNpcVoiceProfile(npc),
      })
    );
  }

  for (const npc of SNAPSHOT_GROVE_NPCS) {
    entries.push(
      catalogEntry({
        source: "snapshot_grove",
        id: npc.id,
        entityId: Number(snapshotGroveNpcEntityId(npc)),
        displayName: npc.displayName,
        name: npc.displayName,
        role: npc.role,
        kind: "humanoid",
        background: npc.background,
        staticLines: [npc.line, ...npc.extraLines],
      })
    );
  }

  for (const npc of SNAPSHOT_LIVE_NPC_LORE) {
    entries.push(
      catalogEntry({
        source: "snapshot_live_lore",
        id: npc.id,
        displayName: npc.displayName,
        name: npc.displayName,
        role: npc.role,
        kind: "humanoid",
        background: npc.background,
        voiceStyle: npc.voice,
        staticLines: [npc.line, ...npc.extraLines],
      })
    );
  }

  for (const seed of HARTHMERE_BUSINESS_OWNER_NPC_SEEDS) {
    entries.push(
      catalogEntry({
        source: "business_owner",
        id: seed.ownerNpcId,
        entityId: Number(seed.entityId),
        displayName: seed.displayName,
        name: seed.displayName,
        role: seed.roleTitle,
        kind: "humanoid",
        background: seed.description,
        staticLines: [seed.line, ...seed.extraLines],
      })
    );
  }

  for (const seed of HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS) {
    entries.push(
      catalogEntry({
        source: "business_customer",
        id: seed.customerNpcId,
        entityId: Number(seed.entityId),
        displayName: seed.displayName,
        name: seed.displayName,
        role: seed.roleTitle,
        kind: "humanoid",
        background: seed.background,
        staticLines: [seed.line, ...seed.extraLines],
      })
    );
  }

  for (const seed of HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS) {
    entries.push(
      catalogEntry({
        source: "live_entity_seed",
        id: seed.seedId,
        entityId: Number(seed.entityId),
        displayName: seed.displayName,
        name: seed.displayName,
        role: seed.kind,
        kind: seed.kind,
        background: seed.description,
        staticLines: [seed.dialog],
      })
    );
  }

  // Group every implemented Chapter 1 cinematic line by the exact actor
  // descriptor attached to the cutscene. This makes the committed MP3 and the
  // runtime request share a cache key while preserving returning voices.
  const chapterLinesByActorKey = new Map<string, string[]>();
  const addChapterLine = (
    actorKey: string | undefined,
    text: string | undefined
  ) => {
    if (!actorKey || !text) {
      return;
    }
    const lines = chapterLinesByActorKey.get(actorKey) ?? [];
    lines.push(text);
    chapterLinesByActorKey.set(actorKey, lines);
  };

  for (const member of CH1_NEW_CAST) {
    addChapterLine(
      ch1VoiceActorForSpeaker(member.displayName)?.profile.actorKey,
      member.key === "marrow" ? undefined : member.sampleLine
    );
  }
  for (const testimony of CH1_TESTIMONIES) {
    addChapterLine(
      ch1VoiceActorForSpeaker(testimony.npc)?.profile.actorKey,
      testimony.line
    );
  }
  for (const scene of ch1AllScenes()) {
    for (const action of scene.shots.flatMap((shot) => shot.actions)) {
      if (action.kind !== "dialogue" || !action.voice) {
        continue;
      }
      addChapterLine(
        ch1VoiceActorForDescriptor(action.voice)?.profile.actorKey,
        action.text
      );
    }
  }

  for (const actor of CH1_VOICE_ACTORS) {
    const staticLines =
      chapterLinesByActorKey.get(actor.profile.actorKey) ?? [];
    if (staticLines.length === 0) {
      continue;
    }
    entries.push(
      catalogEntry({
        source: actor.source,
        id: actor.id,
        entityId: actor.entityId,
        displayName: actor.displayName,
        name: actor.displayName,
        role: actor.role,
        background: actor.background,
        voiceStyle: actor.voiceStyle,
        staticLines,
        // Returning characters must sound identical to their earlier Grove or
        // business dialogue rather than being recast for the new chapter.
        profile: actor.profile,
      })
    );
  }

  // Chapter-specific lines deliberately reuse returning actors' established
  // profiles. Merge those rows by actor identity so one person keeps one
  // voice while still contributing every new static recording.
  const merged = new Map<string, HarthmereNpcVoiceCatalogEntry>();
  for (const entry of entries) {
    const existing = merged.get(entry.profile.actorKey);
    if (!existing) {
      merged.set(entry.profile.actorKey, {
        ...entry,
        staticLines: [...entry.staticLines],
      });
      continue;
    }
    const seen = new Set(existing.staticLines.map((line) => line.text));
    for (const line of entry.staticLines) {
      if (!seen.has(line.text)) {
        existing.staticLines.push(line);
        seen.add(line.text);
      }
    }
  }
  const recordingPaths = new Set<string>();
  return [...merged.values()].map((entry) => ({
    ...entry,
    staticLines: entry.staticLines.map((line) => {
      if (!recordingPaths.has(line.recordingPath)) {
        recordingPaths.add(line.recordingPath);
        return line;
      }
      // Long live-entity ids can differ only after the filename-safe slug's
      // length cap. Preserve established paths unless there is an actual
      // collision, then add a stable actor suffix before the line filename.
      const separator = line.recordingPath.lastIndexOf("/");
      const actorSuffix = stableHarthmereVoiceHash(entry.profile.actorKey)
        .toString(16)
        .padStart(8, "0");
      const recordingPath = `${line.recordingPath.slice(
        0,
        separator
      )}-${actorSuffix}${line.recordingPath.slice(separator)}`;
      recordingPaths.add(recordingPath);
      return { ...line, recordingPath };
    }),
  }));
}

export const HARTHMERE_NPC_VOICE_CATALOG = buildHarthmereNpcVoiceCatalog();

export const HARTHMERE_NPC_VOICE_PROFILE_BY_ACTOR_KEY = new Map(
  HARTHMERE_NPC_VOICE_CATALOG.map((entry) => [
    entry.profile.actorKey,
    entry.profile,
  ])
);

export const HARTHMERE_NPC_VOICE_PROFILE_BY_ENTITY_ID = new Map(
  HARTHMERE_NPC_VOICE_CATALOG.flatMap((entry) =>
    entry.entityId === undefined
      ? []
      : [[entry.entityId, entry.profile] as const]
  )
);
