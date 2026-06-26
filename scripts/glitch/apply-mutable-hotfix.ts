import {
  applyConfiguredGlitchMutableHotfix,
  closeGlitchMutableHotfixRedis,
  getGlitchMutableHotfixStatus,
  glitchMutableHotfixEnabled,
} from "@/server/glitch/mutable_hotfix";

async function main() {
  if (!glitchMutableHotfixEnabled()) {
    console.log("GLITCH_MUTABLE_HOTFIX disabled");
    return;
  }

  console.log("GLITCH_MUTABLE_HOTFIX startup apply begin");
  const result = await applyConfiguredGlitchMutableHotfix({ force: true });
  console.log(
    JSON.stringify(
      {
        phase: "GLITCH_MUTABLE_HOTFIX startup apply done",
        result,
        status: getGlitchMutableHotfixStatus(),
      },
      null,
      2
    )
  );
}

async function closeStartupResources() {
  try {
    await closeGlitchMutableHotfixRedis();
  } catch (error) {
    console.warn("GLITCH_MUTABLE_HOTFIX Redis close failed", error);
  }
}

main()
  .finally(closeStartupResources)
  .catch((error) => {
    console.error("GLITCH_MUTABLE_HOTFIX startup apply failed", error);
    process.exit(72);
  });
