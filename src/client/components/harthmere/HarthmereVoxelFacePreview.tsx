import { type HarthmereVoxelFaceConfig } from "@/shared/harthmere/voxel_faces";
import type React from "react";

// Shared CSS-div voxel face renderer for Harthmere NPCs. Extracted from
// WakeUpScreen so the same faces players see during character creation can be
// reused anywhere an NPC needs a portrait (e.g. the business mini-game customer
// card). Pure presentational component: no ECS, no Three.js, no game
// resources — it renders entirely from a deterministic HarthmereVoxelFaceConfig
// (see makeHarthmereNpcFaceConfig), so it works for session-only customers.

export const FACE_COLOR_SWATCHES = {
  skin: {
    porcelain: "#f0c7a3",
    light: "#e4b48e",
    warm: "#d19a68",
    tan: "#b9825a",
    brown: "#8f5f3f",
    deep: "#5c3a2c",
    metal: "#9ca3af",
  },
  hair: {
    black: "#1f1a16",
    brown: "#3a2518",
    auburn: "#6a2f21",
    blonde: "#b89652",
    gray: "#707070",
    white: "#d6d0c8",
    red: "#7a2d22",
    blue: "#233a5a",
    green: "#24523a",
    purple: "#4a2d5a",
  },
  eyes: {
    black: "#151515",
    brown: "#5a3a22",
    blue: "#203a54",
    green: "#2d4d2f",
    hazel: "#6a5a2e",
    gray: "#59656d",
    amber: "#9a6b24",
    violet: "#493463",
  },
} as const;

export function humanizeFaceOption(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export const HarthmereVoxelFacePreview: React.FunctionComponent<{
  face: HarthmereVoxelFaceConfig;
  // Omit the "gender · pronouns" caption — used when the face is shown as a
  // small portrait (e.g. the business mini-game customer card) rather than as
  // the full character-creation preview.
  hideCaption?: boolean;
}> = ({ face, hideCaption }) => {
  const skin = FACE_COLOR_SWATCHES.skin[face.skinTone];
  const hair = FACE_COLOR_SWATCHES.hair[face.hairColor];
  const eye = FACE_COLOR_SWATCHES.eyes[face.eyeColor];
  const faceWidthByShape: Record<
    HarthmereVoxelFaceConfig["faceShape"],
    number
  > = {
    bolt_square: 80,
    wide: 96,
    narrow: 66,
    tall: 76,
    soft: 88,
  };
  const faceHeightByShape: Record<
    HarthmereVoxelFaceConfig["faceShape"],
    number
  > = {
    bolt_square: 80,
    wide: 76,
    narrow: 82,
    tall: 96,
    soft: 76,
  };
  const eyeSizeByShape: Record<HarthmereVoxelFaceConfig["eyeShape"], number> = {
    square: 12,
    wide: 18,
    small: 8,
    sleepy: 16,
    sharp: 15,
  };
  const eyeHeightByShape: Record<HarthmereVoxelFaceConfig["eyeShape"], number> =
    {
      square: 12,
      wide: 10,
      small: 8,
      sleepy: 5,
      sharp: 8,
    };
  const faceWidth = faceWidthByShape[face.faceShape];
  const faceHeight = faceHeightByShape[face.faceShape];
  const eyeSize = eyeSizeByShape[face.eyeShape];
  const eyeY =
    face.eyeShape === "sleepy" ? 36 : face.eyeShape === "sharp" ? 28 : 32;
  const mouthWidth =
    face.mouthStyle === "open"
      ? 16
      : face.mouthStyle === "stern"
      ? 26
      : face.mouthStyle === "smirk"
      ? 30
      : 38;
  const cheekColor =
    face.cheekStyle === "freckled"
      ? "#6a3c28"
      : face.cheekStyle === "strong"
      ? "rgba(120,70,50,0.65)"
      : "rgba(255,160,140,0.55)";
  const cheekSize =
    face.cheekStyle === "strong"
      ? { width: 18, height: 12 }
      : { width: 12, height: 8 };

  const hairBlocks = (() => {
    if (face.hairStyle === "shaved") {
      return [
        <div
          key="shaved"
          className="absolute left-0 top-[-4px] h-2 opacity-70"
          style={{ width: faceWidth, background: hair }}
        />,
      ];
    }
    if (face.hairStyle === "balding") {
      return [
        <div
          key="back"
          className="absolute left-[-3px] top-[-5px] h-3"
          style={{ width: faceWidth + 6, background: hair }}
        />,
        <div
          key="left"
          className="h-9 absolute left-[-7px] top-4 w-3"
          style={{ background: hair }}
        />,
        <div
          key="right"
          className="h-9 absolute right-[-7px] top-4 w-3"
          style={{ background: hair }}
        />,
      ];
    }
    if (face.hairStyle === "side_part") {
      return [
        <div
          key="top"
          className="absolute left-[-5px] top-[-9px] h-6"
          style={{ width: faceWidth + 10, background: hair }}
        />,
        <div
          key="part"
          className="bg-black/45 absolute top-[-8px] h-7 w-2"
          style={{ left: faceWidth * 0.62 }}
        />,
        <div
          key="sweep"
          className="absolute left-[-4px] top-2 h-4"
          style={{ width: faceWidth * 0.72, background: hair }}
        />,
      ];
    }
    if (face.hairStyle === "short_crown") {
      return [
        <div
          key="top"
          className="absolute left-[-6px] top-[-13px] h-8"
          style={{ width: faceWidth + 12, background: hair }}
        />,
        <div
          key="front"
          className="absolute left-2 top-2 h-5"
          style={{ width: faceWidth - 4, background: hair }}
        />,
      ];
    }
    if (face.hairStyle === "curly") {
      return [0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={`curl-${i}`}
          className="absolute rounded-sm"
          style={{
            left: -8 + i * ((faceWidth + 4) / 5),
            top: i % 2 === 0 ? -13 : -8,
            width: 18,
            height: 18,
            background: hair,
          }}
        />
      ));
    }
    if (face.hairStyle === "braids") {
      return [
        <div
          key="top"
          className="absolute left-[-5px] top-[-9px] h-5"
          style={{ width: faceWidth + 10, background: hair }}
        />,
        <div
          key="left-braid"
          className="h-14 absolute left-[-12px] top-6 w-4"
          style={{ background: hair }}
        />,
        <div
          key="right-braid"
          className="h-14 absolute right-[-12px] top-6 w-4"
          style={{ background: hair }}
        />,
        <div
          key="left-tie"
          className="bg-yellow-500 absolute left-[-13px] top-[68px] h-2 w-5"
        />,
        <div
          key="right-tie"
          className="bg-yellow-500 absolute right-[-13px] top-[68px] h-2 w-5"
        />,
      ];
    }
    if (face.hairStyle === "bob") {
      return [
        <div
          key="top"
          className="absolute left-[-6px] top-[-10px] h-6"
          style={{ width: faceWidth + 12, background: hair }}
        />,
        <div
          key="left"
          className="absolute left-[-9px] top-3 h-12 w-4"
          style={{ background: hair }}
        />,
        <div
          key="right"
          className="absolute right-[-9px] top-3 h-12 w-4"
          style={{ background: hair }}
        />,
        <div
          key="bangs"
          className="absolute left-0 top-1 h-4"
          style={{ width: faceWidth, background: hair }}
        />,
      ];
    }
    if (face.hairStyle === "long") {
      return [
        <div
          key="top"
          className="absolute left-[-6px] top-[-10px] h-6"
          style={{ width: faceWidth + 12, background: hair }}
        />,
        <div
          key="back"
          className="absolute left-[-8px] top-6 h-20"
          style={{ width: faceWidth + 16, background: hair }}
        />,
        <div
          key="left"
          className="absolute left-[-12px] top-4 h-16 w-5"
          style={{ background: hair }}
        />,
        <div
          key="right"
          className="absolute right-[-12px] top-4 h-16 w-5"
          style={{ background: hair }}
        />,
      ];
    }
    if (face.hairStyle === "bun") {
      return [
        <div
          key="top"
          className="absolute left-[-5px] top-[-9px] h-5"
          style={{ width: faceWidth + 10, background: hair }}
        />,
        <div
          key="bun"
          className="absolute left-1/2 top-[-22px] h-6 w-8 -translate-x-1/2 rounded-sm"
          style={{ background: hair }}
        />,
        <div
          key="front"
          className="absolute left-3 top-1 h-3"
          style={{ width: faceWidth * 0.55, background: hair }}
        />,
      ];
    }
    if (face.hairStyle === "pigtails") {
      return [
        <div
          key="top"
          className="absolute left-[-5px] top-[-9px] h-5"
          style={{ width: faceWidth + 10, background: hair }}
        />,
        <div
          key="left-pig"
          className="absolute left-[-20px] top-7 h-12 w-5"
          style={{ background: hair }}
        />,
        <div
          key="right-pig"
          className="absolute right-[-20px] top-7 h-12 w-5"
          style={{ background: hair }}
        />,
        <div
          key="left-tie"
          className="bg-yellow-500 absolute left-[-21px] top-7 h-2 w-6"
        />,
        <div
          key="right-tie"
          className="bg-yellow-500 absolute right-[-21px] top-7 h-2 w-6"
        />,
      ];
    }
    if (face.hairStyle === "wavy") {
      return [
        <div
          key="top"
          className="absolute left-[-7px] top-[-11px] h-6"
          style={{ width: faceWidth + 14, background: hair }}
        />,
        ...[0, 1, 2, 3].map((i) => (
          <div
            key={`wave-${i}`}
            className="absolute rounded-sm"
            style={{
              left: -6 + i * ((faceWidth + 4) / 3),
              top: i % 2 === 0 ? 1 : 6,
              width: 16,
              height: 12,
              background: hair,
            }}
          />
        )),
        <div
          key="left"
          className="absolute left-[-9px] top-5 h-12 w-4"
          style={{ background: hair }}
        />,
        <div
          key="right"
          className="absolute right-[-9px] top-5 h-12 w-4"
          style={{ background: hair }}
        />,
      ];
    }
    if (face.hairStyle === "hood") {
      return [
        <div
          key="hood"
          className="rounded-t-xl absolute left-[-12px] top-[-14px] border-4 border-black/30"
          style={{
            width: faceWidth + 24,
            height: faceHeight + 18,
            background: hair,
          }}
        />,
      ];
    }
    if (face.hairStyle === "cap") {
      return [
        <div
          key="cap"
          className="absolute left-[-8px] top-[-14px] h-7 rounded-t-md"
          style={{ width: faceWidth + 16, background: hair }}
        />,
        <div
          key="brim"
          className="absolute left-[-14px] top-1 h-4"
          style={{ width: faceWidth + 28, background: hair }}
        />,
      ];
    }
    return [
      <div
        key="flat"
        className="absolute left-[-5px] top-[-9px] h-6"
        style={{ width: faceWidth + 10, background: hair }}
      />,
      <div
        key="left"
        className="absolute left-[-7px] top-2 h-7 w-3"
        style={{ background: hair }}
      />,
      <div
        key="right"
        className="absolute right-[-7px] top-2 h-7 w-3"
        style={{ background: hair }}
      />,
    ];
  })();

  return (
    <div className="rounded-xl border-white/15 flex flex-col items-center gap-1 border bg-black/25 p-3">
      <div
        className="relative rounded-sm border-2 border-black/40"
        style={{
          width: faceWidth,
          height: faceHeight,
          background: skin,
          boxShadow: "0 6px 0 rgba(0,0,0,0.2) inset",
        }}
      >
        {hairBlocks}
        {face.accessory === "cap" && (
          <div
            className="absolute left-[-14px] top-[-5px] h-4"
            style={{ width: faceWidth + 28, background: hair }}
          />
        )}
        {face.accessory === "hood" && (
          <div
            className="rounded-t-xl absolute left-[-15px] top-[-16px] border-4 border-black/30"
            style={{
              width: faceWidth + 30,
              height: faceHeight + 26,
              background: hair,
              zIndex: -1,
            }}
          />
        )}
        {face.accessory === "headband" && (
          <div
            className="bg-yellow-500 absolute left-[-4px] top-4 h-3"
            style={{ width: faceWidth + 8 }}
          />
        )}
        {face.accessory === "spectacles" && (
          <>
            <div
              className="border-yellow-100/80 absolute rounded-sm border-2"
              style={{
                left: faceWidth / 2 - 30,
                top: eyeY - 3,
                width: 20,
                height: 18,
              }}
            />
            <div
              className="border-yellow-100/80 absolute rounded-sm border-2"
              style={{
                left: faceWidth / 2 + 9,
                top: eyeY - 3,
                width: 20,
                height: 18,
              }}
            />
            <div
              className="bg-yellow-100/80 absolute"
              style={{
                left: faceWidth / 2 - 8,
                top: eyeY + 5,
                width: 16,
                height: 2,
              }}
            />
          </>
        )}
        <div
          className="absolute rounded-sm"
          style={{
            left: faceWidth / 2 - 23,
            top: eyeY,
            width: eyeSize,
            height: eyeHeightByShape[face.eyeShape],
            background: eye,
          }}
        />
        <div
          className="absolute rounded-sm"
          style={{
            left: faceWidth / 2 + 12,
            top: eyeY,
            width: eyeSize,
            height: eyeHeightByShape[face.eyeShape],
            background: eye,
          }}
        />
        <div
          className="absolute bg-black/50"
          style={{
            left: faceWidth / 2 - 25,
            top: eyeY - (face.browStyle === "arched" ? 12 : 9),
            width: 20,
            height: 3,
          }}
        />
        <div
          className="absolute bg-black/50"
          style={{
            left: faceWidth / 2 + 8,
            top: eyeY - (face.browStyle === "stern" ? 12 : 9),
            width: 20,
            height: 3,
          }}
        />
        <div
          className="absolute bg-black/20"
          style={{
            left: faceWidth / 2 - 5,
            top: faceHeight / 2 - 2,
            width: face.noseStyle === "wide" ? 14 : 10,
            height: face.noseStyle === "long" ? 20 : 14,
          }}
        />
        {face.cheekStyle !== "none" && (
          <>
            <div
              className="absolute rounded-sm"
              style={{
                left: faceWidth / 2 - 34,
                top: faceHeight - 34,
                width: cheekSize.width,
                height: cheekSize.height,
                background: cheekColor,
              }}
            />
            <div
              className="absolute rounded-sm"
              style={{
                left: faceWidth / 2 + 23,
                top: faceHeight - 34,
                width: cheekSize.width,
                height: cheekSize.height,
                background: cheekColor,
              }}
            />
            {face.cheekStyle === "freckled" && (
              <>
                <div
                  className="absolute h-1 w-1 bg-black/60"
                  style={{ left: faceWidth / 2 - 28, top: faceHeight - 28 }}
                />
                <div
                  className="absolute h-1 w-1 bg-black/60"
                  style={{ left: faceWidth / 2 + 28, top: faceHeight - 29 }}
                />
                <div
                  className="absolute h-1 w-1 bg-black/60"
                  style={{ left: faceWidth / 2 - 18, top: faceHeight - 31 }}
                />
              </>
            )}
          </>
        )}
        <div
          className="bg-red-950 absolute"
          style={{
            left: faceWidth / 2 - mouthWidth / 2,
            top: faceHeight - 22,
            width: mouthWidth,
            height:
              face.mouthStyle === "open"
                ? 12
                : face.mouthStyle === "stern"
                ? 3
                : 4,
          }}
        />
        {face.facialHair !== "none" && (
          <div
            className="absolute"
            style={{
              left: faceWidth / 2 - 24,
              top: faceHeight - 26,
              width: 48,
              height:
                face.facialHair === "mustache"
                  ? 6
                  : face.facialHair === "full_beard"
                  ? 26
                  : 16,
              background: hair,
            }}
          />
        )}
      </div>
      {!hideCaption && (
        <div className="text-xs text-white/75">
          {humanizeFaceOption(face.genderIdentity)} · {face.pronouns}
        </div>
      )}
    </div>
  );
};
