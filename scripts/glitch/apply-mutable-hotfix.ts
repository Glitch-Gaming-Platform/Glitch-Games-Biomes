import {
  applyConfiguredGlitchMutableHotfix,
  closeGlitchMutableHotfixRedis,
  getGlitchMutableHotfixStatus,
  glitchMutableHotfixEnabled,
  maybeApplyGlitchMutableHotfixFromRedis,
} from "@/server/glitch/mutable_hotfix";

const watchMode = process.argv.includes("--watch");

async function main() {
  if (!glitchMutableHotfixEnabled()) {
    console.log("GLITCH_MUTABLE_HOTFIX disabled");
    return;
  }

  console.log("GLITCH_MUTABLE_HOTFIX startup apply begin");
  const result = await applyConfiguredGlitchMutableHotfix({
    scheduleRestart: false,
  });
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

async function watch() {
  if (!glitchMutableHotfixEnabled()) {
    console.log("GLITCH_MUTABLE_HOTFIX watcher disabled");
    return;
  }
  const pollMs = Math.max(
    250,
    Number(process.env.GLITCH_MUTABLE_HOTFIX_POLL_MS ?? 5_000)
  );
  console.log(`GLITCH_MUTABLE_HOTFIX watcher started pollMs=${pollMs}`);
  while (true) {
    try {
      await maybeApplyGlitchMutableHotfixFromRedis();
    } catch (error) {
      console.error("GLITCH_MUTABLE_HOTFIX watcher apply failed", error);
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

async function closeStartupResources() {
  try {
    await closeGlitchMutableHotfixRedis();
  } catch (error) {
    console.warn("GLITCH_MUTABLE_HOTFIX Redis close failed", error);
  }
}

const run = watchMode ? watch() : main().finally(closeStartupResources);

run.catch((error) => {
  console.error(
    `GLITCH_MUTABLE_HOTFIX ${watchMode ? "watch" : "startup apply"} failed`,
    error
  );
  process.exit(72);
});
