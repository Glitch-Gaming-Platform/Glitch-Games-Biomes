// Clients refresh this on the 750 ms authenticated gate poll. Three minutes
// tolerates a reload or short outage while releasing crashed parties promptly.
const CH1_SLOT_CLAIM_TTL_SECONDS = 3 * 60;

export interface Ch1SlotClaim {
  partyId: string;
  runId: string;
  actorIds: string[];
  startedMs: number;
}

export interface Ch1SlotClaimResult {
  ok: boolean;
  claim?: Ch1SlotClaim;
  created: boolean;
}

export function ch1SlotClaimKey(dungeonId: string) {
  return `harthmere:ch1:slot:${dungeonId}`;
}

const CLAIM_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
local requestedParty = ARGV[1]
local requestedRun = ARGV[2]
local actor = ARGV[3]
local startedMs = tonumber(ARGV[4])
local ttl = tonumber(ARGV[5])
if not raw then
  local created = { partyId=requestedParty, runId=requestedRun, actorIds={actor}, startedMs=startedMs }
  redis.call('SET', KEYS[1], cjson.encode(created), 'EX', ttl)
  return {1, cjson.encode(created), 1}
end
local ok, current = pcall(cjson.decode, raw)
if not ok or type(current) ~= 'table' then
  redis.call('DEL', KEYS[1])
  local created = { partyId=requestedParty, runId=requestedRun, actorIds={actor}, startedMs=startedMs }
  redis.call('SET', KEYS[1], cjson.encode(created), 'EX', ttl)
  return {1, cjson.encode(created), 1}
end
if current.partyId ~= requestedParty then
  return {0, cjson.encode(current), 0}
end
current.actorIds = current.actorIds or {}
local found = false
for _, id in ipairs(current.actorIds) do
  if id == actor then found = true end
end
if not found and #current.actorIds >= 4 then
  return {0, cjson.encode(current), 0}
end
if not found then table.insert(current.actorIds, actor) end
current.runId = current.runId or requestedRun
current.startedMs = current.startedMs or startedMs
redis.call('SET', KEYS[1], cjson.encode(current), 'EX', ttl)
return {1, cjson.encode(current), 0}
`;

const REFRESH_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local ok, current = pcall(cjson.decode, raw)
if not ok or current.partyId ~= ARGV[1] then return 0 end
for _, id in ipairs(current.actorIds or {}) do
  if id == ARGV[2] then
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
    return 1
  end
end
return 0
`;

const RELEASE_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local ok, current = pcall(cjson.decode, raw)
if not ok or current.partyId ~= ARGV[1] then return 0 end
local remaining = {}
for _, id in ipairs(current.actorIds or {}) do
  if id ~= ARGV[2] then table.insert(remaining, id) end
end
if #remaining == 0 then
  redis.call('DEL', KEYS[1])
  return 1
end
current.actorIds = remaining
local ttl = redis.call('TTL', KEYS[1])
if ttl < 1 then ttl = tonumber(ARGV[3]) end
redis.call('SET', KEYS[1], cjson.encode(current), 'EX', ttl)
return 1
`;

function parseClaim(raw: unknown): Ch1SlotClaim | undefined {
  try {
    const parsed = JSON.parse(String(raw)) as Ch1SlotClaim;
    if (
      !parsed.partyId ||
      !parsed.runId ||
      !Array.isArray(parsed.actorIds) ||
      !Number.isFinite(parsed.startedMs)
    ) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

export async function claimCh1Slot(
  redis: { primary: any },
  input: {
    dungeonId: string;
    partyId: string;
    runId: string;
    actorId: string;
    nowMs: number;
  }
): Promise<Ch1SlotClaimResult> {
  const result = (await redis.primary.eval(
    CLAIM_SCRIPT,
    1,
    ch1SlotClaimKey(input.dungeonId),
    input.partyId,
    input.runId,
    input.actorId,
    String(input.nowMs),
    String(CH1_SLOT_CLAIM_TTL_SECONDS)
  )) as [number, string, number];
  return {
    ok: Number(result?.[0]) === 1,
    claim: parseClaim(result?.[1]),
    created: Number(result?.[2]) === 1,
  };
}

export async function refreshCh1Slot(
  redis: { primary: any },
  dungeonId: string,
  partyId: string,
  actorId: string
) {
  return (
    Number(
      await redis.primary.eval(
        REFRESH_SCRIPT,
        1,
        ch1SlotClaimKey(dungeonId),
        partyId,
        actorId,
        String(CH1_SLOT_CLAIM_TTL_SECONDS)
      )
    ) === 1
  );
}

export async function releaseCh1Slot(
  redis: { primary: any },
  dungeonId: string,
  partyId: string,
  actorId: string
) {
  await redis.primary.eval(
    RELEASE_SCRIPT,
    1,
    ch1SlotClaimKey(dungeonId),
    partyId,
    actorId,
    String(CH1_SLOT_CLAIM_TTL_SECONDS)
  );
}
