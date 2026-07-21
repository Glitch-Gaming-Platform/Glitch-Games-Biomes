export interface OrderedInspectAction {
  title: unknown;
}

/** Capability-owned actions always precede inferred object/dialog actions. */
export function mergeInspectShortcutLayers<T extends OrderedInspectAction>(
  typedActions: readonly T[],
  objectActions: readonly T[],
  contextualActions: readonly T[]
) {
  return [...typedActions, ...objectActions, ...contextualActions];
}
