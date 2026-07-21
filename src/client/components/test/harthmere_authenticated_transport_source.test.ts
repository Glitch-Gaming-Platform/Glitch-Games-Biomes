/// <reference types="mocha" />
import assert from "assert";
import fs from "fs";
import path from "path";

const CLIENT_ROOT = path.resolve(process.cwd(), "src/client");
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const DIRECT_FETCH_RE = /\b(?:window\s*\.\s*)?fetch\s*\(/;

function sourceFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...sourceFiles(absolute));
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(absolute);
    }
  }
  return files;
}

describe("Harthmere authenticated client transport source guard", () => {
  it("does not let production Harthmere API callers bypass the shared auth adapter", () => {
    const bypasses = sourceFiles(CLIENT_ROOT)
      .filter(
        (file) =>
          !file.includes(`${path.sep}test${path.sep}`) &&
          !file.includes(`${path.sep}__tests__${path.sep}`) &&
          !file.endsWith(".test.ts") &&
          !file.endsWith(".test.tsx")
      )
      .flatMap((file) => {
        const source = fs.readFileSync(file, "utf8");
        if (!source.includes("/api/harthmere/")) return [];
        if (!DIRECT_FETCH_RE.test(source)) return [];
        return [path.relative(process.cwd(), file)];
      });

    assert.deepEqual(
      bypasses,
      [],
      `Harthmere API calls must use defaultHarthmereLiveFetch or ` +
        `fetchHarthmereLiveWithTimeout so the Glitch install and authenticated ` +
        `Biomes ECS session stay distinct and are attached centrally. Direct ` +
        `fetch() bypasses: ${bypasses.join(", ")}`
    );
  });
});
