import assert from "assert";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GuildsTab } from "../tabs/GuildsTab";

describe("Biomes UI guild tab", () => {
  it("renders live guild invites with accept and decline actions", () => {
    const html = renderToStaticMarkup(
      <GuildsTab
        adapter={{
          isHydrated: () => true,
          getSnapshot: () => ({
            actorId: "player_guild_ui_001",
            permissions: {},
            finder: [],
            pendingApplications: [],
            pendingInvites: [{
              inviteId: "guild_invite_ui_1",
              guildId: "guild_iron_1",
              targetActorId: "player_guild_ui_001",
              invitedByActorId: "guild_leader_001",
              targetDisplayName: "UI Player",
              status: "pending",
              createdAtMs: 1_700_000_000_000,
              expiresAtMs: 1_700_086_400_000,
            }],
          }),
          getPendingInvites: () => [{
            inviteId: "guild_invite_ui_1",
            guildId: "guild_iron_1",
            targetActorId: "player_guild_ui_001",
            invitedByActorId: "guild_leader_001",
            targetDisplayName: "UI Player",
            status: "pending",
            createdAtMs: 1_700_000_000_000,
            expiresAtMs: 1_700_086_400_000,
          }],
        }}
      />,
    );

    assert.ok(html.includes("guild_iron_1"));
    assert.ok(html.includes("Accept Invite"));
    assert.ok(html.includes("Decline Invite"));
  });
});
