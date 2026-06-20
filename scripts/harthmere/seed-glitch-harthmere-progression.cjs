#!/usr/bin/env node
/*
Seed the Glitch backend definitions that the Harthmere client bridge submits.
Requires an administrator JWT, not the title token. The title token is for game-server calls;
these definition endpoints check that the authenticated user is a title administrator.
*/
const DEFAULT_API = "https://api.glitch.fun/api";
const DEFAULT_TITLE_ID = "42de534c-600f-4228-af9e-b69faef94cce";

const apiBase = (process.env.GLITCH_API_BASE_URL || DEFAULT_API).replace(/\/+$/, "");
const titleId = process.env.GLITCH_TITLE_ID || DEFAULT_TITLE_ID;
const jwt = process.env.GLITCH_ADMIN_JWT || process.env.GLITCH_AUTH_TOKEN || "";

if (!jwt) {
  console.error("ERROR: Set GLITCH_ADMIN_JWT to a Glitch user JWT for a title administrator.");
  console.error("Do not use GLITCH_TITLE_TOKEN here; progression definition routes require an admin user.");
  process.exit(1);
}

async function request(method, path, body) {
  const res = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${jwt}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = undefined;
  if (text) {
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
  }
  if (!res.ok) {
    const error = new Error(`${method} ${path} failed: ${res.status} ${text}`);
    error.status = res.status;
    error.json = json;
    throw error;
  }
  return json;
}

function rows(collection) {
  if (Array.isArray(collection)) return collection;
  if (Array.isArray(collection?.data)) return collection.data;
  return [];
}

async function createIfMissing(kind, listPath, createPath, apiKey, body) {
  const existing = rows(await request("GET", listPath));
  const found = existing.find((row) => row.api_key === apiKey);
  if (found) {
    console.log(`OK ${kind} exists: ${apiKey}`);
    return found;
  }
  try {
    const created = await request("POST", createPath, body);
    console.log(`CREATED ${kind}: ${apiKey}`);
    return created?.data || created;
  } catch (error) {
    if (error.status === 422) {
      const retry = rows(await request("GET", listPath)).find((row) => row.api_key === apiKey);
      if (retry) {
        console.log(`OK ${kind} exists after 422: ${apiKey}`);
        return retry;
      }
    }
    throw error;
  }
}

const stats = [
  { api_key: "harthmere_playtime_seconds", display_name: "Harthmere Playtime Seconds", type: "int", aggregation_policy: "sum", increment_only: true, max_delta: 900 },
  { api_key: "harthmere_player_level", display_name: "Harthmere Player Level", type: "int", aggregation_policy: "max", increment_only: true },
  { api_key: "harthmere_xp_current", display_name: "Harthmere Current XP", type: "int", aggregation_policy: "latest", increment_only: false },
  { api_key: "harthmere_gold", display_name: "Harthmere Gold", type: "int", aggregation_policy: "max", increment_only: true },
  { api_key: "harthmere_completed_quests", display_name: "Harthmere Completed Quests", type: "int", aggregation_policy: "max", increment_only: true },
  { api_key: "harthmere_inventory_items", display_name: "Harthmere Inventory Items", type: "int", aggregation_policy: "max", increment_only: true },
  { api_key: "harthmere_enemies_defeated", display_name: "Harthmere Enemies Defeated", type: "int", aggregation_policy: "max", increment_only: true },
];

const leaderboards = [
  { api_key: "harthmere_highest_level", name: "Highest Level", sort_order: "desc", display_type: "score", write_policy: "client" },
  { api_key: "harthmere_richest_traveler", name: "Richest Traveler", sort_order: "desc", display_type: "currency", write_policy: "client" },
  { api_key: "harthmere_quest_completion_score", name: "Quest Completion", sort_order: "desc", display_type: "score", write_policy: "client" },
  { api_key: "harthmere_playtime_score", name: "Harthmere Playtime", sort_order: "desc", display_type: "score", write_policy: "client" },
];

const achievements = [
  { api_key: "harthmere_first_steps", name: "First Steps in Harthmere", description: "Play Harthmere for at least one minute.", stat: "harthmere_playtime_seconds", unlock_threshold: 60 },
  { api_key: "harthmere_level_5", name: "Apprentice Adventurer", description: "Reach level 5 in Harthmere.", stat: "harthmere_player_level", unlock_threshold: 5 },
  { api_key: "harthmere_quester", name: "Helpful Traveler", description: "Complete your first Harthmere quest.", stat: "harthmere_completed_quests", unlock_threshold: 1 },
  { api_key: "harthmere_collector", name: "Pack Rat", description: "Carry or store at least 10 tracked items.", stat: "harthmere_inventory_items", unlock_threshold: 10 },
  { api_key: "harthmere_veteran", name: "One Hour in Harthmere", description: "Play Harthmere for one hour.", stat: "harthmere_playtime_seconds", unlock_threshold: 3600 },
];

(async () => {
  const statPath = `/titles/${titleId}/progression/stats`;
  const leaderboardPath = `/titles/${titleId}/progression/leaderboards`;
  const achievementPath = `/titles/${titleId}/progression/achievements`;

  const statByApiKey = new Map();
  for (const stat of stats) {
    const result = await createIfMissing("stat", statPath, statPath, stat.api_key, stat);
    statByApiKey.set(stat.api_key, result);
  }

  for (const board of leaderboards) {
    await createIfMissing("leaderboard", leaderboardPath, leaderboardPath, board.api_key, board);
  }

  for (const achievement of achievements) {
    const stat = statByApiKey.get(achievement.stat);
    await createIfMissing("achievement", achievementPath, achievementPath, achievement.api_key, {
      api_key: achievement.api_key,
      name: achievement.name,
      description: achievement.description,
      progress_stat_id: stat?.id,
      unlock_threshold: achievement.unlock_threshold,
      is_hidden: false,
    });
  }

  console.log("DONE Harthmere Glitch progression definitions are seeded.");
})().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
