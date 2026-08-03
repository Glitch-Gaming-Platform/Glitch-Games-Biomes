# Harthmere Player Invites

The replacement HUD adds **Invite Friends** below the existing Recipes and
Quests shortcuts. Press **0** or click that row to open the invite panel. The
number-row key avoids macOS function-key behavior and is not assigned to the
nine-slot hotbar or another HUD option.

## Player flow

1. The inviter opens the panel. The server captures their authoritative ECS
   identity and current position, then creates an eight-character code that
   expires after one hour.
2. **Copy Invite Link** copies the Glitch `/games/<title>/play?invite_code=...`
   URL. The link never points directly at the game runtime.
3. The game reads the code from its launch URL. The Wake Up screen does not ask
   the player to paste or re-enter it.
4. After Wake Up completes and the invitee's ECS player is ready, the server
   resolves the inviter's latest position and publishes a zero-cost native
   `WarpEvent` for the invitee.

The August 2, 2026 HAR showed that the current Glitch web launcher dropped the
`invite_code` before creating the game iframe. This is a platform handoff
blocker, not permission to add a manual code-entry step. Acceptance requires
the code to reach the game launch URL automatically.

## Edge cases

- Codes are normalized case-insensitively and tolerate spaces or a hyphen.
- Expired, unknown, self-owned, and incomplete codes fail with friendly text.
- Joining is idempotent per player/code, so reloads cannot repeatedly warp a
  player. Concurrent duplicate requests acquire one atomic claim, and a failed
  warp releases that claim so the player can retry safely.
- **New Code** immediately revokes the inviter's previous code instead of
  leaving two valid invitations active for the rest of the one-hour TTL.
- The inviter's current coordinates win over the creation snapshot.
- Chapter 1 portal-only/void destinations are rejected; friends cannot bypass
  signed fracture-gate admission.
- Redis is required for cross-replica production invites. Local development
  falls back to the process-local store used by focused tests.

## Focused verification

```bash
scripts/harthmere/t.sh file src/server/glitch/test/harthmere_player_invites.e2e.test.ts
scripts/harthmere/t.sh file src/client/game/invites/player_invites.test.ts
scripts/harthmere/t.sh file src/client/components/playerCommunicationHotkeys.test.ts
scripts/harthmere/t.sh file src/client/components/system/PlayerCommunicationHUD.browser.test.tsx
scripts/harthmere/t.sh types
```
