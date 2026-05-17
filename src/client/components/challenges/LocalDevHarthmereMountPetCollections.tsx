
import React, { useEffect, useMemo, useState } from "react";

export const HARTHMERE_MOUNT_PET_COLLECTION_VERSION = "harthmere-mount-pet-collection-v1";
export const HARTHMERE_MOUNT_PET_LOCAL_STORAGE_KEYS = {
  collection: "biomes.localDev.harthmere.mountPetCollection.v1",
  recent: "biomes.localDev.harthmere.mountPetCollection.recent.v1",
};

export type HarthmereCollectionBinding = "character_bound" | "account_bound" | "stable_bound";
export type HarthmereMountMovement = "ground" | "swim" | "glide" | "draft";
export type HarthmerePetRole = "companion" | "scout" | "utility" | "combat_assist" | "cosmetic";
export type HarthmereMountEquipmentSlot = "saddle" | "bags" | "shoes" | "tack" | "charm";
export type HarthmerePetAbilitySlot = "passive" | "active_1" | "active_2" | "utility";

export type HarthmereMountDefinition = {
  id: string;
  name: string;
  source: string;
  movement: HarthmereMountMovement;
  binding: HarthmereCollectionBinding;
  learnedTokenItemId: string;
  hotbarUse: boolean;
  cannotSellAfterLearned: true;
  equipmentSlots: HarthmereMountEquipmentSlot[];
  stableServices: string[];
  speedModifier: number;
};

export type HarthmerePetDefinition = {
  id: string;
  name: string;
  source: string;
  role: HarthmerePetRole;
  binding: HarthmereCollectionBinding;
  learnedTokenItemId: string;
  hotbarUse: boolean;
  cannotSellAfterLearned: true;
  abilitySlots: HarthmerePetAbilitySlot[];
  stableServices: string[];
};

export type HarthmereMountPetLog = {
  id: string;
  at: number;
  action: string;
  detail: string;
  success: boolean;
  reason?: string;
};

export type HarthmereMountPetCollectionState = {
  version: 1;
  learnedMounts: Record<string, { learnedAt: number; binding: HarthmereCollectionBinding; source: string }>;
  learnedPets: Record<string, { learnedAt: number; binding: HarthmereCollectionBinding; source: string }>;
  mountEquipment: Record<string, Partial<Record<HarthmereMountEquipmentSlot, string>>>;
  petAbilitySlots: Record<string, Partial<Record<HarthmerePetAbilitySlot, string>>>;
  hotbar: {
    mountHotbarSlot?: string;
    petHotbarSlot?: string;
  };
  activeMountId?: string;
  activePetId?: string;
  stable: {
    boardedMounts: string[];
    boardedPets: string[];
    serviceNpcOffsets: number[];
    lastService?: string;
  };
  recent: HarthmereMountPetLog[];
};

export const HARTHMERE_MOUNT_DEFINITIONS: Record<string, HarthmereMountDefinition> = {
  harthmere_pony: {
    id: "harthmere_pony",
    name: "Harthmere Pony",
    source: "North Gate Stable starter service",
    movement: "ground",
    binding: "character_bound",
    learnedTokenItemId: "mount_token_harthmere_pony",
    hotbarUse: true,
    cannotSellAfterLearned: true,
    equipmentSlots: ["saddle", "bags", "shoes", "tack", "charm"],
    stableServices: ["summon", "stable", "feed", "rename", "equip_mount_gear"],
    speedModifier: 1.35,
  },
  river_mule: {
    id: "river_mule",
    name: "River Mule",
    source: "River Docks cargo reputation reward",
    movement: "draft",
    binding: "account_bound",
    learnedTokenItemId: "mount_token_river_mule",
    hotbarUse: true,
    cannotSellAfterLearned: true,
    equipmentSlots: ["saddle", "bags", "shoes", "tack"],
    stableServices: ["summon", "stable", "cargo_bags", "equip_mount_gear"],
    speedModifier: 1.18,
  },
};

export const HARTHMERE_PET_DEFINITIONS: Record<string, HarthmerePetDefinition> = {
  tavern_cat: {
    id: "tavern_cat",
    name: "Copper Kettle Cat",
    source: "Copper Kettle Inn friendship unlock",
    role: "companion",
    binding: "account_bound",
    learnedTokenItemId: "pet_token_tavern_cat",
    hotbarUse: true,
    cannotSellAfterLearned: true,
    abilitySlots: ["passive", "utility"],
    stableServices: ["summon", "stable", "rename", "assign_pet_ability"],
  },
  mudden_ratcatcher_dog: {
    id: "mudden_ratcatcher_dog",
    name: "Mudden Ratcatcher Dog",
    source: "Mudden Ward rat contract reward",
    role: "scout",
    binding: "character_bound",
    learnedTokenItemId: "pet_token_mudden_ratcatcher_dog",
    hotbarUse: true,
    cannotSellAfterLearned: true,
    abilitySlots: ["passive", "active_1", "utility"],
    stableServices: ["summon", "stable", "train", "assign_pet_ability"],
  },
};

export const HARTHMERE_MOUNT_EQUIPMENT_DEFINITIONS = {
  plain_saddle: { slot: "saddle", stat: "comfort", value: 1, bindOnEquip: true },
  small_saddlebags: { slot: "bags", stat: "carry_slots", value: 4, bindOnEquip: true },
  iron_horseshoes: { slot: "shoes", stat: "road_speed", value: 0.05, bindOnEquip: true },
  stable_tack: { slot: "tack", stat: "control", value: 1, bindOnEquip: true },
  warding_charm: { slot: "charm", stat: "fear_resist", value: 1, bindOnEquip: true },
} satisfies Record<string, { slot: HarthmereMountEquipmentSlot; stat: string; value: number; bindOnEquip: boolean }>;

export const HARTHMERE_PET_ABILITY_DEFINITIONS = {
  cozy_presence: { slot: "passive", role: "companion", cooldownMs: 0, description: "Small morale bonus while resting." },
  sniff_contraband: { slot: "utility", role: "scout", cooldownMs: 30_000, description: "Marks suspicious containers without stealing from them." },
  bark_warning: { slot: "active_1", role: "scout", cooldownMs: 20_000, description: "Warns about nearby danger or witnessed crimes." },
  fetch_small_item: { slot: "active_2", role: "utility", cooldownMs: 45_000, description: "Fetches a small legal item after ownership validation." },
} satisfies Record<string, { slot: HarthmerePetAbilitySlot; role: HarthmerePetRole | "utility"; cooldownMs: number; description: string }>;

export const HARTHMERE_STABLE_SERVICE_NPCS = [
  { offset: 57, name: "North Gate Stable Master", services: ["mount_unlock", "mount_equipment", "summon", "stable", "feed"] },
  { offset: 65, name: "River Dock Stable Hand", services: ["cargo_mounts", "mount_repair", "summon"] },
  { offset: 9, name: "Copper Kettle Pet Keeper", services: ["pet_unlock", "pet_ability_slots", "rename", "stable"] },
];

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function logEntry(action: string, detail: string, success = true, reason?: string): HarthmereMountPetLog {
  return { id: `hm-mp-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`, at: Date.now(), action, detail, success, reason };
}

export function emptyHarthmereMountPetCollectionState(): HarthmereMountPetCollectionState {
  return {
    version: 1,
    learnedMounts: {},
    learnedPets: {},
    mountEquipment: {},
    petAbilitySlots: {},
    hotbar: {},
    stable: { boardedMounts: [], boardedPets: [], serviceNpcOffsets: HARTHMERE_STABLE_SERVICE_NPCS.map((npc) => npc.offset) },
    recent: [],
  };
}

function normalizeState(input: Partial<HarthmereMountPetCollectionState> | undefined): HarthmereMountPetCollectionState {
  const base = emptyHarthmereMountPetCollectionState();
  if (!input || input.version !== 1) {
    return base;
  }
  return {
    ...base,
    ...input,
    learnedMounts: input.learnedMounts ?? {},
    learnedPets: input.learnedPets ?? {},
    mountEquipment: input.mountEquipment ?? {},
    petAbilitySlots: input.petAbilitySlots ?? {},
    hotbar: input.hotbar ?? {},
    stable: { ...base.stable, ...(input.stable ?? {}) },
    recent: Array.isArray(input.recent) ? input.recent.slice(0, 40) : [],
  };
}

export function readHarthmereMountPetCollectionState(): HarthmereMountPetCollectionState {
  if (!isBrowser()) {
    return emptyHarthmereMountPetCollectionState();
  }
  try {
    return normalizeState(JSON.parse(window.localStorage.getItem(HARTHMERE_MOUNT_PET_LOCAL_STORAGE_KEYS.collection) || "null"));
  } catch {
    return emptyHarthmereMountPetCollectionState();
  }
}

export function writeHarthmereMountPetCollectionState(state: HarthmereMountPetCollectionState) {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(HARTHMERE_MOUNT_PET_LOCAL_STORAGE_KEYS.collection, JSON.stringify(normalizeState(state)));
  window.dispatchEvent(new Event("biomes:harthmere-mount-pet-collection"));
}

function append(state: HarthmereMountPetCollectionState, action: string, detail: string, success = true, reason?: string) {
  return { ...state, recent: [logEntry(action, detail, success, reason), ...state.recent].slice(0, 40) };
}

export function learnHarthmereMount(mountId: string, source = "unknown") {
  let state = readHarthmereMountPetCollectionState();
  const def = HARTHMERE_MOUNT_DEFINITIONS[mountId];
  if (!def) {
    state = append(state, "Mount Unlock Failed", mountId, false, "unknown_mount");
    writeHarthmereMountPetCollectionState(state);
    return { ok: false, reason: "unknown_mount" as const };
  }
  if (state.learnedMounts[mountId]) {
    state = append(state, "Mount Unlock Ignored", def.name, false, "duplicate_unlock");
    writeHarthmereMountPetCollectionState(state);
    return { ok: false, reason: "duplicate_unlock" as const };
  }
  state = {
    ...state,
    learnedMounts: { ...state.learnedMounts, [mountId]: { learnedAt: Date.now(), binding: def.binding, source } },
  };
  writeHarthmereMountPetCollectionState(append(state, "Mount Learned", `${def.name} learned from ${source}.`));
  return { ok: true, mountId, binding: def.binding };
}

export function learnHarthmerePet(petId: string, source = "unknown") {
  let state = readHarthmereMountPetCollectionState();
  const def = HARTHMERE_PET_DEFINITIONS[petId];
  if (!def) {
    state = append(state, "Pet Unlock Failed", petId, false, "unknown_pet");
    writeHarthmereMountPetCollectionState(state);
    return { ok: false, reason: "unknown_pet" as const };
  }
  if (state.learnedPets[petId]) {
    state = append(state, "Pet Unlock Ignored", def.name, false, "duplicate_unlock");
    writeHarthmereMountPetCollectionState(state);
    return { ok: false, reason: "duplicate_unlock" as const };
  }
  state = {
    ...state,
    learnedPets: { ...state.learnedPets, [petId]: { learnedAt: Date.now(), binding: def.binding, source } },
  };
  writeHarthmereMountPetCollectionState(append(state, "Pet Learned", `${def.name} learned from ${source}.`));
  return { ok: true, petId, binding: def.binding };
}

export function canSellHarthmereMountOrPetToken(itemId: string, state = readHarthmereMountPetCollectionState()) {
  const learnedMount = Object.values(HARTHMERE_MOUNT_DEFINITIONS).find((def) => def.learnedTokenItemId === itemId && state.learnedMounts[def.id]);
  const learnedPet = Object.values(HARTHMERE_PET_DEFINITIONS).find((def) => def.learnedTokenItemId === itemId && state.learnedPets[def.id]);
  if (learnedMount || learnedPet) {
    return { ok: false, reason: "Mount/pet unlock tokens become collection records and cannot be sold after learned." };
  }
  return { ok: true };
}

export function slotHarthmereMountHotbar(mountId: string) {
  let state = readHarthmereMountPetCollectionState();
  if (!state.learnedMounts[mountId]) {
    state = append(state, "Mount Hotbar Failed", mountId, false, "not_learned");
    writeHarthmereMountPetCollectionState(state);
    return { ok: false, reason: "not_learned" as const };
  }
  state = { ...state, hotbar: { ...state.hotbar, mountHotbarSlot: mountId } };
  writeHarthmereMountPetCollectionState(append(state, "Mount Slotted", mountId));
  return { ok: true, mountId };
}

export function slotHarthmerePetHotbar(petId: string) {
  let state = readHarthmereMountPetCollectionState();
  if (!state.learnedPets[petId]) {
    state = append(state, "Pet Hotbar Failed", petId, false, "not_learned");
    writeHarthmereMountPetCollectionState(state);
    return { ok: false, reason: "not_learned" as const };
  }
  state = { ...state, hotbar: { ...state.hotbar, petHotbarSlot: petId } };
  writeHarthmereMountPetCollectionState(append(state, "Pet Slotted", petId));
  return { ok: true, petId };
}

export function useHarthmereMountFromHotbar() {
  let state = readHarthmereMountPetCollectionState();
  const mountId = state.hotbar.mountHotbarSlot;
  if (!mountId || !state.learnedMounts[mountId]) {
    state = append(state, "Mount Summon Failed", mountId ?? "none", false, "missing_hotbar_mount");
    writeHarthmereMountPetCollectionState(state);
    return { ok: false, reason: "missing_hotbar_mount" as const };
  }
  state = { ...state, activeMountId: mountId };
  writeHarthmereMountPetCollectionState(append(state, "Mount Summoned", mountId));
  return { ok: true, mountId };
}

export function useHarthmerePetFromHotbar() {
  let state = readHarthmereMountPetCollectionState();
  const petId = state.hotbar.petHotbarSlot;
  if (!petId || !state.learnedPets[petId]) {
    state = append(state, "Pet Summon Failed", petId ?? "none", false, "missing_hotbar_pet");
    writeHarthmereMountPetCollectionState(state);
    return { ok: false, reason: "missing_hotbar_pet" as const };
  }
  state = { ...state, activePetId: petId };
  writeHarthmereMountPetCollectionState(append(state, "Pet Summoned", petId));
  return { ok: true, petId };
}

export function equipHarthmereMountEquipment(mountId: string, equipmentItemId: string) {
  let state = readHarthmereMountPetCollectionState();
  const mount = HARTHMERE_MOUNT_DEFINITIONS[mountId];
  const equip = HARTHMERE_MOUNT_EQUIPMENT_DEFINITIONS[equipmentItemId as keyof typeof HARTHMERE_MOUNT_EQUIPMENT_DEFINITIONS];
  if (!mount || !state.learnedMounts[mountId]) {
    state = append(state, "Mount Equipment Failed", mountId, false, "mount_not_learned");
    writeHarthmereMountPetCollectionState(state);
    return { ok: false, reason: "mount_not_learned" as const };
  }
  if (!equip || !mount.equipmentSlots.includes(equip.slot)) {
    state = append(state, "Mount Equipment Failed", equipmentItemId, false, "invalid_slot");
    writeHarthmereMountPetCollectionState(state);
    return { ok: false, reason: "invalid_slot" as const };
  }
  state = { ...state, mountEquipment: { ...state.mountEquipment, [mountId]: { ...(state.mountEquipment[mountId] ?? {}), [equip.slot]: equipmentItemId } } };
  writeHarthmereMountPetCollectionState(append(state, "Mount Equipment Equipped", `${equipmentItemId} -> ${mount.name}`));
  return { ok: true, mountId, slot: equip.slot };
}

export function assignHarthmerePetAbilitySlot(petId: string, abilityId: string, slot?: HarthmerePetAbilitySlot) {
  let state = readHarthmereMountPetCollectionState();
  const pet = HARTHMERE_PET_DEFINITIONS[petId];
  const ability = HARTHMERE_PET_ABILITY_DEFINITIONS[abilityId as keyof typeof HARTHMERE_PET_ABILITY_DEFINITIONS];
  const targetSlot = slot ?? ability?.slot;
  if (!pet || !state.learnedPets[petId]) {
    state = append(state, "Pet Ability Failed", petId, false, "pet_not_learned");
    writeHarthmereMountPetCollectionState(state);
    return { ok: false, reason: "pet_not_learned" as const };
  }
  if (!ability || !targetSlot || !pet.abilitySlots.includes(targetSlot)) {
    state = append(state, "Pet Ability Failed", abilityId, false, "invalid_ability_slot");
    writeHarthmereMountPetCollectionState(state);
    return { ok: false, reason: "invalid_ability_slot" as const };
  }
  state = { ...state, petAbilitySlots: { ...state.petAbilitySlots, [petId]: { ...(state.petAbilitySlots[petId] ?? {}), [targetSlot]: abilityId } } };
  writeHarthmereMountPetCollectionState(append(state, "Pet Ability Assigned", `${abilityId} -> ${pet.name}.${targetSlot}`));
  return { ok: true, petId, slot: targetSlot };
}

export function runHarthmereStableService(offset: number, service: string, targetId?: string) {
  let state = readHarthmereMountPetCollectionState();
  const npc = HARTHMERE_STABLE_SERVICE_NPCS.find((entry) => entry.offset === offset);
  if (!npc || !npc.services.includes(service)) {
    state = append(state, "Stable Service Failed", `${offset}:${service}`, false, "service_unavailable");
    writeHarthmereMountPetCollectionState(state);
    return { ok: false, reason: "service_unavailable" as const };
  }
  if (service === "stable" && targetId) {
    const boardedMounts = state.learnedMounts[targetId] ? Array.from(new Set([...state.stable.boardedMounts, targetId])) : state.stable.boardedMounts;
    const boardedPets = state.learnedPets[targetId] ? Array.from(new Set([...state.stable.boardedPets, targetId])) : state.stable.boardedPets;
    state = { ...state, activeMountId: state.activeMountId === targetId ? undefined : state.activeMountId, activePetId: state.activePetId === targetId ? undefined : state.activePetId, stable: { ...state.stable, boardedMounts, boardedPets, lastService: service } };
  } else {
    state = { ...state, stable: { ...state.stable, lastService: service } };
  }
  writeHarthmereMountPetCollectionState(append(state, "Stable Service", `${npc.name}: ${service}`));
  return { ok: true, npc: npc.name, service };
}

export function resetHarthmereMountPetCollectionState() {
  writeHarthmereMountPetCollectionState(emptyHarthmereMountPetCollectionState());
}

export function useHarthmereMountPetCollectionState() {
  const [state, setState] = useState(readHarthmereMountPetCollectionState);
  useEffect(() => {
    const onChange = () => setState(readHarthmereMountPetCollectionState());
    window.addEventListener("biomes:harthmere-mount-pet-collection", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("biomes:harthmere-mount-pet-collection", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return state;
}

export const HarthmereMountPetCollectionPanel: React.FunctionComponent<{}> = () => {
  const state = useHarthmereMountPetCollectionState();
  const mounts = useMemo(() => Object.values(HARTHMERE_MOUNT_DEFINITIONS), []);
  const pets = useMemo(() => Object.values(HARTHMERE_PET_DEFINITIONS), []);
  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs" data-harthmere-mount-pet-panel="v1">
      <div className="text-sm font-bold text-amber-100">Mounts & Pets</div>
      <div className="grid gap-2 md:grid-cols-2">
        <div>
          <div className="font-semibold text-white/80">Mount Collection</div>
          {mounts.map((mount) => (
            <div key={mount.id} className="rounded-lg bg-black/30 p-2">
              <div className="font-semibold">{mount.name}</div>
              <div className="text-white/60">{state.learnedMounts[mount.id] ? "Learned" : "Locked"} · {mount.binding} · {mount.movement}</div>
            </div>
          ))}
        </div>
        <div>
          <div className="font-semibold text-white/80">Pet Collection</div>
          {pets.map((pet) => (
            <div key={pet.id} className="rounded-lg bg-black/30 p-2">
              <div className="font-semibold">{pet.name}</div>
              <div className="text-white/60">{state.learnedPets[pet.id] ? "Learned" : "Locked"} · {pet.binding} · {pet.role}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="text-white/60">Hotbar: mount={state.hotbar.mountHotbarSlot ?? "none"}, pet={state.hotbar.petHotbarSlot ?? "none"}</div>
      <div className="text-white/60">Stable NPCs: {HARTHMERE_STABLE_SERVICE_NPCS.map((npc) => npc.name).join(", ")}</div>
    </div>
  );
};

export function installHarthmereMountPetDebugApi() {
  if (typeof window === "undefined") return;
  (window as typeof window & { __harthmereMountPets?: unknown }).__harthmereMountPets = {
    read: readHarthmereMountPetCollectionState,
    reset: resetHarthmereMountPetCollectionState,
    learnMount: learnHarthmereMount,
    learnPet: learnHarthmerePet,
    slotMount: slotHarthmereMountHotbar,
    slotPet: slotHarthmerePetHotbar,
    summonMount: useHarthmereMountFromHotbar,
    summonPet: useHarthmerePetFromHotbar,
    stable: runHarthmereStableService,
    canSellToken: canSellHarthmereMountOrPetToken,
  };
}
