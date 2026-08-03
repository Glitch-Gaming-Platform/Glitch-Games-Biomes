# Harthmere additive-town interior issue log

## 2026-08-03 — Authored shell coordinates are not runtime world coordinates

The 57-building shell table is authored around X=400–600. In the connected
production world, the complete additive town is shifted by the configured
Harthmere offset (normally +1600 X). A renderer or ECS seed that copies a
fixture's authored position directly will put furniture/collision back in the
old map area instead of inside the visible building.

Required pattern:

- keep layout validation in authored shell coordinates;
- apply `harthmereAdditiveTownInteriorWorldPosition()` exactly once at the
  renderer/ECS boundary;
- do not shift NPC anchors in the manifest, because the server's existing
  `harthmereWorldPosition()` path shifts stable NPC anchors;
- test both connected mode (+1600 X) and explicit standalone mode (no offset).

The visual fixture matrix, invisible collision seeds, and native cooking
station seeds all use the shared conversion helper. Do not hand-copy the
offset into another table.

## 2026-08-03 — Blender selected builds write a partial catalogue manifest

`generate_business_furniture_catalogue.py --only ...` is a smoke-build tool.
It writes a manifest containing only the selected assets. After any selected
smoke succeeds, immediately run the full catalogue build before testing or
shipping. Acceptance requires the full 32-item manifest, 64 compressed GLBs,
and 32 exact RGBA icons.
