/// <reference types="mocha" />

import assert from "assert";
import { mkdtemp, readFile, rm } from "fs/promises";
import os from "os";
import path from "path";
import { uploadToBucket } from "./cloud_storage";

describe("local cloud storage", () => {
  it("creates one new image directory safely for concurrent bundle uploads", async () => {
    const previousCwd = process.cwd();
    const previousLocalGcs = process.env.LOCAL_GCS;
    const root = await mkdtemp(path.join(os.tmpdir(), "biomes-local-storage-"));
    process.chdir(root);
    process.env.LOCAL_GCS = "1";

    try {
      const writes = Array.from({ length: 5 }, (_, index) => ({
        relativePath: `123/profile_pic/image-${index}.webp`,
        bytes: Buffer.from(`image-${index}`),
      }));
      await Promise.all(
        writes.map(({ relativePath, bytes }) =>
          uploadToBucket("biomes-social", relativePath, bytes, "image/webp")
        )
      );

      for (const { relativePath, bytes } of writes) {
        assert.deepStrictEqual(
          await readFile(
            path.join(root, "public", "buckets", "biomes-social", relativePath)
          ),
          bytes
        );
      }
    } finally {
      process.chdir(previousCwd);
      if (previousLocalGcs === undefined) {
        delete process.env.LOCAL_GCS;
      } else {
        process.env.LOCAL_GCS = previousLocalGcs;
      }
      await rm(root, { recursive: true, force: true });
    }
  });
});
