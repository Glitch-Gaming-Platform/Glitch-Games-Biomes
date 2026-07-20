import { iterBackupEntriesFromFile } from "@/server/backup/serde";
import { biscuitToJson } from "@/shared/bikkie/schema/attributes";
import { HARTHMERE_GATHERING_AUTHORITY_NODES } from "@/shared/harthmere/gathering_node_authority";
import path from "path";

function normalizedItemName(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function main() {
  const [backupArg, ...termArgs] = process.argv.slice(2);
  const backupPath = path.resolve(backupArg || "snapshot_backup.json");
  const terms = termArgs.map((term) => term.toLowerCase());
  const gatheringItemIds = new Set(
    HARTHMERE_GATHERING_AUTHORITY_NODES.flatMap((node) => [
      ...node.baseYield.map((yieldEntry) => yieldEntry.itemId),
      ...node.rareYield.map((yieldEntry) => yieldEntry.itemId),
    ])
  );

  for await (const [version, entry] of iterBackupEntriesFromFile(backupPath)) {
    if (version !== "bikkie") continue;
    const exactGatheringMatches = new Map<
      string,
      { id: number; name: unknown; displayName: unknown }
    >();
    for (const biscuit of entry.baked.contents.values()) {
      const json = biscuitToJson(biscuit) as Record<string, unknown>;
      const searchable = `${String(json.name ?? "")} ${String(
        json.displayName ?? ""
      )}`.toLowerCase();
      if (terms.length > 0) {
        if (!terms.some((term) => searchable.includes(term))) continue;
        process.stdout.write(
          `${JSON.stringify({
            id: biscuit.id,
            name: json.name,
            displayName: json.displayName,
          })}\n`
        );
        continue;
      }
      for (const itemId of gatheringItemIds) {
        const target = normalizedItemName(itemId);
        if (
          normalizedItemName(json.name) === target ||
          normalizedItemName(json.displayName) === target
        ) {
          exactGatheringMatches.set(itemId, {
            id: biscuit.id,
            name: json.name,
            displayName: json.displayName,
          });
        }
      }
    }
    if (terms.length === 0) {
      for (const [itemId, match] of [...exactGatheringMatches].sort(
        ([a], [b]) => a.localeCompare(b)
      )) {
        process.stdout.write(`${JSON.stringify({ itemId, ...match })}\n`);
      }
      process.stdout.write(
        `${JSON.stringify({
          summary: "exact-gathering-bikkie-coverage",
          exact: exactGatheringMatches.size,
          total: gatheringItemIds.size,
          fullyCoveredNodes: HARTHMERE_GATHERING_AUTHORITY_NODES.filter(
            (node) =>
              [...node.baseYield, ...node.rareYield].every((yieldEntry) =>
                exactGatheringMatches.has(yieldEntry.itemId)
              )
          ).map((node) => node.id),
          missing: [...gatheringItemIds]
            .filter((itemId) => !exactGatheringMatches.has(itemId))
            .sort(),
        })}\n`
      );
    }
    return;
  }
  throw new Error(`No Bikkie tray found in ${backupPath}`);
}

void main();
