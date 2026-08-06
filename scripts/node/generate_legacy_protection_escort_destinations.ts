import { iterBackupEntitiesFromFile } from "@/server/backup/serde";
import type { Entity } from "@/shared/ecs/gen/entities";
import { writeFile } from "fs/promises";

const TARGETS: ReadonlyArray<readonly [string, number]> = [
  ["😂", 1],
  ["4231", 1],
  ["4231 2", 1],
  ["Aadam’s Robot", 1],
  ["Admin Robot", 4],
  ["Aeryn's Bot", 1],
  ["ajiri’s Robot", 1],
  ["alphonse", 1],
  ["Amouranth Bot", 1],
  ["Apex", 1],
  ["Arbre Bot", 1],
  ["Aspirinha", 1],
  ["Asthabot", 1],
  ["B3-M0", 1],
  ["B4N3", 1],
  ["babybot", 1],
  ["Basecamp Bot", 1],
  ["Ben’s Bobot", 1],
  ["Bender", 1],
  ["BimbaBoy’s Robot", 1],
  ["BingusBigClan", 1],
  ["Biomes Bot", 2],
  ["Biomes MVX Bot", 1],
  ["Bisc-o-matic", 1],
  ["Blinky", 1],
  ["Boba :)", 1],
  ["Bobby, sleepyshodreamer’s Robot", 1],
  ["bot (taylor's version)", 1],
  ["BradyDaLlama’s Robot", 1],
  ["Brickleberry Bot", 2],
  ["Bricklebot", 1],
  ["Bubbles", 1],
  ["Carlinhos Morto", 1],
  ["Castle", 1],
  ["Cedarside", 1],
  ["cherrow’s Robot", 1],
  ["Chuck", 1],
  ["Chuggington", 1],
  ["Clodhopper Cabins", 1],
  ["Colosseum Bot", 1],
  ["Cozmo", 1],
  ["Cruz bot", 1],
  ["cum Robot", 1],
  ["Da rock", 1],
  ["DaMulez", 1],
  ["Davinci's Drunken Temple", 1],
  ["Deco5011", 1],
  ["DeGaspari’s Robot", 1],
  ["Doc's Bot", 1],
  ["Doc's Bot II", 1],
  ["Doug", 1],
  ["Dreamscape’s Robot", 1],
  ["Eva", 1],
  ["Ezio Auditore da Firenze", 1],
  ["Feuille Bridge", 5],
  ["Feuille Gardens", 1],
  ["FFT", 1],
  ["Flowerbot", 1],
  ["Frogberry", 1],
  ["Fun Bot", 1],
  ["Gabercr’s Robot", 1],
  ["Generalkenobi51’s Robot", 1],
  ["George", 1],
  ["Gerald", 1],
  ["Geraldo", 1],
  ["Gilerd", 1],
  ["Glaedred", 1],
  ["GoldenAstroFox’s Robot", 1],
  ["Goldie B", 1],
  ["Gregory", 1],
  ["Grimer goop the first", 1],
  ["Grover", 1],
  ["Grover II", 2],
  ["Grover III", 1],
  ["HAL-9000", 1],
  ["Halide", 1],
  ["Hexed Cemetery", 2],
  ["IvanovDaniil’s Robot", 1],
  ["J.A.R.V.I.S", 1],
  ["JAKE!!!", 1],
  ["Jeeves", 1],
  ["jeramy!", 1],
  [
    "Joe Hawley Joe Hawley Joe Hawley Joe Hawley Joe Hawley Joe Hawley Joe Hawley Joe Hawley Joe Hawley Joe Hawley Joe Hawley Joe Hawley Joe Hawley Joe Hawley Joe Hawley Joe Hawley",
    1,
  ],
  ["Jorgin", 1],
  ["just a little guy", 1],
  ["Kasrkraw’s Robot", 1],
  ["King Trial's Temple Bot", 1],
  ["kirk", 1],
  ["Lagrange’s Robot", 1],
  ["lape’s Robot", 1],
  ["Layer 2", 1],
  ["Layer 3", 1],
  ["linaroki’s Robot", 1],
  ["Lirix’s Home", 1],
  ["Little Bugger", 1],
  ["little stupid robot", 1],
  ["Loamf", 1],
  ["LokiDoki_Bot", 1],
  ["Lola", 1],
  ["LosPutinhos", 1],
  ["louis", 1],
  ["Marilyn Monrobot", 1],
  ["Martin, Comet's roomate", 1],
  ["Matt's Race", 1],
  ["mebroso’s Robot", 1],
  ["Merlin's Beard Bot", 1],
  ["MF", 2],
  ["Mike", 1],
  ["Millie", 1],
  ["MoBot 3000", 1],
  ["MoNk3y's Slave", 1],
  ["Mossy Bot", 1],
  ["Mucked Restoro Bot", 2],
  ["Mucked RestoroBotNEW", 1],
  ["Muckerhorn", 1],
  ["Muckerhorn Bot", 2],
  ["My Melody", 1],
  ["N'aru", 1],
  ["NanoNarcAgent’s Robot", 1],
  ["Neb360’s Robot", 1],
  ["Ned", 1],
  ["Nemours Estate", 2],
  ["no", 1],
  ["Northern Outpost", 1],
  ["Nugget Bot 🍗", 1],
  ["paruBot", 1],
  ["PB DreamerBot", 1],
  ["Picao", 1],
  ["piss gulper", 1],
  ["Pluto", 1],
  ["Pollen", 1],
  ["Pondy Bot", 1],
  ["Pooski", 2],
  ["r2dindu", 1],
  ["Reginleif’s Robot", 1],
  ["Restoro Bot", 1],
  ["Ribbit Ribbot", 1],
  ["Ricky", 1],
  ["Rizzlord", 1],
  ["Ro-bud", 1],
  ["Robatu", 1],
  ["Robert", 1],
  ["Robert Cop", 1],
  ["Robo DaMaite", 1],
  ["Robo Tony", 1],
  ["Robocop", 1],
  ["robot_aces_too", 1],
  ["Rosanne’s Robot", 1],
  ["RoweDude’s Robot", 1],
  ["Salamander’s Robot", 1],
  ["Samon", 1],
  ["SECURITY ALERT", 1],
  ["Shane", 1],
  ["Shelterbot", 1],
  ["shifu’s Robot", 1],
  ["Sideralis", 1],
  ["SloppyMcPants’s Robot", 1],
  ["smol", 1],
  ["Snailbot", 1],
  ["SpleefBot", 2],
  ["stassibaby’s Robot", 1],
  ["stillalia", 1],
  ["Stoke", 1],
  ["StrongMomGames’s Robot", 1],
  ["Temple of the Sun", 1],
  ["The Aqueducts", 2],
  ["The Cutest Bot ever", 1],
  ["The Destroyer", 1],
  ["The Tower", 1],
  ["toast’s Robot", 1],
  ["Tony", 1],
  ["Towerbot", 2],
  ["uKort's Castle", 1],
  ["victoriamain’s Robot", 1],
  ["Village", 1],
  ["vira lata", 1],
  ["Wall-e", 1],
  ["Watt Bot", 1],
  ["Winter Plains", 1],
  ["WIP", 2],
  ["Ymmk", 1],
] as const;

type Parent = {
  entityId: string;
  name: string;
  protectionChildId: string;
  position: [number, number, number];
  size: [number, number, number];
};

type Field = {
  position: [number, number, number];
  size: [number, number, number];
};

function finiteVec3(value: unknown): [number, number, number] | undefined {
  if (!Array.isArray(value) || value.length < 3) return undefined;
  const result = [Number(value[0]), Number(value[1]), Number(value[2])] as [
    number,
    number,
    number,
  ];
  return result.every(Number.isFinite) ? result : undefined;
}

async function main() {
  const backupPath = process.argv[2] ?? "snapshot_backup.json";
  const outputPath =
    process.argv[3] ??
    "src/shared/harthmere/legacy_protection_escort_destinations.ts";
  const targetCounts = new Map(TARGETS);
  if (targetCounts.size !== 181) {
    throw new Error(`Expected 181 unique names, got ${targetCounts.size}`);
  }

  const parents: Parent[] = [];
  const fields = new Map<string, Field>();
  for await (const [, entity] of iterBackupEntitiesFromFile(backupPath)) {
    const typed = entity as Entity;
    const entityId = String(typed.id);
    // A few legacy field entities predate the generated `protection` component
    // accessor but are still the materialized child referenced by the robot.
    // The reference plus a finite field position/size is the durable contract.
    const position = finiteVec3(typed.position?.v);
    const size = finiteVec3(typed.size?.v);
    if (position && size) fields.set(entityId, { position, size });
    const name = typed.label?.text?.trim();
    const protectionChildId = typed.projects_protection?.protectionChildId;
    if (
      name &&
      protectionChildId &&
      position &&
      size &&
      targetCounts.has(name)
    ) {
      parents.push({
        entityId,
        name,
        protectionChildId: String(protectionChildId),
        position,
        size,
      });
    }
  }

  const fieldRecordCount = TARGETS.reduce((sum, [, count]) => sum + count, 0);
  if (fieldRecordCount !== 201) {
    throw new Error(`Expected 201 field records, got ${fieldRecordCount}`);
  }
  const selected = TARGETS.map(([name, count]) => {
    const matching = parents
      .filter((parent) => parent.name === name)
      .sort((left, right) => left.entityId.localeCompare(right.entityId));
    if (matching.length === 0) {
      throw new Error(`${name}: no materialized protection projector found`);
    }
    const parent = matching[0];
    const field = fields.get(parent.protectionChildId);
    return {
      entityId: parent.entityId,
      fieldEntityId: parent.protectionChildId,
      fieldRecordCount: count,
      name: parent.name,
      position: parent.position,
      fieldPosition: field?.position ?? parent.position,
      fieldSize: field?.size ?? parent.size,
    };
  });
  if (selected.length !== 181) {
    throw new Error(`Expected 181 named destinations, got ${selected.length}`);
  }

  const rows = selected
    .map(
      (entry) => `  {
    entityId: ${JSON.stringify(entry.entityId)},
    fieldEntityId: ${JSON.stringify(entry.fieldEntityId)},
    fieldRecordCount: ${entry.fieldRecordCount},
    markerId: ${JSON.stringify(`legacy_protection_field:${entry.fieldEntityId}`)},
    name: ${JSON.stringify(entry.name)},
    position: ${JSON.stringify(entry.position)},
    fieldPosition: ${JSON.stringify(entry.fieldPosition)},
    fieldSize: ${JSON.stringify(entry.fieldSize)},
  },`
    )
    .join("\n");
  await writeFile(
    outputPath,
    `// GENERATED by scripts/node/generate_legacy_protection_escort_destinations.ts.\n` +
      `// Source: snapshot_backup.json legacy materialized protection fields.\n` +
      `import type { Vec3 } from "@/shared/math/types";\n\n` +
      `export interface HarthmereLegacyProtectionEscortDestination {\n` +
      `  entityId: string;\n` +
      `  fieldEntityId: string;\n` +
      `  fieldRecordCount: number;\n` +
      `  markerId: string;\n` +
      `  name: string;\n` +
      `  position: Vec3;\n` +
      `  fieldPosition: Vec3;\n` +
      `  fieldSize: Vec3;\n` +
      `}\n\n` +
      `export const HARTHMERE_LEGACY_PROTECTION_ESCORT_DESTINATIONS: readonly HarthmereLegacyProtectionEscortDestination[] = [\n` +
      rows +
      `\n];\n\n` +
      `const DESTINATION_BY_MARKER_ID = new Map(\n` +
      `  HARTHMERE_LEGACY_PROTECTION_ESCORT_DESTINATIONS.map((destination) => [destination.markerId, destination])\n` +
      `);\n\n` +
      `export function harthmereLegacyProtectionEscortDestinationForMarkerId(markerId: string | undefined) {\n` +
      `  return markerId ? DESTINATION_BY_MARKER_ID.get(markerId) : undefined;\n` +
      `}\n`
  );
  console.log(
    `Wrote ${selected.length} named destinations representing ${fieldRecordCount} materialized fields to ${outputPath}`
  );
}

void main();
