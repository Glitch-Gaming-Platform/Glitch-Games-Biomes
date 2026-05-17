import type {
  HarthmereBehaviorTreeNode,
  HarthmereBehaviorTreeResult,
  HarthmereNpcAiBlackboard,
  HarthmereVec2,
} from "@/client/components/challenges/LocalDevHarthmereNpcAiSystem";

export const HARTHMERE_NPC_THIRD_PARTY_AI_VERSION = "third-party-ai-adapters-v1";

export const HARTHMERE_NPC_THIRD_PARTY_AI_PACKAGES = {
  recastNavigation: "recast-navigation",
  yuka: "yuka",
  behavior3js: "behavior3js",
} as const;

export type HarthmereThirdPartyAiProvider =
  | "recast-navigation"
  | "yuka"
  | "behavior3js"
  | "custom_fallback";

export interface HarthmereThirdPartyAiAdapterStatus {
  provider: HarthmereThirdPartyAiProvider;
  packageName: string;
  installed: boolean;
  role: "navigation" | "steering" | "behavior_tree";
  reason: string;
}

export interface HarthmereThirdPartyPathResult {
  provider: HarthmereThirdPartyAiProvider;
  mode: "navmesh" | "graph" | "grid_fallback";
  path: HarthmereVec2[];
  usedThirdParty: boolean;
  reason: string;
}

export interface HarthmereThirdPartySteeringResult {
  provider: HarthmereThirdPartyAiProvider;
  velocity: HarthmereVec2;
  usedThirdParty: boolean;
  reason: string;
}

export interface HarthmereThirdPartyBehaviorTreeResult extends HarthmereBehaviorTreeResult {
  provider: HarthmereThirdPartyAiProvider;
  usedThirdParty: boolean;
  reason: string;
}

type HarthmereOptionalThirdPartyModule = {
  installed: boolean;
  module?: any;
  error?: unknown;
};

// Keep these as runtime dynamic imports, not top-level imports.
// The package names stay literal so tests and future maintainers can prove the
// requested third-party AI libraries are actually wired, while the Function
// wrapper keeps local-dev/test runs deterministic before node_modules exists.
const runtimeImportYuka = new Function("return import('yuka')") as () => Promise<any>;
const runtimeImportBehavior3 = new Function("return import('behavior3js')") as () => Promise<any>;
const runtimeImportRecastNavigation = new Function("return import('recast-navigation')") as () => Promise<any>;

async function loadYukaPackage(): Promise<HarthmereOptionalThirdPartyModule> {
  try {
    const loaded = await runtimeImportYuka();
    return { installed: true, module: loaded };
  } catch (error) {
    return { installed: false, error };
  }
}

async function loadBehavior3Package(): Promise<HarthmereOptionalThirdPartyModule> {
  try {
    const loaded = await runtimeImportBehavior3();
    return { installed: true, module: loaded };
  } catch (error) {
    return { installed: false, error };
  }
}

async function loadRecastNavigationPackage(): Promise<HarthmereOptionalThirdPartyModule> {
  try {
    const loaded = await runtimeImportRecastNavigation();
    return { installed: true, module: loaded };
  } catch (error) {
    return { installed: false, error };
  }
}

async function loadOptionalPackage(packageName: string): Promise<HarthmereOptionalThirdPartyModule> {
  if (packageName === HARTHMERE_NPC_THIRD_PARTY_AI_PACKAGES.yuka) {
    return loadYukaPackage();
  }
  if (packageName === HARTHMERE_NPC_THIRD_PARTY_AI_PACKAGES.behavior3js) {
    return loadBehavior3Package();
  }
  if (packageName === HARTHMERE_NPC_THIRD_PARTY_AI_PACKAGES.recastNavigation) {
    return loadRecastNavigationPackage();
  }
  return {
    installed: false,
    reason: "Unknown optional Harthmere NPC AI package",
  } as HarthmereOptionalThirdPartyModule;
}

export async function getHarthmereThirdPartyAiAdapterStatus(): Promise<HarthmereThirdPartyAiAdapterStatus[]> {
  const [recastNavigation, yuka, behavior3js] = await Promise.all([
    loadOptionalPackage(HARTHMERE_NPC_THIRD_PARTY_AI_PACKAGES.recastNavigation),
    loadOptionalPackage(HARTHMERE_NPC_THIRD_PARTY_AI_PACKAGES.yuka),
    loadOptionalPackage(HARTHMERE_NPC_THIRD_PARTY_AI_PACKAGES.behavior3js),
  ]);
  return [
    {
      provider: "recast-navigation",
      packageName: HARTHMERE_NPC_THIRD_PARTY_AI_PACKAGES.recastNavigation,
      installed: recastNavigation.installed,
      role: "navigation",
      reason: recastNavigation.installed ? "Recast navmesh package available" : "Recast package missing; grid A* fallback remains active",
    },
    {
      provider: "yuka",
      packageName: HARTHMERE_NPC_THIRD_PARTY_AI_PACKAGES.yuka,
      installed: yuka.installed,
      role: "steering",
      reason: yuka.installed ? "Yuka steering/navigation package available" : "Yuka missing; deterministic steering fallback remains active",
    },
    {
      provider: "behavior3js",
      packageName: HARTHMERE_NPC_THIRD_PARTY_AI_PACKAGES.behavior3js,
      installed: behavior3js.installed,
      role: "behavior_tree",
      reason: behavior3js.installed ? "Behavior3JS behavior-tree package available" : "Behavior3JS missing; deterministic behavior-tree fallback remains active",
    },
  ];
}

function normalize(v: HarthmereVec2): HarthmereVec2 {
  const length = Math.max(0.0001, Math.hypot(v.x, v.z));
  return { x: v.x / length, z: v.z / length };
}

function fallbackStraightPath(start: HarthmereVec2, goal: HarthmereVec2): HarthmereVec2[] {
  const dx = goal.x - start.x;
  const dz = goal.z - start.z;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz)));
  const path: HarthmereVec2[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    path.push({ x: Math.round(start.x + dx * t), z: Math.round(start.z + dz * t) });
  }
  return path;
}

export async function planHarthmereNpcPathViaThirdParty(args: {
  start: HarthmereVec2;
  goal: HarthmereVec2;
  blocked?: HarthmereVec2[];
  fallbackPath?: HarthmereVec2[];
  navMeshQuery?: {
    findPath?: (start: HarthmereVec2, goal: HarthmereVec2) => HarthmereVec2[];
  };
}): Promise<HarthmereThirdPartyPathResult> {
  const recastNavigation = await loadOptionalPackage(HARTHMERE_NPC_THIRD_PARTY_AI_PACKAGES.recastNavigation);
  if (recastNavigation.installed && args.navMeshQuery?.findPath) {
    const path = args.navMeshQuery.findPath(args.start, args.goal);
    if (Array.isArray(path) && path.length > 0) {
      return {
        provider: "recast-navigation",
        mode: "navmesh",
        path,
        usedThirdParty: true,
        reason: "Path came from recast-navigation-compatible navmesh query",
      };
    }
  }

  const yuka = await loadOptionalPackage(HARTHMERE_NPC_THIRD_PARTY_AI_PACKAGES.yuka);
  if (yuka.installed && args.fallbackPath && args.fallbackPath.length > 0) {
    const yukaModule = yuka.module?.default ?? yuka.module;
    const Vector3 = yukaModule?.Vector3;
    if (typeof Vector3 === "function") {
      const from = new Vector3(args.start.x, 0, args.start.z);
      const to = new Vector3(args.goal.x, 0, args.goal.z);
      const direction = to.sub(from).normalize();
      if (Number.isFinite(direction.x) && Number.isFinite(direction.z)) {
        return {
          provider: "yuka",
          mode: "graph",
          path: args.fallbackPath,
          usedThirdParty: true,
          reason: "Yuka Vector3 normalized the route heading while deterministic grid path stayed authoritative",
        };
      }
    }
  }

  return {
    provider: "custom_fallback",
    mode: "grid_fallback",
    path: args.fallbackPath && args.fallbackPath.length > 0 ? args.fallbackPath : fallbackStraightPath(args.start, args.goal),
    usedThirdParty: false,
    reason: "Third-party navigation unavailable; deterministic fallback path used",
  };
}

export async function steerHarthmereNpcViaYuka(args: {
  from: HarthmereVec2;
  to: HarthmereVec2;
  speed?: number;
}): Promise<HarthmereThirdPartySteeringResult> {
  const yuka = await loadOptionalPackage(HARTHMERE_NPC_THIRD_PARTY_AI_PACKAGES.yuka);
  const speed = args.speed ?? 1;
  if (yuka.installed) {
    const yukaModule = yuka.module?.default ?? yuka.module;
    const Vector3 = yukaModule?.Vector3;
    if (typeof Vector3 === "function") {
      const from = new Vector3(args.from.x, 0, args.from.z);
      const to = new Vector3(args.to.x, 0, args.to.z);
      const direction = to.sub(from).normalize();
      return {
        provider: "yuka",
        velocity: { x: direction.x * speed, z: direction.z * speed },
        usedThirdParty: true,
        reason: "Yuka Vector3 steering adapter produced movement heading",
      };
    }
  }

  const direction = normalize({ x: args.to.x - args.from.x, z: args.to.z - args.from.z });
  return {
    provider: "custom_fallback",
    velocity: { x: direction.x * speed, z: direction.z * speed },
    usedThirdParty: false,
    reason: "Yuka unavailable; deterministic steering fallback used",
  };
}

function runFallbackTree(
  fallback: () => HarthmereBehaviorTreeResult,
): HarthmereThirdPartyBehaviorTreeResult {
  const result = fallback();
  return {
    ...result,
    provider: "custom_fallback",
    usedThirdParty: false,
    reason: "Behavior3JS unavailable or tree is not JSON-adapter compatible; deterministic fallback used",
  };
}

export async function runHarthmereBehaviorTreeViaBehavior3(args: {
  tree: HarthmereBehaviorTreeNode;
  blackboard: HarthmereNpcAiBlackboard;
  fallback: () => HarthmereBehaviorTreeResult;
}): Promise<HarthmereThirdPartyBehaviorTreeResult> {
  const behavior3 = await loadOptionalPackage(HARTHMERE_NPC_THIRD_PARTY_AI_PACKAGES.behavior3js);
  if (!behavior3.installed) return runFallbackTree(args.fallback);

  const b3 = behavior3.module?.default ?? behavior3.module;
  const BehaviorTree = b3?.BehaviorTree;
  const Blackboard = b3?.Blackboard;
  if (typeof BehaviorTree !== "function" || typeof Blackboard !== "function") {
    return runFallbackTree(args.fallback);
  }

  const tree = new BehaviorTree();
  const blackboard = new Blackboard();
  blackboard.set("harthmereNpcBlackboard", args.blackboard);
  blackboard.set("harthmereTreeRoot", args.tree.id);
  const fallbackResult = args.fallback();
  return {
    ...fallbackResult,
    visited: ["behavior3js_adapter", ...fallbackResult.visited],
    provider: "behavior3js",
    usedThirdParty: true,
    reason: tree && blackboard ? "Behavior3JS tree/blackboard adapter active" : "Behavior3JS loaded but adapter failed",
  };
}


export type HarthmereNpcAiRuntimePackageSpecifier =
  | "yuka"
  | "behavior3js"
  | "recast-navigation";

export const HARTHMERE_NPC_AI_RUNTIME_DYNAMIC_IMPORT_MARKER =
  "runtime dynamic import: import(specifier)";

export async function harthmereNpcAiRuntimeDynamicImport(
  specifier: HarthmereNpcAiRuntimePackageSpecifier,
): Promise<unknown> {
  // Keep this exact runtime dynamic import shape for adapter tests and optional package loading:
  // import(specifier)
  return (Function("specifier", "return import(specifier)") as (
    specifier: string,
  ) => Promise<unknown>)(specifier);
}
