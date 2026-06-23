# Biomes Docs

### Harthmere Attack Targeting

For the confirmed left-click attack path for muckers, hexes, animals, sentinels,
robots, bots, NPCs, and players, read:

```text
docs/harthmere/HARTHMERE_NATIVE_CURSOR_ATTACK_TARGETING.md
```

That guide documents why sentinels/robots worked, why real `dMucker`-based
living entities were omitted from `cursor.attackableEntities`, and why the
native cursor/ECS path is the source of truth for normal attacks.

### Harthmere Terrain Placement

For terrain-correct Harthmere quest items, monsters, NPCs, HUD targets,
BiomesUI map pins, quest pointers, and random spawn pools, read:

```text
docs/harthmere/HARTHMERE_PRODUCTION_TERRAIN_PLACEMENT_MAP.md
```

That guide documents the generated production terrain placement map, the
read-only Azure/Redis regeneration command, cave/hollow spawn records, and the
resolver APIs runtime code should use.

### Harthmere Live Construction, Equipment, Hotbar, And Containers

For production/live-mode verification notes covering throwaway home/business
construction, equipment-to-avatar projection, hotbar held-item projection, and
visible versus hidden container behavior, read:

```text
docs/harthmere/README.md
src/client/components/biomes_ui/README.md
```

Production construction tests can write real terrain/property/business state into
the shared live world. Use throwaway actors, record what was written, and do not
use local Docker builds for quick verification unless the task explicitly calls
for a deployment or container smoke.

### Harthmere Azure Voice And Speech

For Azure-only NPC voice casting, speech-to-text, text-to-speech, quota checks,
static recording generation, and optional deployment configuration, read:

```text
docs/harthmere/HARTHMERE_AZURE_VOICE_AND_SPEECH.md
```

That guide documents the verified Azure CLI checks, the optional environment
variables, the small microphone dialogue flow, and how active quest context is
sent to the NPC AI only while that quest is in progress.

### Production Redis Crash Loop Runbook

For the 2026-06-15 production crash-loop recovery, Redis persistence/NSG
guardrails, Harthmere authored-content reconciliation checks, and the safe
deploy commands now required for private Redis, read:

```text
docs/production/biomes-containerapp-redis-crashloop-20260615.md
scripts/glitch/BIOMES_HARTHMERE_PRODUCTION_DEPLOYMENT_README.md
```

### Local Development

```bash
$ yarn start
```

This command starts a local development server at `http://localhost:8080` and opens up a browser window. Most changes are reflected live without having to restart the server.

### Build

```bash
$ yarn build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

### Deployment

```bash
$ GIT_USER=<Your GitHub username> yarn deploy
```

If you are using GitHub pages for hosting, this command is a convenient way to build the website and push to the `gh-pages` branch.

### Notes

- When using assets in Markdown, import via `/img/<file-name>`.
- When using assets inside of React components, import via `require(@site/static/img/<file name>).default`.
