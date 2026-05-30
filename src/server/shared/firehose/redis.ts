import type {
  EventBatch,
  Firehose,
  IdempotentFirehoseEvent,
} from "@/server/shared/firehose/api";
import { generateNonce } from "@/server/shared/nonce";
import type { BiomesRedis } from "@/server/shared/redis/connection";
import { idleConsumerGroups } from "@/server/shared/redis/util";
import { leaderboardUpdatesForEvents } from "@/server/shared/world/leaderboard";
import { redisUpdateLeaderboardCounters } from "@/server/shared/world/redis_leaderboard";
import type { RedisStreamId } from "@/server/shared/world/types";
import {
  FIRST_STREAM_ID,
  isPointAtOrAfter,
  streamIdAge,
  streamIdTimestamp,
} from "@/server/shared/world/types";
import { BackgroundTaskController } from "@/shared/abort";
import type { FirehoseEvent } from "@/shared/firehose/events";
import { zFirehoseEvent } from "@/shared/firehose/events";
import { log } from "@/shared/logging";
import { createGauge } from "@/shared/metrics/metrics";
import { compactMap } from "@/shared/util/collections";
import { zrpcDeserialize } from "@/shared/zrpc/serde";
import type { RedisValue } from "ioredis";
import { pack, unpack } from "msgpackr";

const FIREHOSE_KEY = Buffer.from("firehose");
const EVENT_PAYLOAD_FIELD_NAME = Buffer.from("d");

// Convert firehose events to Redis.
export function serializeRedisEvent(
  events: ReadonlyArray<FirehoseEvent>
): Buffer[] {
  return [EVENT_PAYLOAD_FIELD_NAME, pack(events)];
}

// Convert a Redis format event to a firehose event.
export function deserializeRedisEvent(fields: Buffer[]): FirehoseEvent[] {
  if (fields.length % 2 !== 0) {
    throw new Error(
      `Invalid number of fields for event: ${fields.length}: ${fields}`
    );
  }
  const events: FirehoseEvent[] = [];
  for (let i = 0; i < fields.length; i += 2) {
    if (fields[i].equals(EVENT_PAYLOAD_FIELD_NAME)) {
      const eventsData = unpack(fields[i + 1]) as unknown[];
      events.push(
        ...compactMap(eventsData, (data) => {
          try {
            return typeof data === "string"
              ? zrpcDeserialize(Buffer.from(data, "binary"), zFirehoseEvent)
              : zFirehoseEvent.parse(data);
          } catch (error) {
            log.warn("Ignoring invalid firehose event", { error });
          }
        })
      );
    }
  }
  return events;
}

export const firehoseCount = createGauge({
  name: "redis_firehose_count",
  help: "Number of active Redis firehose subscriptions",
});

export const firehoseLag = createGauge({
  name: "redis_firehose_lag",
  help: "The number of milliseconds behind the current time the firehose is",
  labelNames: ["group", "consumer"],
});

class EventIdGenerator {
  private count = 0;
  constructor(private readonly id: RedisStreamId) {}

  next(): string {
    return `${this.id}-${this.count++}`;
  }
}

export class RedisFirehoseSubscription {
  private latestStreamId?: RedisStreamId;
  private supportsXAutoClaim = true;

  constructor(
    private readonly redis: BiomesRedis,
    private readonly group: string,
    private readonly consumer: string,
    private readonly ackTtlMs: number
  ) {}

  private reportLag(streamId: RedisStreamId) {
    if (
      this.latestStreamId !== undefined &&
      isPointAtOrAfter(this.latestStreamId, streamId)
    ) {
      return;
    }
    this.latestStreamId = streamId;
    firehoseLag.set(
      {
        group: this.group,
        consumer: this.consumer,
      },
      streamIdAge(streamId)
    );
  }

  private eventsFromItems(
    items: [RedisStreamId, Buffer[]][]
  ): [RedisStreamId[], IdempotentFirehoseEvent[]] {
    const ackIds: RedisStreamId[] = [];
    const events: IdempotentFirehoseEvent[] = [];
    for (const [id, fields] of items) {
      this.reportLag(id);
      ackIds.push(id);
      const timestamp = streamIdTimestamp(id);
      const generator = new EventIdGenerator(id);
      events.push(
        ...deserializeRedisEvent(fields).map((e) => ({
          ...e,
          timestamp,
          uniqueId: generator.next(),
        }))
      );
    }
    return [ackIds, events];
  }

  private unsupportedCommand(error: unknown, command: string) {
    const message = String((error as { message?: unknown })?.message ?? error)
      .toLowerCase();
    return message.includes("unknown command") && message.includes(command);
  }

  private async getMissedEventsWithXPending(): Promise<
    [RedisStreamId[], IdempotentFirehoseEvent[]]
  > {
    const minIdleMs = this.ackTtlMs * CONFIG.firehoseClientAckMultiplier;
    const pending = (await (this.redis.primary as any).xpendingBuffer(
      FIREHOSE_KEY,
      this.group,
      "-",
      "+",
      CONFIG.firehoseClientBatchSize
    )) as [Buffer, Buffer, Buffer | number | string, Buffer | number | string][];
    const claimIds = pending
      .filter((entry) => Number(entry[2]) >= minIdleMs)
      .map(([id]) => id);
    if (claimIds.length === 0) {
      return [[], []];
    }
    const items = (await (this.redis.primary as any).xclaimBuffer(
      FIREHOSE_KEY,
      this.group,
      this.consumer,
      minIdleMs,
      ...claimIds
    )) as [RedisStreamId, Buffer[]][];
    return this.eventsFromItems(items);
  }

  private async getMissedEvents(): Promise<
    [RedisStreamId[], IdempotentFirehoseEvent[]]
  > {
    try {
      if (!this.supportsXAutoClaim) {
        return await this.getMissedEventsWithXPending();
      }
      const [, items] = await this.redis.primary.xautoclaimBuffer(
        FIREHOSE_KEY,
        this.group,
        this.consumer,
        this.ackTtlMs * CONFIG.firehoseClientAckMultiplier,
        "0-0",
        "COUNT",
        CONFIG.firehoseClientBatchSize
      );
      return this.eventsFromItems(items as [RedisStreamId, Buffer[]][]);
    } catch (error) {
      if (this.supportedXAutoClaimFallback(error)) {
        try {
          return await this.getMissedEventsWithXPending();
        } catch (fallbackError) {
          log.warn("Failed to get missed events with Redis 6 fallback", {
            error: fallbackError,
          });
          return [[], []];
        }
      }
      log.warn("Failed to get missed events", { error });
    }
    return [[], []];
  }

  private supportedXAutoClaimFallback(error: unknown) {
    if (!this.unsupportedCommand(error, "xautoclaim")) {
      return false;
    }
    this.supportsXAutoClaim = false;
    return true;
  }

  private async getMyEvents(
    fromId: RedisValue
  ): Promise<[RedisStreamId[], IdempotentFirehoseEvent[]]> {
    const ackIds: RedisStreamId[] = [];
    const events: IdempotentFirehoseEvent[] = [];
    try {
      const result = await this.redis.primary.xreadgroupBuffer(
        "GROUP",
        this.group,
        this.consumer,
        "COUNT",
        CONFIG.firehoseClientBatchSize,
        "BLOCK",
        1000,
        "STREAMS",
        FIREHOSE_KEY,
        fromId
      );
      if (result !== null) {
        const [[, items]] = result;
        return this.eventsFromItems(items as [RedisStreamId, Buffer[]][]);
      }
    } catch (error) {
      log.error("Failed to get my events", { error });
    }
    return [ackIds, events];
  }

  private async ackEvents(acks: Buffer[]): Promise<void> {
    if (acks.length > 0) {
      await this.redis.primary.xack(FIREHOSE_KEY, this.group, ...acks);
    }
  }

  async *run(signal?: AbortSignal): AsyncIterable<EventBatch> {
    let lastId = FIRST_STREAM_ID;
    let recovering = true;
    while (!signal?.aborted) {
      {
        const [acks, events] = await this.getMissedEvents();
        if (events.length > 0) {
          yield [events, () => this.ackEvents(acks)];
          continue; // Keep processing missed events.
        } else if (acks.length > 0) {
          await this.ackEvents(acks);
        }
      }

      {
        const [acks, events] = await this.getMyEvents(
          recovering ? lastId : ">"
        );
        // Record progress.
        if (acks.length > 0) {
          lastId = acks[acks.length - 1];
        } else {
          recovering = false;
        }
        // Yield events.
        if (events.length > 0) {
          yield [events, () => this.ackEvents(acks)];
        } else if (acks.length > 0) {
          await this.ackEvents(acks);
        }
      }
    }
  }
}

export class RedisFirehose implements Firehose {
  private readonly controller = new BackgroundTaskController();

  constructor(private readonly redis: BiomesRedis) {}

  async stop(): Promise<void> {
    await this.controller.abortAndWait();
    await this.redis.quit("Firehose stopping");
  }

  async publish(...events: ReadonlyArray<FirehoseEvent>): Promise<void> {
    const pipeline = this.redis.primary.multi();
    pipeline.xaddBuffer(
      FIREHOSE_KEY,
      "MAXLEN",
      "~",
      CONFIG.redisMaxFirehoseStreamEntries,
      "*",
      ...serializeRedisEvent(events)
    );
    for (const [category, amount, op, id] of leaderboardUpdatesForEvents(
      events
    )) {
      redisUpdateLeaderboardCounters(pipeline, category, op, amount, id);
    }
    await pipeline.exec();
  }

  private async cleanupGroupConsumers(group: string) {
    const idle = await idleConsumerGroups(
      this.redis.primary,
      FIREHOSE_KEY,
      group,
      CONFIG.firehoseIdleConsumerGroupMs
    );
    if (idle.length === 0) {
      return;
    }
    log.info("Cleaning up idle consumer groups", { idle });
    await Promise.all(
      idle.map((name) =>
        this.redis.primary.xgroup("DELCONSUMER", FIREHOSE_KEY, group, name)
      )
    );
  }

  events(
    group: string,
    ackTtlMs: number,
    signal?: AbortSignal
  ): AsyncIterable<EventBatch> {
    const consumer = generateNonce();
    return this.controller.runGenerator(
      "firehose.subscribe",
      async (signal) => {
        firehoseCount.inc();
        try {
          await this.redis.primary.xgroup(
            "CREATE",
            FIREHOSE_KEY,
            group,
            "$",
            "MKSTREAM"
          );
        } catch (error) {
          // Ignore the error, it's probably fine [due to it already existing].
        }
        return new RedisFirehoseSubscription(
          this.redis,
          group,
          consumer,
          ackTtlMs
        ).run(signal);
      },
      async () => {
        firehoseCount.dec();
        try {
          await this.cleanupGroupConsumers(group);
        } catch (error) {
          log.error("Failed to clean up idle consumer groups", { error });
        }
      },
      signal
    );
  }
}
