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

## 2026-08-05 — Mail Post import safety must not depend on crate rounding

The outgoing Mail Post crate was originally authored at `z=-216.85`, only
`0.07m` from the inclusive stair keep-clear boundary when using the generated
`0.86m` crate depth. The isolated source catalogue and compiled-module import
could pass while the real production `/at` dependency graph threw
`mail_post_house:mail_outgoing has no safe interior slot`.

The permanent correction uses `z=-217.4` and reserves a conservative
`1m x 1m` clearance footprint for that fixture even though the rendered mesh is
slightly smaller. Do not author fixtures on inclusive clearance edges or rely
on sub-decimetre floating-point gaps. Release evidence must include the exact
production `/at` URL, because importing the catalogue alone does not execute
the complete SSR dependency graph.

## 2026-08-03 — Blender selected builds write a partial catalogue manifest

`generate_business_furniture_catalogue.py --only ...` is a smoke-build tool.
It writes a manifest containing only the selected assets. After any selected
smoke succeeds, immediately run the full catalogue build before testing or
shipping. Acceptance requires the full 32-item manifest, 64 compressed GLBs,
and 32 exact RGBA icons.
