import type { RenderPassChannel } from "@/client/game/renderers/passes/composer";
import { ScenePass } from "@/client/game/renderers/passes/scene_pass";
import * as THREE from "three";

export class SceneBasePass extends ScenePass {
  multiTarget?: THREE.WebGLRenderTarget;

  inputChannels() {
    return [...this.options.additionalInputs];
  }

  outputChannels() {
    return ["color", "depth", "normal", "baseDepth"] as RenderPassChannel[];
  }

  generateBuffers(renderToScreen: boolean) {
    if (!this.composer) {
      return;
    }
    const renderer = this.composer.renderer;
    const pixelRatio = renderer.getPixelRatio();
    const size = renderer.getSize(new THREE.Vector2());

    const depthTexture = this.composer.getSharedBuffer(
      "depth"
    ) as THREE.DepthTexture;
    const target = new THREE.WebGLRenderTarget(
      size.width * pixelRatio,
      size.height * pixelRatio,
      {
        count: 3,
        depthTexture,
      }
    );
    const [color, normal, baseDepth] = target.textures;

    // RGB with Depth
    color.name = "Color";
    color.format = THREE.RGBAFormat;
    color.type = THREE.HalfFloatType;
    color.minFilter = THREE.NearestFilter;
    color.magFilter = THREE.NearestFilter;
    color.generateMipmaps = false;

    normal.name = "Normal";
    normal.format = THREE.RGBAFormat;
    normal.type = THREE.HalfFloatType;
    normal.minFilter = THREE.NearestFilter;
    normal.magFilter = THREE.NearestFilter;
    normal.generateMipmaps = false;

    // TODO determine if this is faster as a copy rather than a MRT
    baseDepth.name = "BaseDepth";
    baseDepth.format = THREE.RedFormat;
    baseDepth.type = THREE.HalfFloatType;
    baseDepth.minFilter = THREE.NearestFilter;
    baseDepth.magFilter = THREE.NearestFilter;
    baseDepth.generateMipmaps = false;

    this.multiTarget = target;
    this.outputs.clear();
    if (!renderToScreen) {
      this.outputs.set("color", color);
      this.outputs.set("depth", depthTexture);
      this.outputs.set("normal", normal);
      this.outputs.set("baseDepth", baseDepth);
    }
  }

  resizeBuffers(): void {
    super.resizeBuffers();
    const renderer = this.composer?.renderer;
    if (this.multiTarget && renderer) {
      const pixelRatio = renderer.getPixelRatio();
      const size = this.composer!.renderer.getSize(new THREE.Vector2());
      this.multiTarget.setSize(
        size.width * pixelRatio,
        size.height * pixelRatio
      );
    }
  }

  destroyBuffers() {
    if (this.multiTarget !== undefined) {
      this.multiTarget.dispose();
      this.multiTarget = undefined;
    }
  }

  applyRenderTarget(toScreen: boolean) {
    if (this.composer === undefined) {
      return false;
    }
    if (toScreen) {
      this.composer.renderer.setRenderTarget(null);
      return true;
    } else if (this.multiTarget !== undefined) {
      this.composer.renderer.setRenderTarget(this.multiTarget);
      return true;
    }
    return false;
  }
}
