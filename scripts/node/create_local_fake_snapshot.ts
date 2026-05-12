import { existsSync, mkdirSync, rmSync, cpSync, writeFileSync } from "fs";
import path from "path";

import { BACKUP_BIKKIE_TRAY_ID } from "@/server/backup/serde";
import { toStoredBiscuit } from "@/server/shared/bikkie/storage/baked";
import { BikkieRuntime, getBiscuits } from "@/shared/bikkie/active";
import { prepareBikkieForTest } from "@/shared/bikkie/test_helpers";
import { zrpcWebSerialize } from "@/shared/zrpc/serde";

async function main() {
  const targetDir = process.argv[2] ?? "/tmp/fake-biomes-snapshot";
  const staticSource = path.resolve("public/buckets/biomes-static");

  if (!existsSync(staticSource)) {
    throw new Error(
      `Missing ${staticSource}. Run: LOCAL_GCS=1 ./b galois assets publish`
    );
  }

  rmSync(targetDir, { recursive: true, force: true });

  mkdirSync(path.join(targetDir, "buckets", "biomes-bikkie"), {
    recursive: true,
  });

  cpSync(staticSource, path.join(targetDir, "buckets", "biomes-static"), {
    recursive: true,
  });

  prepareBikkieForTest();

  const biscuits = getBiscuits().filter((biscuit) => biscuit.id !== 0);

  const baked = {
    id: BACKUP_BIKKIE_TRAY_ID,
    biscuits: biscuits.map((biscuit) => [
      toStoredBiscuit(biscuit),
      `local-test-${biscuit.id}`,
    ]),
  };

  const backup = [
    "Biomes Backup Version 2",
    ["bikkie", zrpcWebSerialize(baked)],
  ];

  writeFileSync(
    path.join(targetDir, "backup.json"),
    JSON.stringify(backup, null, 2)
  );

  console.log(`Created fake local snapshot at ${targetDir}`);
  console.log(`Static assets copied from ${staticSource}`);
  console.log(`Bikkie test biscuits: ${biscuits.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
