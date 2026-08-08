#!/usr/bin/env node

import { matchingAssets } from "@/galois/assets";
import { Exporter } from "@/galois/assets/scripts/export";
import { isSignal } from "@/galois/interface/types/data";
import { toPublicAssetPath } from "@/galois/publish/static";
import { PoolAssetServer } from "@/galois/server/server";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import * as yargs from "yargs";

type AssetIndex = { paths: Record<string, string> };

const rootDir = join(__dirname, "../../../../..");
const galoisDir = join(rootDir, "src/galois");
const indexPath = join(galoisDir, "js/interface/gen/asset_versions.json");
const bucketRoot = join(rootDir, "public/buckets/biomes-static");

async function run() {
  const options = yargs
    .options({
      workers: {
        default: 2,
        type: "number",
        description: "Number of local Galois workers.",
      },
      filter: {
        default: "^harthmere/.*",
        type: "string",
        description: "Logical asset path filter.",
      },
      resume: {
        default: false,
        type: "boolean",
        description:
          "Skip index entries whose export already exists in the local bucket.",
      },
    })
    .strict()
    .help()
    .parseSync();

  const server = new PoolAssetServer(
    galoisDir,
    join(galoisDir, "data"),
    Math.max(1, Math.trunc(options.workers))
  );
  const exporter = new Exporter(server);
  const filter = new RegExp(options.filter);
  const assets = matchingAssets(filter);
  const index = JSON.parse(readFileSync(indexPath, "utf8")) as AssetIndex;
  const writeIndex = () => {
    index.paths = Object.fromEntries(
      Object.entries(index.paths).sort(([a], [b]) => a.localeCompare(b))
    );
    writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  };
  const pendingAssets = options.resume
    ? assets.filter(([logicalPath]) => {
        const publicPath = index.paths[logicalPath];
        return !publicPath || !existsSync(join(bucketRoot, publicPath));
      })
    : assets;
  let completed = assets.length - pendingAssets.length;
  if (completed > 0) {
    console.log(
      `Resuming after ${completed}/${assets.length} existing assets.`
    );
  }

  try {
    await Promise.all(
      pendingAssets.map(async ([logicalPath, asset]) => {
        try {
          const output = await exporter.export({ ...asset, name: logicalPath });
          const publicPath = toPublicAssetPath(logicalPath, output);
          const destination = join(bucketRoot, publicPath);
          mkdirSync(dirname(destination), { recursive: true });
          writeFileSync(destination, output.data);
          index.paths[logicalPath] = publicPath;
          completed += 1;
          if (completed % 25 === 0 || completed === assets.length) {
            writeIndex();
            console.log(
              `Exported ${completed}/${assets.length} Harthmere assets.`
            );
          }
        } catch (error) {
          if (isSignal(error) && error.info === "unchanged") {
            throw new Error(
              `Unexpected incremental cache hit for ${logicalPath}; local publishing must produce bytes.`
            );
          }
          throw error;
        }
      })
    );
  } finally {
    await server.stop();
  }

  writeIndex();
  console.log(`Updated ${indexPath} and ${bucketRoot}.`);
}

if (require.main === module) {
  void run();
}
