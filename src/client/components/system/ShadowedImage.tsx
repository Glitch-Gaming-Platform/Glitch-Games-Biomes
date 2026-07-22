import React, { type PropsWithChildren, useEffect, useState } from "react";

// A broken remote avatar can be rendered by several HUD/chat surfaces. Cache
// the failure process-wide so React remounts use the placeholder immediately
// instead of issuing the same noisy 404 on every render.
const failedImageSources = new Set<string>();

export function resetFailedShadowedImageSourcesForTest() {
  failedImageSources.clear();
}

export const ShadowedImage: React.FunctionComponent<
  PropsWithChildren<{
    onClick?: (e: React.MouseEvent) => any;
    onDoubleClick?: () => any;
    extraClassNames?: string;
    src?: string;
    fallbackSrc?: string;
    imgClassName?: string;
    accentColor?: string;
  }>
> = ({
  onClick,
  onDoubleClick,
  extraClassNames,
  src,
  fallbackSrc,
  imgClassName,
  accentColor,
  children,
}) => {
  const [sourceFailed, setSourceFailed] = useState(() =>
    src ? failedImageSources.has(src) : false
  );
  useEffect(() => {
    setSourceFailed(src ? failedImageSources.has(src) : false);
  }, [src]);
  const effectiveSrc = sourceFailed ? fallbackSrc : src ?? fallbackSrc;

  return (
    <div
      className={`img-box-shadow-wrapper ${extraClassNames}`}
      onClick={(e) => {
        onClick?.(e);
      }}
      onDoubleClick={() => {
        onDoubleClick?.();
      }}
      style={{ backgroundColor: accentColor ?? undefined }}
    >
      <img
        className={`${imgClassName} max-w-none`}
        src={effectiveSrc}
        onError={() => {
          if (!fallbackSrc || !src || effectiveSrc === fallbackSrc) {
            return;
          }
          if (failedImageSources.size >= 256) {
            failedImageSources.clear();
          }
          failedImageSources.add(src);
          setSourceFailed(true);
        }}
      />
      <div className="b-shadow-inner" />
      {children}
    </div>
  );
};
