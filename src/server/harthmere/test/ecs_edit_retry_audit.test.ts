import assert from "assert";
import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";

function productionTypeScriptFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root)) {
    const file = path.join(root, entry);
    if (statSync(file).isDirectory()) {
      if (entry !== "test") files.push(...productionTypeScriptFiles(file));
    } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      files.push(file);
    }
  }
  return files;
}

describe("Harthmere ECS edit retry audit", () => {
  it("does not allow raw optimistic commits in production API or scheduler paths", () => {
    const roots = [
      path.join(process.cwd(), "src/pages/api/harthmere"),
      path.join(process.cwd(), "src/server/harthmere"),
    ];
    const files = [
      ...roots.flatMap(productionTypeScriptFiles),
      path.join(process.cwd(), "src/pages/api/glitch/harthmere.ts"),
    ];
    const offenders = files
      .filter((file) => /\.commit\(\)/.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(process.cwd(), file));

    assert.deepEqual(
      offenders,
      [],
      "Harthmere ECS writes must use editWorldWithRetry so ordinary optimistic conflicts cannot become HTTP 500s"
    );
  });
});
