import { createHash } from "crypto";
import { hash as sparkHash } from "spark-md5";

// HARTHMERE_ASSET_CONTENT_HASH (2026-08-04 asset loading audit, finding 10)
//
// Static publication names every object after a hash of its bytes:
//
//     asset_data/<logical path>.<content hash>.<extension>
//
// and `docs/galois/publishing-and-serving.md` builds four invariants on top of
// that name -- unchanged output keeps its path, changed output MUST get a new
// one, objects are immutable, and a hash is never allowed to alias a different
// recipe.
//
// The original implementation was:
//
//     const version = hash(result.data.toString());
//
// For a `Buffer`, `.toString()` is a UTF-8 decode. Every byte sequence that is
// not valid UTF-8 collapses to U+FFFD, so the hash was taken over a *lossy*
// projection of a PNG/GLB/WEBM/tensor payload. Two different binaries that
// differ only inside invalid-UTF-8 runs hash identically -- and because the
// publisher treats a matching hash as "unchanged", the result is a silently
// stale object behind a reused, supposedly-immutable path. It also allocated a
// multi-megabyte JS string per asset during publish.
//
// COMPATIBILITY, AND WHY THE STRING PATH IS PRESERVED EXACTLY
//
// `spark-md5`'s `hash(str)` is md5 over the UTF-8 encoding of `str` (verified by
// `content_hash.test.ts` against Node's crypto for ASCII, multi-byte and
// latin-1-ish inputs). So hashing the UTF-8 bytes of a string is bit-identical
// to the legacy result. That matters: `exportJson` and `exportGLTF` return
// strings, which is 742 JSON + 108 GLTF objects in the current index. Those keep
// their published names and do NOT churn.
//
// Only genuinely binary payloads (PNG, GLB, WEBM, Binary) get a different -- and
// now correct -- hash. Those are exactly the objects whose old name was
// untrustworthy. The first `publish` run after this change therefore re-uploads
// them under new names; that is the intended, one-time migration and it is safe
// by construction (new bytes -> new immutable path, old objects untouched for
// rollback, per publication invariants 2-4).
//
// `BIOMES_LEGACY_ASSET_CONTENT_HASH=1` restores the old behaviour for a single
// run if a partial migration ever has to be paused. It is not a supported
// long-term setting: it re-enables the aliasing hazard above.

/**
 * Byte-exact content hash used for published asset filenames.
 *
 * Strings are hashed as their UTF-8 encoding, which is bit-identical to the
 * legacy `spark-md5` result. Buffers are hashed over their raw bytes.
 */
export function assetContentHash(data: Buffer | string): string {
  return createHash("md5")
    .update(typeof data === "string" ? Buffer.from(data, "utf8") : data)
    .digest("hex");
}

/**
 * The pre-2026-08-04 hash: md5 over a lossy UTF-8 decode of the payload.
 * Retained so the migration guard can explain a name change, and so the
 * escape-hatch environment variable has something to call.
 */
export function legacyAssetContentHash(data: Buffer | string): string {
  return sparkHash(data.toString());
}

/**
 * True when the legacy hash happened to be correct for this payload, i.e. the
 * bytes survive a UTF-8 round trip. All strings qualify; binary payloads
 * normally do not.
 *
 * Used by the publisher to report which objects are being renamed by the
 * migration rather than by a real content change.
 */
export function assetContentHashIsLegacySafe(data: Buffer | string): boolean {
  if (typeof data === "string") {
    return true;
  }
  return Buffer.from(data.toString(), "utf8").equals(data);
}

/**
 * Whether this process should keep emitting the legacy (lossy) hash.
 * Opt-in only; see the migration note above.
 */
export function useLegacyAssetContentHash(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return env.BIOMES_LEGACY_ASSET_CONTENT_HASH === "1";
}

/**
 * The hash a publish run should use, honouring the escape hatch.
 */
export function publishedAssetContentHash(
  data: Buffer | string,
  env: NodeJS.ProcessEnv = process.env
): string {
  return useLegacyAssetContentHash(env)
    ? legacyAssetContentHash(data)
    : assetContentHash(data);
}

/**
 * Guards publication invariant 4 within a run: one content path must never be
 * claimed by two different payloads.
 *
 * The legacy hash could produce exactly that -- two distinct binaries mapping to
 * the same lossy string -- and the failure was silent, because the second
 * upload simply overwrote (or was skipped behind) the first. Even with the
 * corrected hash this is worth asserting: an md5 collision, a materializer that
 * returns a shared mutable buffer, or a duplicate logical name in the asset
 * registry would all surface here as a loud error instead of a wrong asset.
 */
export class AssetContentPathGuard {
  private readonly byPath = new Map<
    string,
    { assetPath: string; verifier: string }
  >();

  /**
   * @param publicPath the versioned `asset_data/...` path about to be published
   * @param assetPath the logical Galois path being published
   * @param data the exported payload
   * @throws if a different payload already claimed `publicPath` in this run
   */
  claim(publicPath: string, assetPath: string, data: Buffer | string) {
    // A second, independent digest so the guard does not simply repeat the
    // assumption it is checking.
    const verifier = createHash("sha256")
      .update(typeof data === "string" ? Buffer.from(data, "utf8") : data)
      .digest("hex");
    const existing = this.byPath.get(publicPath);
    if (existing === undefined) {
      this.byPath.set(publicPath, { assetPath, verifier });
      return;
    }
    if (existing.verifier !== verifier) {
      throw new Error(
        `Content path collision: "${publicPath}" is claimed by both ` +
          `"${existing.assetPath}" and "${assetPath}" with different bytes. ` +
          `Publishing would silently serve one asset in place of the other.`
      );
    }
  }

  get size() {
    return this.byPath.size;
  }
}
