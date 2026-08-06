/// <reference types="mocha" />

import {
  HARTHMERE_SOUND_EFFECT_MANIFEST,
  harthmereGeneratedMobileSoundPath,
} from "@/shared/harthmere/sound_effect_manifest";
import assert from "assert";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const CORE_LONG_FORM_MUSIC_BASENAME =
  /^(?:music-1|muck-music-1|cave-music-loop)\.[^.]+\.webm$/i;

function absolutePublicPath(publicPath: string) {
  return path.join(ROOT, "public", publicPath.replace(/^\/+/, ""));
}

function recursiveFiles(root: string, extension: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) return recursiveFiles(absolute, extension);
    return entry.isFile() && entry.name.endsWith(extension) ? [absolute] : [];
  });
}

describe("mobile AAC audio asset contract", () => {
  it("keeps every Harthmere generated effect original and AAC variant", () => {
    const generated = HARTHMERE_SOUND_EFFECT_MANIFEST.filter(
      (definition) => definition.source === "elevenlabs"
    );
    assert.equal(generated.length, 840);
    let sourceBytes = 0;
    let mobileBytes = 0;
    for (const definition of generated) {
      assert.equal(
        definition.mobilePath,
        harthmereGeneratedMobileSoundPath(definition.id)
      );
      const source = absolutePublicPath(definition.path);
      const mobile = absolutePublicPath(definition.mobilePath!);
      assert.ok(fs.existsSync(source), `missing source ${definition.path}`);
      assert.ok(
        fs.existsSync(mobile),
        `missing mobile ${definition.mobilePath}`
      );
      sourceBytes += fs.statSync(source).size;
      mobileBytes += fs.statSync(mobile).size;
    }
    assert.ok(mobileBytes < sourceBytes, "AAC SFX catalogue should be smaller");
  });

  it("keeps every committed NPC MP3 and its smaller AAC-LC variant", () => {
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(
          ROOT,
          "public/harthmere/voices/generated/current/manifest.json"
        ),
        "utf8"
      )
    ) as {
      recordings: Array<{
        path: string;
        bytes: number;
        mobilePath?: string;
        mobileBytes?: number;
      }>;
    };
    assert.equal(manifest.recordings.length, 2164);
    let sourceBytes = 0;
    let mobileBytes = 0;
    for (const recording of manifest.recordings) {
      assert.ok(recording.mobilePath, `${recording.path} has no mobile path`);
      const source = absolutePublicPath(recording.path);
      const mobile = absolutePublicPath(recording.mobilePath!);
      assert.ok(fs.existsSync(source), `missing source ${recording.path}`);
      assert.ok(
        fs.existsSync(mobile),
        `missing mobile ${recording.mobilePath}`
      );
      assert.equal(fs.statSync(source).size, recording.bytes);
      assert.equal(fs.statSync(mobile).size, recording.mobileBytes);
      sourceBytes += recording.bytes;
      mobileBytes += recording.mobileBytes!;
    }
    assert.ok(
      mobileBytes < sourceBytes * 0.6,
      "mobile speech catalogue should save at least 40%"
    );
  });

  it("pairs every packaged core WebM/Opus sound with an AAC fallback", () => {
    const root = path.join(
      ROOT,
      "public/buckets/biomes-static/asset_data/audio"
    );
    const allSources = recursiveFiles(root, ".webm");
    const sources = allSources.filter(
      (source) => !CORE_LONG_FORM_MUSIC_BASENAME.test(path.basename(source))
    );
    assert.equal(sources.length, 113);
    let sourceBytes = 0;
    let mobileBytes = 0;
    for (const source of sources) {
      const mobile = path.join(
        ROOT,
        "public/assets/harthmere/audio/mobile/core",
        `${path.basename(source, ".webm")}.m4a`
      );
      assert.ok(fs.existsSync(mobile), `missing mobile ${mobile}`);
      sourceBytes += fs.statSync(source).size;
      mobileBytes += fs.statSync(mobile).size;
    }
    for (const source of allSources.filter((source) =>
      CORE_LONG_FORM_MUSIC_BASENAME.test(path.basename(source))
    )) {
      const redundantMobile = path.join(
        ROOT,
        "public/assets/harthmere/audio/mobile/core",
        `${path.basename(source, ".webm")}.m4a`
      );
      assert.ok(
        !fs.existsSync(redundantMobile),
        `dedicated mobile music already exists; remove ${redundantMobile}`
      );
    }
    assert.ok(
      mobileBytes < sourceBytes,
      "core AAC compatibility catalogue should be smaller in aggregate"
    );
  });
});
