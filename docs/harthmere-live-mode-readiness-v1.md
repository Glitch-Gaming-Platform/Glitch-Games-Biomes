# Harthmere Live Mode Readiness v1

This patch implements the remaining requirements as live-mode-ready contracts and tests. It does not claim that the production multiplayer backend exists yet. Instead, it makes the combat/progression layer ready for live mode by defining the authoritative envelopes, required action pipelines, persistence mutation plans, idempotency rules, UI event outbox, audit logs, and end-to-end simulation scenarios that the eventual live server must call.

## What is now live-mode ready

- Attacks and ability casts must enter `validateHarthmereLiveModeAuthorityEnvelopeV1` before mutation.
- Client-authoritative fields such as claimed hit result, damage, death state, XP, loot, PvP legality, raid credit, and respawn acceptance are rejected before any mutation.
- Every live action has a mutation plan with required locks, read/write models, rollback behavior, append-only audit logs, and UI event outbox entries.
- Combat, ability, equipment, XP, skill, loot, death, revive, respawn, NPC AI, boss, PvP, party, raid, trainer, skill book, respec, loadout, audit, UI, and anti-abuse subsystems are covered by required pipelines.
- Death recap, respawn map, forced respawn, wave respawn, and revive prompts are represented as server-generated UI payloads.
- End-to-end live scenarios are represented without depending on the actual live server.

## Production handoff rule

When live mode exists, the server should call this module before it mutates combat/progression state. The client may request actions and display UI events, but cannot decide hit validation, damage, death, reward, loot, PvP legality, raid credit, respawn validity, or NPC/boss decisions.
