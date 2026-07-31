export function terrainReadyForStartup(options: {
  lowMemory: boolean;
  playerShardsLoaded: boolean;
  playerShardsMeshed: boolean;
}) {
  return options.lowMemory
    ? options.playerShardsLoaded
    : options.playerShardsMeshed;
}
