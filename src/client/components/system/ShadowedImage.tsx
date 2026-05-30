import React, { type PropsWithChildren } from "react";

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
        src={src ?? fallbackSrc}
        onError={(event) => {
          if (!fallbackSrc || event.currentTarget.src.endsWith(fallbackSrc)) {
            return;
          }
          event.currentTarget.src = fallbackSrc;
        }}
      />
      <div className="b-shadow-inner" />
      {children}
    </div>
  );
};
