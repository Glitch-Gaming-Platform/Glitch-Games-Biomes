import { readFileSync } from "fs";
import path from "path";
import assert from "assert";

function glbJson(relativePath: string) {
  const bytes = readFileSync(path.join(process.cwd(), relativePath));
  assert.equal(bytes.toString("ascii", 0, 4), "glTF");
  const jsonLength = bytes.readUInt32LE(12);
  return JSON.parse(
    bytes
      .subarray(20, 20 + jsonLength)
      .toString("utf8")
      .replace(/\0+$/g, "")
      .trim()
  ) as {
    nodes?: Array<{ name?: string }>;
    materials?: Array<{ name?: string }>;
    animations?: Array<{
      name?: string;
      channels?: Array<{
        target?: { node?: number; path?: string };
      }>;
    }>;
    skins?: unknown[];
  };
}

describe("Harthmere AAA bow assets", () => {
  for (const bowId of ["hunter_bow", "golden_bow", "strung_bow"] as const) {
    it(`${bowId} publishes one rig, coordinated clips, and projectile sockets`, () => {
      const gltf = glbJson(`public/assets/harthmere/glb/weapons/${bowId}.glb`);
      const nodeNames = new Set(gltf.nodes?.map(({ name }) => name));
      const animationNames = new Set(gltf.animations?.map(({ name }) => name));

      assert.equal(gltf.skins?.length, 1);
      for (const socket of [
        "ArrowSocket",
        "GripSocket",
        "LeftHandSocket",
        "RightHandSocket",
        "FXSocket",
        "TrailSocket",
      ]) {
        assert.ok(nodeNames.has(socket), `${bowId}:${socket}`);
      }
      for (const clip of [
        "IdleAim_24",
        "AimDraw_24",
        "Release_24",
        "Recover_24",
        "Reload_24",
      ]) {
        assert.ok(animationNames.has(clip), `${bowId}:${clip}`);
      }
      assert.ok(
        gltf.materials?.some(({ name }) => /linen-string/i.test(name ?? "")),
        `${bowId} uses a non-metallic authored string material`
      );
      const release = gltf.animations?.find(
        ({ name }) => name === "Release_24"
      );
      const animatedTargets = new Set(
        release?.channels?.map(({ target }) =>
          target?.node === undefined
            ? undefined
            : gltf.nodes?.[target.node]?.name
        )
      );
      assert.ok(animatedTargets.has("NockedArrow"));
      assert.ok(animatedTargets.has("StringTop"));
      assert.ok(animatedTargets.has("StringBottom"));
      assert.ok(animatedTargets.has("UpperLimb"));
      assert.ok(animatedTargets.has("LowerLimb"));
    });
  }

  it("publishes the physical hunter arrow at readable arrow scale with an inventory icon", () => {
    const manifest = JSON.parse(
      readFileSync(
        path.join(
          process.cwd(),
          "public/assets/harthmere/glb/projectiles/manifest.json"
        ),
        "utf8"
      )
    ) as { projectiles: Array<{ id: string; targetSize: number }> };
    const arrow = manifest.projectiles.find(
      ({ id }) => id === "hunter_bow_shot"
    );
    assert.equal(arrow?.targetSize, 1);
    const icon = readFileSync(
      path.join(
        process.cwd(),
        "public/assets/harthmere/weapon_icons/hunting_arrow.png"
      )
    );
    assert.equal(icon.toString("hex", 0, 8), "89504e470d0a1a0a");
  });
});
