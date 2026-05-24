import type { NextApiRequest, NextApiResponse } from "next";

const GLITCH_STATIC_PLAYER_MESH_FALLBACK_URL =
  "/assets/harthmere/gltf/characters/player_body_variants/harthmere_player_average_earth.gltf";

function shouldUseStaticPlayerMeshFallback(): boolean {
  return (
    process.env.GLITCH_STATIC_PLAYER_MESH_FALLBACK === "1" ||
    process.env.GLITCH_STATIC_PLAYER_MESH_FALLBACK === "true" ||
    (process.env.GLITCH_RUNTIME === "1" &&
      process.env.GLITCH_LOCAL_ASSETS === "1") ||
    (process.env.NEXT_PUBLIC_GLITCH_RUNTIME === "1" &&
      process.env.NEXT_PUBLIC_GLITCH_LOCAL_ASSETS === "1")
  );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const rawUrl = req.url ?? "";
  const query = rawUrl.includes("?") ? rawUrl.slice(rawUrl.indexOf("?")) : "";

  if (shouldUseStaticPlayerMeshFallback()) {
    res.redirect(307, `${GLITCH_STATIC_PLAYER_MESH_FALLBACK_URL}${query}`);
    return;
  }

  res.status(503).json({
    ok: false,
    error: "Dynamic player mesh generation is unavailable in this build.",
    fallback: GLITCH_STATIC_PLAYER_MESH_FALLBACK_URL,
  });
}
