export interface OrderedInspectAction {
  title: unknown;
}

function normalizedStringTitle(action: OrderedInspectAction) {
  return typeof action.title === "string"
    ? action.title.trim().toLowerCase()
    : undefined;
}

/**
 * Capability-owned actions always precede inferred object/dialog actions.
 * Context inference must not append a second copy of an action the typed
 * overlay already owns (the robot overlay used to render F Talk / G Settings /
 * H Talk because both layers independently inferred the same conversation).
 */
export function mergeInspectShortcutLayers<T extends OrderedInspectAction>(
  typedActions: readonly T[],
  objectActions: readonly T[],
  contextualActions: readonly T[]
) {
  const ownedTitles = new Set(
    [...typedActions, ...objectActions]
      .map(normalizedStringTitle)
      .filter((title): title is string => Boolean(title))
  );
  return [
    ...typedActions,
    ...objectActions,
    ...contextualActions.filter((action) => {
      const title = normalizedStringTitle(action);
      return !title || !ownedTitles.has(title);
    }),
  ];
}
