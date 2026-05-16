# Harthmere Asset Access Note

The assistant can review files that are uploaded to ChatGPT, including patch scripts, logs, and review bundles. It cannot directly browse the local Mac folder:

```text
/Users/devindixon/Development/biomes-game/public/assets/harthmere
```

unless that folder or a generated manifest is uploaded.

The town/dungeon completion patch uses asset IDs already referenced inside `src/client/game/renderers/local_dev/harthmere_assets.ts` so it does not depend on blind guesses about unavailable files.

To generate a local asset manifest for review:

```bash
cd /Users/devindixon/Development/biomes-game
find public/assets/harthmere -type f | sort > tmp/harthmere-asset-manifest.txt
```

Upload `tmp/harthmere-asset-manifest.txt` if you want future passes to choose from every raw asset, not just the already-registered runtime asset IDs.
