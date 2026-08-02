/// <reference types="@webgpu/types" />

declare module "buffer-layout";
declare module "cache-manager-memcached-store";
declare module "memcache-plus";
declare module "dom-to-image-more";

// This fork still uses TypeScript's classic Node module resolution because a
// large set of generated/runtime imports depend on it. meshoptimizer exposes
// its decoder through package exports, so describe that stable public entry
// point until the repository can migrate module resolution as a separate
// compatibility change.
declare module "meshoptimizer/decoder" {
  export const MeshoptDecoder: {
    supported: boolean;
    ready: Promise<void>;
    decodeVertexBuffer(
      target: Uint8Array,
      count: number,
      size: number,
      source: Uint8Array,
      filter?: string
    ): void;
    decodeIndexBuffer(
      target: Uint8Array,
      count: number,
      size: number,
      source: Uint8Array
    ): void;
    decodeIndexSequence(
      target: Uint8Array,
      count: number,
      size: number,
      source: Uint8Array
    ): void;
    decodeGltfBuffer(
      target: Uint8Array,
      count: number,
      size: number,
      source: Uint8Array,
      mode: string,
      filter?: string
    ): void;
    useWorkers(count: number): void;
    decodeGltfBufferAsync(
      count: number,
      size: number,
      source: Uint8Array,
      mode: string,
      filter?: string
    ): Promise<Uint8Array>;
  };
}

declare module "three/webgpu" {
  import type {
    Camera,
    Object3D,
    WebGLRendererParameters,
  } from "three";
  export {
    BoxGeometry,
    Mesh,
    MeshBasicMaterial,
    PerspectiveCamera,
    Scene,
  } from "three";

  export class WebGPURenderer {
    backend: unknown;
    constructor(
      parameters?: WebGLRendererParameters & {
        powerPreference?: "low-power" | "high-performance";
      }
    );
    init(): Promise<void>;
    setSize(width: number, height: number, updateStyle?: boolean): void;
    render(scene: Object3D, camera: Camera): void;
    dispose(): void;
  }
}

// React 19 scopes JSX under React.JSX. Keep the fork's existing explicit
// JSX.Element annotations source-compatible while call sites migrate naturally.
declare namespace JSX {
  type Element = import("react").JSX.Element;
}

declare namespace NodeJS {
  interface Module {
    hot?: {
      accept(dependency: string, callback?: () => void): void;
    };
  }
}

declare module "*.mp4" {
  const value: string;
  export = value;
}

declare module "*.webm" {
  const value: string;
  export = value;
}

declare module "*.ogg" {
  const value: string;
  export = value;
}

declare module "*.swf" {
  const value: string;
  export = value;
}

declare module "*.ogv" {
  const value: string;
  export = value;
}
