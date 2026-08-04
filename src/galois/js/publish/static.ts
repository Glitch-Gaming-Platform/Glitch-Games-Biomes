import { getAsset, matchingAssets } from "@/galois/assets";
import type { ExportOutput, Exporter } from "@/galois/assets/scripts/export";
import { isSignal } from "@/galois/interface/types/data";
import {
  AssetContentPathGuard,
  assetContentHashIsLegacySafe,
  publishedAssetContentHash,
} from "@/galois/publish/content_hash";
import {
  getPublicAssetBaseUrl,
  publish,
} from "@/server/web/published_asset_data";
import { ok } from "assert";
import { readFileSync, writeFileSync } from "fs";
import { z } from "zod";

const zAssetIndex = z.object({
  paths: z.record(z.string()),
});

type AssetIndex = z.infer<typeof zAssetIndex>;

function loadAssetIndex(path: string): AssetIndex {
  const data = readFileSync(path).toString();
  return zAssetIndex.parse(JSON.parse(data));
}

class AssetIndexBuilder {
  map = new Map<string, string>();

  constructor(index: AssetIndex) {
    for (const [path, dst] of Object.entries(index.paths)) {
      this.map.set(path, dst);
    }
  }

  add(assetPath: string, filePath: string) {
    this.map.set(assetPath, filePath);
  }

  build() {
    // Sort the entries to ensure they appear in a consistent order in the dump.
    const sortedEntries = Object.fromEntries(
      Array.from(this.map.entries()).sort(([ak, _av], [bk, _bv]) =>
        ak.localeCompare(bk)
      )
    );
    return JSON.stringify(
      {
        paths: sortedEntries,
      },
      null,
      2
    );
  }
}

// HARTHMERE_ASSET_CONTENT_HASH: the hash is now taken over the exported bytes
// rather than over a lossy UTF-8 decode of them. See publish/content_hash.ts for
// the full reasoning and the one-time binary re-upload this implies. String
// payloads (JSON, GLTF) are bit-identical to the old scheme and do not churn.
export function toPublicAssetPath(path: string, result: ExportOutput) {
  const version = publishedAssetContentHash(result.data);
  const filepath = `${path}.${version}.${result.extension}`;
  return `asset_data/${filepath}`;
}

async function publishAssets(
  assetPaths: (RegExp | string)[],
  exporter: Exporter,
  index: AssetIndexBuilder,
  filter: RegExp | undefined,
  dryRun: boolean
) {
  // One guard per run: no two payloads may claim the same immutable path.
  const pathGuard = new AssetContentPathGuard();
  let renamedByHashMigration = 0;
  const assetsUnfiltered = [
    ...new Set(
      assetPaths.flatMap((pathPattern) => {
        if (pathPattern instanceof RegExp) {
          return matchingAssets(pathPattern);
        } else {
          ok(typeof pathPattern === "string");
          return [[pathPattern, getAsset(pathPattern)] as const];
        }
      })
    ),
  ];

  const assets = filter
    ? assetsUnfiltered.filter((x) => filter.test(x[0]))
    : assetsUnfiltered;

  await Promise.all(
    assets.map(async ([path, asset]): Promise<void> => {
      try {
        const result = await exporter.export({ ...asset, name: path });
        const publicRelativePath = toPublicAssetPath(path, result);
        pathGuard.claim(publicRelativePath, path, result.data);
        if (!assetContentHashIsLegacySafe(result.data)) {
          // Binary payload whose previous name came from a lossy decode. It is
          // expected to be renamed exactly once by this migration; counting them
          // makes the size of that one-time re-upload visible in the log rather
          // than a surprise in the bucket bill.
          renamedByHashMigration += 1;
        }

        // Update the asset versions index to include the new data.
        index.add(path, publicRelativePath);

        // Write the data to GCS.
        if (!dryRun) {
          const uploadPromise = publish(publicRelativePath, result.data);
          console.log(
            `Published ${publicRelativePath} to remote asset storage...`
          );
          return await uploadPromise;
        } else {
          console.log(`Built ${publicRelativePath} successfully.`);
        }
      } catch (e) {
        if (isSignal(e) && e.info === "unchanged") {
          return;
        } else {
          console.error(`Error while attempting to export "${path}".`);
          throw e;
        }
      }
    })
  );

  if (renamedByHashMigration > 0) {
    console.log(
      `Byte-exact content hashing applied to ${renamedByHashMigration} binary ` +
        `object(s). Objects whose bytes are unchanged keep their previous name ` +
        `only if that name was already byte-derived; see ` +
        `src/galois/js/publish/content_hash.ts.`
    );
  }
}

export async function publishStaticAssetsAndIndex(
  assetPaths: (RegExp | string)[],
  indexFilePath: string,
  staticAssetHostFilePath: string,
  exporter: Exporter,
  filter: RegExp | undefined,
  dryRun: boolean
) {
  // If we're publishing with a filter active, initialize the VersionIndex with
  // the entries for all of the paths not in the filter since they will not
  // be modified.
  const index = new AssetIndexBuilder(loadAssetIndex(indexFilePath));
  try {
    await publishAssets(assetPaths, exporter, index, filter, dryRun);
  } catch (e) {
    console.log("Error publishing assets: ", e);
    throw e;
  }

  if (!dryRun) {
    writeFileSync(indexFilePath, index.build());
    writeFileSync(
      staticAssetHostFilePath,
      JSON.stringify({
        staticAssetBaseUrl: `${getPublicAssetBaseUrl()}/`,
      })
    );
    console.log(`Updated index "${indexFilePath}"...`);
  }
}
