import assert from "assert";
import fs from "fs";
import path from "path";

describe("LoginRelatedController startup authentication", () => {
  it("checks the existing session once per mount instead of after every render", () => {
    const source = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/client/components/static_site/LoginRelatedController.tsx"
      ),
      "utf8"
    );

    assert.match(
      source,
      /useEffectAsync\(async \(\) => \{\s*isLoggedIn\.current = Boolean\(await checkLoggedIn\(\)\);\s*\}, \[\]\);/
    );
  });
});
