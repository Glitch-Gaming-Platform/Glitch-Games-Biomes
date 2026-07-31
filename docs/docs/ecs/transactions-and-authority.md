# Transactions and authority

The native ECS uses optimistic transactions. A transaction is a `ChangeToApply` with four independent parts:

| Field      | Purpose                                                         |
| ---------- | --------------------------------------------------------------- |
| `iffs`     | Preconditions checked before applying changes                   |
| `changes`  | Tick-free create, update, or delete proposals                   |
| `events`   | Firehose events published only for a successful transaction     |
| `catchups` | Requests for changes newer than a caller's known entity version |

Each transaction succeeds or aborts as a unit. A batch preserves transaction order and returns one outcome per transaction. An aborted transaction must not publish its proposed entity changes or events.

## Optimistic preconditions

An `Iff` has one of these shapes:

| Shape                          | Meaning                                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `[id]`                         | Assert the entity does not currently exist                                                                |
| `[id, tick]`                   | Assert the entity as a whole has not advanced beyond `tick`; `tick = 0` is used for absence/create checks |
| `[id, tick, componentId, ...]` | Assert only the listed components have not advanced beyond `tick`                                         |

Component-aware preconditions allow independent systems to update different components of one entity without forcing unnecessary retries. They are safe only if the transaction records every component whose value influenced the decision.

`WorldEditor` automates this for straightforward edits. It caches reads, wraps them in patchable lazy entities, records accessed component IDs, emits only changed components, and throws `WorldEditConflictError` if the apply aborts. A read-only edit does not issue a transaction.

Logic handlers use `ChangeSet` and versioned entity sources for the same purpose at a larger scope. Catch-ups allow a failed or stale caller to receive the authoritative changes needed to bring its local view forward.

## Authority model

The transaction engine provides atomicity and conflict detection. It does not grant permission.

| Caller                             | Expected authority path                                                                                                            |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Player/client action               | Generated event to a logic handler, including ACL and gameplay validation                                                          |
| Logic server                       | Builds component-aware `ChangeSet` transactions after validating the event                                                         |
| Trusted simulation service         | Writes only the entities/components owned by that service, with optimistic preconditions where decisions depend on current state   |
| Administrative or maintenance tool | Explicitly authenticated privileged path, narrow scope, and auditable changes                                                      |
| Signed untrusted apply             | Integrity-protected request bound to a user, payload checksum, and short timestamp window; still subject to endpoint authorization |

The untrusted-apply signature uses HS512, includes the user ID, covers a checksum of the normalized transaction payload, and expires after a short window. A changed payload, wrong user, malformed token, or stale timestamp must fail validation.

## Regular and high-frequency components

Most state uses the regular-change Redis world, which supports `iffs`, events, catch-ups, and authoritative ticks. A small generated set of high-frequency components is stored in HFC Redis: currently position, orientation, rigid body, emote, and NPC state.

HFC itself does not support optimistic transactions or event publishing. Routing code must not silently put mixed regular/HFC decisions into an unsupported transaction. Hybrid reads and subscriptions merge the two stores, while the regular world remains the authority for transaction outcomes and entity existence.

## Failure and retry rules

- Treat `aborted` as an expected optimistic conflict, not as partial success.
- Re-read the required state before rebuilding a transaction; do not blindly replay a decision made from stale values.
- Keep external side effects outside the retryable ECS transaction unless they are idempotent and coordinated by a durable event/outbox pattern.
- Preserve transaction ordering when later changes depend on earlier successful changes.
- Request catch-ups when a long-lived local view needs to reconcile after conflicts.
