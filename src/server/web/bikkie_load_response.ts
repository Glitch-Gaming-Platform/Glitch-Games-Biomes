import type { BakedBiscuitTray } from "@/server/shared/bikkie/registry";
import { conformsWith } from "@/shared/bikkie/core";
import { bikkie } from "@/shared/bikkie/schema/biomes";
import type { BiomesId } from "@/shared/ids";
import { zrpcWebSerialize } from "@/shared/zrpc/serde";

// HARTHMERE_BIKKIE_LOAD_RESPONSE_CACHE (2026-08-04 asset loading audit,
// finding 11)
//
// `/api/bikkie` is on every client's boot path and it used to rebuild its entire
// response from scratch on every request:
//
//   * `zrpcWebSerialize(biscuit)` for every biscuit in the tray, and
//   * `conformsWith(schema, biscuit)` for every (biscuit x schema) pair,
//
// with no memoisation, even though a tray is IMMUTABLE and identified by id.
// Under a burst of cold loads (a deploy, a stream, a class of players) that is
// the same large computation repeated per player, on the same Node process that
// serves the game.
//
// Both helpers here are keyed on that immutability:
//   * `encodeBikkieTray` is the pure encode, unchanged in behaviour;
//   * `BikkieLoadResponseCache` keeps the last few encoded trays.
//
// The cache holds more than one entry on purpose: during a rolling deploy or a
// content publish, clients briefly ask for both the outgoing and incoming tray,
// and a single-slot cache would thrash between them.

export interface BikkieLoadResponseData {
  trayId: BiomesId;
  encoded: [BiomesId, string, number[]][];
  schemas: string[];
}

/**
 * Serialize a baked tray into the wire shape the client decodes lazily.
 *
 * Pure: depends only on the tray contents and the compiled schema list.
 */
export function encodeBikkieTray(
  tray: BakedBiscuitTray
): BikkieLoadResponseData {
  const encoded: [BiomesId, string, number[]][] = [];
  const schemas: string[] = [];
  const allSchemas = bikkie.allSchemas();
  for (const [path] of allSchemas) {
    schemas.push(path);
  }
  for (const biscuit of tray.contents.values()) {
    const biscuitSchemas: number[] = [];
    allSchemas.forEach(([, schema], i) => {
      if (conformsWith(schema, biscuit)) {
        biscuitSchemas.push(i);
      }
    });
    encoded.push([biscuit.id, zrpcWebSerialize(biscuit), biscuitSchemas]);
  }
  return { trayId: tray.id, schemas, encoded };
}

/**
 * Small LRU over encoded trays, keyed by the immutable tray id.
 *
 * Entries are shared between requests. They must be treated as read-only; the
 * API handler only serializes them.
 */
export class BikkieLoadResponseCache {
  private readonly entries = new Map<BiomesId, BikkieLoadResponseData>();
  #hits = 0;
  #misses = 0;

  constructor(private readonly maxEntries = 2) {}

  get hits() {
    return this.#hits;
  }

  get misses() {
    return this.#misses;
  }

  get size() {
    return this.entries.size;
  }

  /**
   * @param tray the baked tray to encode, if it is not already cached
   * @param encode injectable for tests; defaults to `encodeBikkieTray`
   */
  encode(
    tray: BakedBiscuitTray,
    encode: (
      tray: BakedBiscuitTray
    ) => BikkieLoadResponseData = encodeBikkieTray
  ): BikkieLoadResponseData {
    const cached = this.entries.get(tray.id);
    if (cached) {
      this.#hits += 1;
      // Refresh recency so a burst on the current tray cannot evict it.
      this.entries.delete(tray.id);
      this.entries.set(tray.id, cached);
      return cached;
    }
    this.#misses += 1;
    const encoded = encode(tray);
    this.entries.set(tray.id, encoded);
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) {
        break;
      }
      this.entries.delete(oldest.value);
    }
    return encoded;
  }

  clear() {
    this.entries.clear();
    this.#hits = 0;
    this.#misses = 0;
  }
}

/**
 * Whether a request should force a Bikkie storage reload.
 *
 * The old handler forced whenever `expectedTrayId !== currentTray.id`, and a
 * cold client sends no `expectedTrayId` at all -- so EVERY first-ever load
 * triggered a full `storage.load()` plus a re-register of the shared runtime.
 *
 * Forcing is only meaningful when the client names a tray this process does not
 * have: that is the case where our view is genuinely behind. With no expectation
 * the current tray is by definition the right answer, and the client learns the
 * id in the response (and any later change through the sync tray-id push).
 */
export function shouldForceTrayRefresh(
  expectedTrayId: BiomesId | undefined,
  currentTrayId: BiomesId
): boolean {
  return expectedTrayId !== undefined && expectedTrayId !== currentTrayId;
}
