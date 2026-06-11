import { HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS_V1 } from "@/shared/harthmere/business_customer_npc_seed_v1";
import { HARTHMERE_BUSINESS_OWNER_NPC_SEEDS_V1 } from "@/shared/harthmere/business_owner_npc_seed_v1";
import { HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS_V1 } from "@/shared/harthmere/live_entity_production_seed_v1";
import { HARTHMERE_NAMED_NPCS_V44 } from "@/shared/harthmere/npc_compendium_v44";
import { HARTHMERE_REMAINING_NPCS_V45 } from "@/shared/harthmere/npc_compendium_v45";
import {
  SNAPSHOT_GROVE_NPCS_V75,
  snapshotGroveNpcEntityIdV75,
} from "@/shared/harthmere/snapshot_grove_content_v75";
import { SNAPSHOT_LIVE_NPC_LORE_V79 } from "@/shared/harthmere/snapshot_live_npc_bible_v79";
import type {
  HarthmereNpcVoiceProfileV1,
  HarthmereVoiceActorInputV1,
} from "@/shared/harthmere/npc_voice_profiles_v1";
import {
  harthmereVoiceProfileForActorV1,
  stripHarthmereSpeechMarkupV1,
} from "@/shared/harthmere/npc_voice_profiles_v1";

export const HARTHMERE_NPC_VOICE_CATALOG_VERSION_V1 =
  "harthmere-npc-voice-catalog-v1" as const;

export interface HarthmereStaticVoiceLineV1 {
  lineId: string;
  text: string;
  recordingPath: string;
}

export interface HarthmereNpcVoiceCatalogEntryV1 {
  source: string;
  id: string;
  entityId?: number;
  displayName: string;
  role?: string;
  background?: string;
  profile: HarthmereNpcVoiceProfileV1;
  staticLines: HarthmereStaticVoiceLineV1[];
}

function slugForVoicePathV1(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function uniqueCleanLinesV1(lines: readonly (string | undefined)[]) {
  const seen = new Set<string>();
  const cleanLines: string[] = [];
  for (const line of lines) {
    const clean = stripHarthmereSpeechMarkupV1(line);
    if (!clean || seen.has(clean)) {
      continue;
    }
    seen.add(clean);
    cleanLines.push(clean);
  }
  return cleanLines;
}

function dialogueLinesFromObjectV1(dialogue: unknown) {
  if (!dialogue || typeof dialogue !== "object") {
    return [];
  }
  return Object.values(dialogue as Record<string, unknown>).flatMap((value) =>
    typeof value === "string" ? [value] : []
  );
}

function staticLinesForActorV1(input: {
  source: string;
  id: string;
  displayName: string;
  lines: readonly (string | undefined)[];
}) {
  const actorSlug = slugForVoicePathV1(
    `${input.source}-${input.id}-${input.displayName}`
  );
  return uniqueCleanLinesV1(input.lines).map((text, index) => {
    const lineId = `line-${String(index + 1).padStart(2, "0")}`;
    return {
      lineId,
      text,
      recordingPath: `harthmere/voices/generated/v1/${actorSlug}/${lineId}.mp3`,
    };
  });
}

function catalogEntryV1(
  actor: HarthmereVoiceActorInputV1 & {
    source: string;
    id: string;
    displayName: string;
    entityId?: number;
    staticLines: readonly (string | undefined)[];
  }
): HarthmereNpcVoiceCatalogEntryV1 {
  const profile = harthmereVoiceProfileForActorV1(actor);
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
    staticLines: staticLinesForActorV1({
      source: actor.source,
      id: actor.id,
      displayName: actor.displayName,
      lines: actor.staticLines,
    }),
  };
}

export function buildHarthmereNpcVoiceCatalogV1(): HarthmereNpcVoiceCatalogEntryV1[] {
  const entries: HarthmereNpcVoiceCatalogEntryV1[] = [];

  for (const npc of HARTHMERE_NAMED_NPCS_V44) {
    entries.push(
      catalogEntryV1({
        source: "harthmere_named_v44",
        id: npc.id,
        displayName: npc.name,
        name: npc.name,
        role: npc.role,
        kind: npc.kind,
        background: npc.bibleBackstory,
        voiceStyle: npc.voiceStyle,
        staticLines: dialogueLinesFromObjectV1(npc.dialogue),
      })
    );
  }

  for (const npc of HARTHMERE_REMAINING_NPCS_V45) {
    entries.push(
      catalogEntryV1({
        source: "harthmere_remaining_v45",
        id: npc.id,
        displayName: npc.name,
        name: npc.name,
        role: npc.role,
        kind: npc.kind,
        background: npc.bibleBackstory,
        voiceStyle: npc.voiceStyle,
        staticLines: dialogueLinesFromObjectV1(npc.dialogue),
      })
    );
  }

  for (const npc of SNAPSHOT_GROVE_NPCS_V75) {
    entries.push(
      catalogEntryV1({
        source: "snapshot_grove_v75",
        id: npc.id,
        entityId: Number(snapshotGroveNpcEntityIdV75(npc)),
        displayName: npc.displayName,
        name: npc.displayName,
        role: npc.role,
        kind: "humanoid",
        background: npc.background,
        staticLines: [npc.line, ...npc.extraLines],
      })
    );
  }

  for (const npc of SNAPSHOT_LIVE_NPC_LORE_V79) {
    entries.push(
      catalogEntryV1({
        source: "snapshot_live_lore_v79",
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

  for (const seed of HARTHMERE_BUSINESS_OWNER_NPC_SEEDS_V1) {
    entries.push(
      catalogEntryV1({
        source: "business_owner_v1",
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

  for (const seed of HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS_V1) {
    entries.push(
      catalogEntryV1({
        source: "business_customer_v1",
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

  for (const seed of HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS_V1) {
    entries.push(
      catalogEntryV1({
        source: "live_entity_seed_v1",
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

  return entries;
}

export const HARTHMERE_NPC_VOICE_CATALOG_V1 = buildHarthmereNpcVoiceCatalogV1();

export const HARTHMERE_NPC_VOICE_PROFILE_BY_ACTOR_KEY_V1 = new Map(
  HARTHMERE_NPC_VOICE_CATALOG_V1.map((entry) => [
    entry.profile.actorKey,
    entry.profile,
  ])
);

export const HARTHMERE_NPC_VOICE_PROFILE_BY_ENTITY_ID_V1 = new Map(
  HARTHMERE_NPC_VOICE_CATALOG_V1.flatMap((entry) =>
    entry.entityId === undefined
      ? []
      : [[entry.entityId, entry.profile] as const]
  )
);
