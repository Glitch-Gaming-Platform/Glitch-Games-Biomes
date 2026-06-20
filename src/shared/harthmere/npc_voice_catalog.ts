import { HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS } from "@/shared/harthmere/business_customer_npc_seed";
import { HARTHMERE_BUSINESS_OWNER_NPC_SEEDS } from "@/shared/harthmere/business_owner_npc_seed";
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
  }
): HarthmereNpcVoiceCatalogEntry {
  const profile = harthmereVoiceProfileForActor(actor);
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

  return entries;
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
