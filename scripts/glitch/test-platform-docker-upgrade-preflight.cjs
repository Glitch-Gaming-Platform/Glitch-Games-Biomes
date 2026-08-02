#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || process.cwd());
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const docker = read("Dockerfile");
const production = read("Dockerfile.biomes");
const bob = read("Dockerfile.bob");
const devcontainer = read(".devcontainer/Dockerfile");
const moduleBazel = read("MODULE.bazel");
const requirements = read("requirements.txt");
const packageJson = JSON.parse(read("package.json"));
const processSetup = read("src/server/shared/process.ts");
const deploy = read("scripts/glitch/deploy-production-local-redis-smoke.sh");
const pipAction = read(".github/actions/cached-pip-install/action.yml");
const voxelooSetup = read("voxeloo/setup.py");
const launcher = read("b");
const bootstrap = read("scripts/b/bootstrap.py");
const rootReadme = read("README.md");
const k8 = read("deploy/k8/biomes.ts");
const redisClient = read("deploy/k8/services/redis-client.yaml");
const installPlayer = read(
  "scripts/harthmere/run-harthmere-install-player-ingame-local.sh"
);
const startupReadme = read("docs/harthmere/GLITCH_HARTHMERE_STARTUP_README.md");
const redisManifests = [
  "deploy/k8/services/redis.yaml",
  "deploy/k8/services/redis-other.yaml",
  "deploy/k8/services/redis-l1.yaml",
  "deploy/k8/services/redis-hfc.yaml",
].map(read);

let failed = false;
function check(label, condition) {
  console.log(`${condition ? "OK" : "FAIL"} ${label}`);
  failed ||= !condition;
}

const runtimeDockerfiles = [docker, production, bob];
check(
  "all fork runtime images use Ubuntu 24.04 for the Node 24 native ABI floor",
  runtimeDockerfiles.every((contents) => contents.includes("ubuntu:24.04"))
);
check(
  "all Docker surfaces pin Node 24.18.1",
  [docker, production, bob, devcontainer].every((contents) =>
    contents.includes("24.18.1")
  )
);
check(
  "download helper images are version-and-digest pinned",
  runtimeDockerfiles.every(
    (contents) =>
      !contents.includes("curlimages/curl:latest") &&
      contents.includes("curlimages/curl:8.21.0@sha256:")
  )
);
check(
  "Redis source builds are pinned to 8.8.1 and disable Docker-hostile GCC LTO",
  [docker, production, devcontainer].every(
    (contents) =>
      contents.includes("REDIS_VERSION=8.8.1") &&
      contents.includes("ENABLE_LTO=")
  )
);
check(
  "Node 24 runtime images rebuild and load native dependencies before packaging",
  [docker, production].every(
    (contents) =>
      contents.includes("msgpackr-extract") &&
      contents.includes("segfault-raub") &&
      contents.includes("uWebSockets.js") &&
      contents.includes("isNativeAccelerationEnabled")
  )
);
check(
  "production dependencies are installed natively in Linux instead of copying host node_modules",
  production.includes("npm ci --omit=dev --ignore-scripts") &&
    !production.includes("COPY --chown=nextjs:nodejs node_modules/")
);
check(
  "fatal-signal diagnostics no longer use the abandoned NAN addon",
  packageJson.dependencies["segfault-raub"] === "3.2.0" &&
    !packageJson.dependencies["segfault-handler"] &&
    processSetup.includes('import "segfault-raub"')
);
check(
  "Bazel, CI, and the production venv share Python 3.12",
  moduleBazel.includes('python.defaults(python_version = "3.12")') &&
    moduleBazel.includes('python.toolchain(python_version = "3.12")') &&
    production.includes("python3.12/site-packages") &&
    pipAction.includes('python-version: "3.12"')
);
check(
  "local bootstrap refuses cross-minor Python and Voxeloo ABI reuse",
  launcher.includes("python_is_312") &&
    launcher.includes("Python 3.12 is required") &&
    bootstrap.includes("This fork requires Python 3.12 exactly") &&
    bootstrap.includes("recreate it with `python3.12 -m venv .venv`")
);
check(
  "Python asset dependencies have Python 3.12-compatible pins",
  requirements.includes("numpy==2.4.6") &&
    requirements.includes("Pillow==12.3.0") &&
    requirements.includes("pygltflib==1.16.5") &&
    requirements.includes("jsonschema==4.26.0")
);
check(
  "Voxeloo packaging avoids removed distutils and pip install-option APIs",
  voxelooSetup.includes("from sysconfig import") &&
    voxelooSetup.includes("get_path") &&
    !voxelooSetup.includes("distutils") &&
    !pipAction.includes("--install-option")
);
check(
  "Voxeloo native wheels inherit CPython's supported macOS deployment floor",
  voxelooSetup.includes('get_config_var("MACOSX_DEPLOYMENT_TARGET")') &&
    voxelooSetup.includes("--macos_minimum_os=") &&
    voxelooSetup.includes("--host_macos_minimum_os=")
);
check(
  "Voxeloo packaging accepts the Bazel 9 Bzlmod workspace used by production",
  voxelooSetup.includes('(\"MODULE.bazel\", \"WORKSPACE.bazel\")') &&
    voxelooSetup.includes("MODULE.bazel or WORKSPACE.bazel")
);
check(
  "modern Node builds do not request OpenSSL's legacy provider",
  ![
    docker,
    production,
    bob,
    read("scripts/b/b.py"),
    read("scripts/glitch/run-glitch-local-game-stack.sh"),
    read("deploy/k8/biomes.ts"),
  ].some((contents) => contents.includes("--openssl-legacy-provider"))
);
check(
  "production artifact build audits externals and rejects stale segfault-handler bundles before Docker",
  deploy.includes("assert-production-runtime-dependencies.cjs") &&
    deploy.includes("server bundles still reference the removed NAN-based")
);
check(
  "server-rendered Ant Design routes retain their production dependency closure",
  packageJson.dependencies.antd === "^4.21.3" &&
    !packageJson.devDependencies.antd
);
check(
  "all active fork Redis container helpers match production Redis 8.8.1",
  k8.includes('image: "redis:8.8.1-alpine"') &&
    redisClient.includes("redis:8.8.1") &&
    installPlayer.includes("redis:8.8.1-alpine") &&
    startupReadme.includes("redis:8.8.1-alpine") &&
    ![k8, redisClient, installPlayer, startupReadme].some((contents) =>
      /redis:(?:6|7)(?:[.-]|\b)/.test(contents)
    )
);
check(
  "Redis exporter images are version pinned instead of drifting on latest",
  redisManifests.every(
    (contents) =>
      contents.includes("oliver006/redis_exporter:v1.88.0") &&
      !contents.includes("redis_exporter:latest")
  )
);
check(
  "developer setup documentation matches the Node 24 and Python 3.12 ABI floor",
  rootReadme.includes("Node.js 24.18.1") &&
    rootReadme.includes("python3.12 -m venv .venv") &&
    !rootReadme.includes("nvm install 20") &&
    !rootReadme.includes("python3.10 -m venv")
);
check(
  "devcontainer matches the fork's Rust/WASI targets",
  devcontainer.includes("1.97.1") &&
    devcontainer.includes("wasm32-wasip1") &&
    !devcontainer.includes("wasm32-wasi\n")
);

console.log(`\nRESULT: ${failed ? "FAIL" : "PASS"}`);
process.exit(failed ? 1 : 0);
