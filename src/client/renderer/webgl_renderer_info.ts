export interface WebGlRendererInfo {
  renderer: string;
  vendor: string;
  maskedRenderer?: string;
  maskedVendor?: string;
}

interface WebGlDebugRendererInfo {
  UNMASKED_RENDERER_WEBGL: number;
  UNMASKED_VENDOR_WEBGL: number;
}

function stringParameter(
  context: WebGLRenderingContext | WebGL2RenderingContext,
  parameter: number
) {
  try {
    const value = context.getParameter(parameter);
    return value === undefined || value === null ? undefined : String(value);
  } catch {
    return undefined;
  }
}

export function getWebGlRendererInfo(
  context: WebGLRenderingContext | WebGL2RenderingContext
): WebGlRendererInfo {
  const maskedRenderer = stringParameter(context, context.RENDERER);
  const maskedVendor = stringParameter(context, context.VENDOR);

  let debugInfo: WebGlDebugRendererInfo | null = null;
  try {
    debugInfo = context.getExtension(
      "WEBGL_debug_renderer_info"
    ) as WebGlDebugRendererInfo | null;
  } catch {
    // Some privacy-hardened browsers reject this extension. The masked values
    // below still provide useful diagnostics without affecting rendering.
  }

  const unmaskedRenderer = debugInfo
    ? stringParameter(context, debugInfo.UNMASKED_RENDERER_WEBGL)
    : undefined;
  const unmaskedVendor = debugInfo
    ? stringParameter(context, debugInfo.UNMASKED_VENDOR_WEBGL)
    : undefined;

  return {
    renderer: unmaskedRenderer ?? maskedRenderer ?? "Unknown",
    vendor: unmaskedVendor ?? maskedVendor ?? "Unknown",
    maskedRenderer,
    maskedVendor,
  };
}
