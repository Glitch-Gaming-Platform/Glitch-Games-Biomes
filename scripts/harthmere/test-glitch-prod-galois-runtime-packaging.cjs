#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const p = (...parts) => path.join(root, ...parts);

let failures = 0;
function ok(name) {
  console.log(`OK    ${name}`);
}
function fail(name, detail) {
  failures += 1;
  console.log(`FAIL  ${name}`);
  if (detail) console.log(`      ${detail}`);
}
function expect(name, cond, detail) {
  if (cond) ok(name);
  else fail(name, detail);
}
function read(rel) {
  return fs.readFileSync(p(rel), "utf8");
}

const docker = read("Dockerfile.biomes");
const setup = read("voxeloo/setup.py");

expect("root BUILD.bazel exists", fs.existsSync(p("BUILD.bazel")));
expect("Cargo.lock exists", fs.existsSync(p("Cargo.lock")));
expect("Cargo.Bazel.lock exists", fs.existsSync(p("Cargo.Bazel.lock")));
expect("src/bazel_utils/cpp/BUILD.bazel exists", fs.existsSync(p("src/bazel_utils/cpp/BUILD.bazel")));
expect("voxeloo/setup.py expects bazel-bin output copy", setup.includes('os.path.join(run_dir, "bazel-bin", ext.output)'));

expect(
  "Dockerfile copies complete Bazel workspace root inputs",
  docker.includes("COPY --chown=nextjs:nodejs requirements.txt WORKSPACE.bazel BUILD.bazel Cargo.lock Cargo.Bazel.lock .bazelrc .bazelversion ./"),
  "Must include BUILD.bazel, Cargo.lock, and Cargo.Bazel.lock before pip install ./voxeloo."
);
expect(
  "Dockerfile copies src/bazel_utils for voxeloo Bazel targets",
  docker.includes("COPY --chown=nextjs:nodejs src/bazel_utils/ src/bazel_utils/"),
  "voxeloo targets reference //src/bazel_utils/..."
);
expect(
  "Dockerfile makes /app writable by nextjs before voxeloo build",
  docker.includes("chown nextjs:nodejs /app;"),
  "voxeloo/setup.py copies from /app/bazel-bin; Bazel must be able to create that symlink."
);
expect(
  "Dockerfile clears stale Bazel workspace symlink paths",
  docker.includes("rm -f /app/bazel-bin /app/bazel-out /app/bazel-testlogs /app/bazel-app;"),
  "Avoid stale root-owned convenience symlinks before non-root Bazel build."
);
expect(
  "Dockerfile chowns Cargo lockfiles for non-root Bazel",
  docker.includes("/app/Cargo.lock") && docker.includes("/app/Cargo.Bazel.lock"),
  "rules_rust crate_index reads both lockfiles from the workspace."
);
expect(
  "Dockerfile builds voxeloo as nextjs, not root",
  /USER nextjs[\s\S]*pip install --no-cache-dir --no-build-isolation \.\/voxeloo/.test(docker),
  "rules_python hermetic Python rejects root; voxeloo must build after USER nextjs."
);
expect(
  "Dockerfile verifies voxeloo import during image build",
  /import docopt, numpy, PIL, pygltflib, jsonschema, stringcase, voxeloo/.test(docker),
  "The image build must fail before upload if voxeloo cannot import."
);

if (failures) {
  console.log(`\nRESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
