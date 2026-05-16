# Harthmere Dungeon Console Teleport

Open the actual Harthmere runtime, not the landing page:

```text
http://localhost:3000/at/Joe
```

Then open the browser console and run:

```js
window.__harthmereDungeonTest?.teleportToBellwardHalls?.()
```

Fallback:

```js
window.__harthmereTownAudit?.teleportToDungeonTestTarget?.("bellwardHalls")
```

Other target names:

```js
window.__harthmereTownAudit?.teleportToDungeonTestTarget?.("chapelUndercroft")
window.__harthmereTownAudit?.teleportToDungeonTestTarget?.("oldWellDrain")
window.__harthmereTownAudit?.teleportToDungeonTestTarget?.("firstChoir")
window.__harthmereTownAudit?.teleportToDungeonTestTarget?.("oldHarth")
window.__harthmereTownAudit?.teleportToDungeonTestTarget?.("bellbinderTomb")
window.__harthmereTownAudit?.teleportToDungeonTestTarget?.("bellwardChamber")
window.__harthmereTownAudit?.teleportToDungeonTestTarget?.("wyrmsBed")
```

If the helper reports `stored: true` but the player does not move immediately, reload the Harthmere runtime after running the command. That means the teleport request was stored in localStorage but no live player debug hook consumed it yet.
