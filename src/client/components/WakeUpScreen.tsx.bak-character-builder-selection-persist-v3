import { WakeupMuckParticles } from "@/client/components/Particles";
import { setCanvasEffect } from "@/client/components/canvas_effects";
import { ClickToContinue } from "@/client/components/challenges/TalkDialogModalStep";
import { Typer } from "@/client/components/challenges/Typer";
import {
  CharacterPreview,
  makePreviewSlot,
} from "@/client/components/character/CharacterPreview";
import { EditCharacterColorSelector } from "@/client/components/character/EditCharacterColorSelector";
import {
  usePreviewAppearance,
  usePreviewHair,
} from "@/client/components/character/EditCharacterScreen";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { usePointerLockManager } from "@/client/components/contexts/PointerLockContext";
import { TalkToInput } from "@/client/components/modals/robot/TalkToRobotModal";
import { DialogButton } from "@/client/components/system/DialogButton";
import { MaybeError, useError } from "@/client/components/system/MaybeError";
import type { ClientContextSubset } from "@/client/game/context";
import { makeWakeUpScreenshot } from "@/client/game/util/report";
import { saveUsername } from "@/client/util/auth";
import { isInitialUsername } from "@/server/web/util/username";
import {
  AppearanceChangeEvent,
  HairTransplantEvent,
  PlayerInitEvent,
} from "@/shared/ecs/gen/events";
import { reportFunnelStage } from "@/shared/funnel";
import {
  HARTHMERE_ARM_LENGTHS,
  HARTHMERE_BODY_HEIGHTS,
  HARTHMERE_BODY_STANCES,
  HARTHMERE_BODY_TYPES,
  HARTHMERE_BROW_STYLES,
  HARTHMERE_CHEEK_STYLES,
  HARTHMERE_EYE_COLORS,
  HARTHMERE_EYE_SHAPES,
  HARTHMERE_FACE_ACCESSORIES,
  HARTHMERE_FACE_SHAPES,
  HARTHMERE_FACIAL_HAIR_STYLES,
  HARTHMERE_GENDER_OPTIONS,
  HARTHMERE_HAIR_COLORS,
  HARTHMERE_HAIR_STYLES,
  HARTHMERE_LEG_LENGTHS,
  HARTHMERE_MOUTH_STYLES,
  HARTHMERE_NOSE_STYLES,
  HARTHMERE_OUTFIT_COLORS,
  HARTHMERE_PRONOUN_OPTIONS,
  HARTHMERE_SHOULDER_WIDTHS,
  HARTHMERE_SKIN_TONES,
  defaultPronounsForGender,
  loadHarthmerePlayerBodyConfig,
  loadHarthmerePlayerFaceConfig,
  migrateHarthmereAnonymousCustomizationToUser,
  saveHarthmerePlayerBodyConfig,
  saveHarthmerePlayerFaceConfig,
  type HarthmereVoxelBodyConfig,
  type HarthmereVoxelFaceConfig,
} from "@/shared/harthmere/voxel_faces";
import { fireAndForget } from "@/shared/util/async";
import { motion } from "framer-motion";
import type { PropsWithChildren } from "react";
import { useEffect, useState } from "react";
import { MathUtils, Spherical, Vector3 } from "three";

export type WakeUpState = "initial" | "name-entry" | "character" | "waking";

export function shouldPromptWakeupScreen(
  deps: ClientContextSubset<"resources" | "userId" | "clientConfig">
) {
  return (
    deps.clientConfig.forceCharacterSetup ||
    deps.resources.get("/ecs/c/player_status", deps.userId)?.init === false
  );
}

const WakeUpText: React.FunctionComponent<
  PropsWithChildren<{
    heading: string;
    onTypingComplete?: () => any;
    onClick?: () => any;
    className?: string;
  }>
> = ({ heading, onTypingComplete, onClick, className, children }) => {
  return (
    <div
      className={`${className ?? "w-1/2"} flex flex-col content-center items-center gap-2 text-center`}
      onClick={() => onClick?.()}
    >
      <Typer
        string={heading}
        extraClassNames="text-xxl font-semibold text-shadow-bordered"
        onTypeComplete={() => {
          onTypingComplete?.();
        }}
        beginTyping={true}
        shouldFinishTyping={false}
      />
      {children}
    </div>
  );
};


const FACE_COLOR_SWATCHES = {
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

const BODY_COLOR_SWATCHES = {
  earth: "#7a5538",
  forest: "#2f5f43",
  river: "#315b78",
  ember: "#88432e",
  royal: "#5b3d83",
  ash: "#5d646b",
} as const;

function humanizeFaceOption(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) =>
    letter.toUpperCase(),
  );
}

const HarthmereFaceOptionRow = <T extends string>({
  label,
  options,
  value,
  onChange,
  labelFor,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  labelFor?: (value: T) => string;
}) => {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs font-semibold uppercase tracking-wide text-white/70">
        {label}
      </div>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={`rounded-md border px-2 py-1 text-xs transition ${
              option === value
                ? "border-white bg-white/25 text-white"
                : "border-white/20 bg-black/25 text-white/75 hover:bg-white/10"
            }`}
            onClick={() => onChange(option)}
          >
            {labelFor?.(option) ?? humanizeFaceOption(option)}
          </button>
        ))}
      </div>
    </div>
  );
};

const HarthmereVoxelFacePreview: React.FunctionComponent<{
  face: HarthmereVoxelFaceConfig;
}> = ({ face }) => {
  const skin = FACE_COLOR_SWATCHES.skin[face.skinTone];
  const hair = FACE_COLOR_SWATCHES.hair[face.hairColor];
  const eye = FACE_COLOR_SWATCHES.eyes[face.eyeColor];
  const faceWidthByShape: Record<HarthmereVoxelFaceConfig["faceShape"], number> = {
    bolt_square: 80,
    wide: 96,
    narrow: 66,
    tall: 76,
    soft: 88,
  };
  const faceHeightByShape: Record<HarthmereVoxelFaceConfig["faceShape"], number> = {
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
  const eyeHeightByShape: Record<HarthmereVoxelFaceConfig["eyeShape"], number> = {
    square: 12,
    wide: 10,
    small: 8,
    sleepy: 5,
    sharp: 8,
  };
  const faceWidth = faceWidthByShape[face.faceShape];
  const faceHeight = faceHeightByShape[face.faceShape];
  const eyeSize = eyeSizeByShape[face.eyeShape];
  const eyeY = face.eyeShape === "sleepy" ? 36 : face.eyeShape === "sharp" ? 28 : 32;
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
  const cheekSize = face.cheekStyle === "strong" ? { width: 18, height: 12 } : { width: 12, height: 8 };

  const hairBlocks = (() => {
    if (face.hairStyle === "shaved") {
      return [
        <div key="shaved" className="absolute left-0 top-[-4px] h-2 opacity-70" style={{ width: faceWidth, background: hair }} />,
      ];
    }
    if (face.hairStyle === "balding") {
      return [
        <div key="back" className="absolute left-[-3px] top-[-5px] h-3" style={{ width: faceWidth + 6, background: hair }} />,
        <div key="left" className="absolute left-[-7px] top-4 h-9 w-3" style={{ background: hair }} />,
        <div key="right" className="absolute right-[-7px] top-4 h-9 w-3" style={{ background: hair }} />,
      ];
    }
    if (face.hairStyle === "side_part") {
      return [
        <div key="top" className="absolute left-[-5px] top-[-9px] h-6" style={{ width: faceWidth + 10, background: hair }} />,
        <div key="part" className="absolute top-[-8px] h-7 w-2 bg-black/45" style={{ left: faceWidth * 0.62 }} />,
        <div key="sweep" className="absolute left-[-4px] top-2 h-4" style={{ width: faceWidth * 0.72, background: hair }} />,
      ];
    }
    if (face.hairStyle === "short_crown") {
      return [
        <div key="top" className="absolute left-[-6px] top-[-13px] h-8" style={{ width: faceWidth + 12, background: hair }} />,
        <div key="front" className="absolute left-2 top-2 h-5" style={{ width: faceWidth - 4, background: hair }} />,
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
        <div key="top" className="absolute left-[-5px] top-[-9px] h-5" style={{ width: faceWidth + 10, background: hair }} />,
        <div key="left-braid" className="absolute left-[-12px] top-6 h-14 w-4" style={{ background: hair }} />,
        <div key="right-braid" className="absolute right-[-12px] top-6 h-14 w-4" style={{ background: hair }} />,
        <div key="left-tie" className="absolute left-[-13px] top-[68px] h-2 w-5 bg-yellow-500" />,
        <div key="right-tie" className="absolute right-[-13px] top-[68px] h-2 w-5 bg-yellow-500" />,
      ];
    }
    if (face.hairStyle === "bob") {
      return [
        <div key="top" className="absolute left-[-6px] top-[-10px] h-6" style={{ width: faceWidth + 12, background: hair }} />,
        <div key="left" className="absolute left-[-9px] top-3 h-12 w-4" style={{ background: hair }} />,
        <div key="right" className="absolute right-[-9px] top-3 h-12 w-4" style={{ background: hair }} />,
        <div key="bangs" className="absolute left-0 top-1 h-4" style={{ width: faceWidth, background: hair }} />,
      ];
    }
    if (face.hairStyle === "long") {
      return [
        <div key="top" className="absolute left-[-6px] top-[-10px] h-6" style={{ width: faceWidth + 12, background: hair }} />,
        <div key="back" className="absolute left-[-8px] top-6 h-20" style={{ width: faceWidth + 16, background: hair }} />,
        <div key="left" className="absolute left-[-12px] top-4 h-16 w-5" style={{ background: hair }} />,
        <div key="right" className="absolute right-[-12px] top-4 h-16 w-5" style={{ background: hair }} />,
      ];
    }
    if (face.hairStyle === "bun") {
      return [
        <div key="top" className="absolute left-[-5px] top-[-9px] h-5" style={{ width: faceWidth + 10, background: hair }} />,
        <div key="bun" className="absolute left-1/2 top-[-22px] h-6 w-8 -translate-x-1/2 rounded-sm" style={{ background: hair }} />,
        <div key="front" className="absolute left-3 top-1 h-3" style={{ width: faceWidth * 0.55, background: hair }} />,
      ];
    }
    if (face.hairStyle === "pigtails") {
      return [
        <div key="top" className="absolute left-[-5px] top-[-9px] h-5" style={{ width: faceWidth + 10, background: hair }} />,
        <div key="left-pig" className="absolute left-[-20px] top-7 h-12 w-5" style={{ background: hair }} />,
        <div key="right-pig" className="absolute right-[-20px] top-7 h-12 w-5" style={{ background: hair }} />,
        <div key="left-tie" className="absolute left-[-21px] top-7 h-2 w-6 bg-yellow-500" />,
        <div key="right-tie" className="absolute right-[-21px] top-7 h-2 w-6 bg-yellow-500" />,
      ];
    }
    if (face.hairStyle === "wavy") {
      return [
        <div key="top" className="absolute left-[-7px] top-[-11px] h-6" style={{ width: faceWidth + 14, background: hair }} />,
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
        <div key="left" className="absolute left-[-9px] top-5 h-12 w-4" style={{ background: hair }} />,
        <div key="right" className="absolute right-[-9px] top-5 h-12 w-4" style={{ background: hair }} />,
      ];
    }
    if (face.hairStyle === "hood") {
      return [
        <div key="hood" className="absolute left-[-12px] top-[-14px] rounded-t-xl border-4 border-black/30" style={{ width: faceWidth + 24, height: faceHeight + 18, background: hair }} />,
      ];
    }
    if (face.hairStyle === "cap") {
      return [
        <div key="cap" className="absolute left-[-8px] top-[-14px] h-7 rounded-t-md" style={{ width: faceWidth + 16, background: hair }} />,
        <div key="brim" className="absolute left-[-14px] top-1 h-4" style={{ width: faceWidth + 28, background: hair }} />,
      ];
    }
    return [
      <div key="flat" className="absolute left-[-5px] top-[-9px] h-6" style={{ width: faceWidth + 10, background: hair }} />,
      <div key="left" className="absolute left-[-7px] top-2 h-7 w-3" style={{ background: hair }} />,
      <div key="right" className="absolute right-[-7px] top-2 h-7 w-3" style={{ background: hair }} />,
    ];
  })();

  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-white/15 bg-black/25 p-3">
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
            className="absolute left-[-15px] top-[-16px] rounded-t-xl border-4 border-black/30"
            style={{ width: faceWidth + 30, height: faceHeight + 26, background: hair, zIndex: -1 }}
          />
        )}
        {face.accessory === "headband" && (
          <div className="absolute left-[-4px] top-4 h-3 bg-yellow-500" style={{ width: faceWidth + 8 }} />
        )}
        {face.accessory === "spectacles" && (
          <>
            <div className="absolute rounded-sm border-2 border-yellow-100/80" style={{ left: faceWidth / 2 - 30, top: eyeY - 3, width: 20, height: 18 }} />
            <div className="absolute rounded-sm border-2 border-yellow-100/80" style={{ left: faceWidth / 2 + 9, top: eyeY - 3, width: 20, height: 18 }} />
            <div className="absolute bg-yellow-100/80" style={{ left: faceWidth / 2 - 8, top: eyeY + 5, width: 16, height: 2 }} />
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
          style={{ left: faceWidth / 2 - 25, top: eyeY - (face.browStyle === "arched" ? 12 : 9), width: 20, height: 3 }}
        />
        <div
          className="absolute bg-black/50"
          style={{ left: faceWidth / 2 + 8, top: eyeY - (face.browStyle === "stern" ? 12 : 9), width: 20, height: 3 }}
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
            <div className="absolute rounded-sm" style={{ left: faceWidth / 2 - 34, top: faceHeight - 34, width: cheekSize.width, height: cheekSize.height, background: cheekColor }} />
            <div className="absolute rounded-sm" style={{ left: faceWidth / 2 + 23, top: faceHeight - 34, width: cheekSize.width, height: cheekSize.height, background: cheekColor }} />
            {face.cheekStyle === "freckled" && (
              <>
                <div className="absolute h-1 w-1 bg-black/60" style={{ left: faceWidth / 2 - 28, top: faceHeight - 28 }} />
                <div className="absolute h-1 w-1 bg-black/60" style={{ left: faceWidth / 2 + 28, top: faceHeight - 29 }} />
                <div className="absolute h-1 w-1 bg-black/60" style={{ left: faceWidth / 2 - 18, top: faceHeight - 31 }} />
              </>
            )}
          </>
        )}
        <div
          className="absolute bg-red-950"
          style={{
            left: faceWidth / 2 - mouthWidth / 2,
            top: faceHeight - 22,
            width: mouthWidth,
            height: face.mouthStyle === "open" ? 12 : face.mouthStyle === "stern" ? 3 : 4,
          }}
        />
        {face.facialHair !== "none" && (
          <div
            className="absolute"
            style={{
              left: faceWidth / 2 - 24,
              top: faceHeight - 26,
              width: 48,
              height: face.facialHair === "mustache" ? 6 : face.facialHair === "full_beard" ? 26 : 16,
              background: hair,
            }}
          />
        )}
      </div>
      <div className="text-xs text-white/75">
        {humanizeFaceOption(face.genderIdentity)} · {face.pronouns}
      </div>
    </div>
  );
};

const HarthmereVoxelBodyPreview: React.FunctionComponent<{
  body: HarthmereVoxelBodyConfig;
}> = ({ body }) => {
  const torsoColor = BODY_COLOR_SWATCHES[body.outfitColor];
  const bodyTypeMap: Record<HarthmereVoxelBodyConfig["bodyType"], { width: number; torsoExtra: number; waistExtra: number; marker?: string }> = {
    average: { width: 58, torsoExtra: 0, waistExtra: 0 },
    slim: { width: 46, torsoExtra: -4, waistExtra: -8 },
    broad: { width: 72, torsoExtra: 8, waistExtra: 2 },
    stocky: { width: 76, torsoExtra: 2, waistExtra: 8 },
    athletic: { width: 64, torsoExtra: 10, waistExtra: -4, marker: "chest" },
    soft: { width: 66, torsoExtra: 0, waistExtra: 10, marker: "waist" },
  };
  const heightMap: Record<HarthmereVoxelBodyConfig["bodyHeight"], number> = {
    short: 84,
    average: 94,
    tall: 104,
    very_tall: 116,
  };
  const shoulderBonus: Record<HarthmereVoxelBodyConfig["shoulderWidth"], number> = {
    narrow: 6,
    average: 16,
    wide: 32,
  };
  const armLengthMap: Record<HarthmereVoxelBodyConfig["armLength"], number> = {
    short: 40,
    average: 50,
    long: 64,
  };
  const legLengthMap: Record<HarthmereVoxelBodyConfig["legLength"], number> = {
    short: 32,
    average: 42,
    long: 54,
  };
  const stanceMap: Record<HarthmereVoxelBodyConfig["stance"], { armOffset: number; legSpread: number; badge?: string }> = {
    relaxed: { armOffset: 0, legSpread: 0 },
    upright: { armOffset: -2, legSpread: 2, badge: "collar" },
    heroic: { armOffset: 5, legSpread: 8, badge: "sash" },
    reserved: { armOffset: -5, legSpread: -3, badge: "line" },
  };
  const bodyType = bodyTypeMap[body.bodyType];
  const width = bodyType.width;
  const height = heightMap[body.bodyHeight];
  const shoulders = width + shoulderBonus[body.shoulderWidth];
  const arm = armLengthMap[body.armLength];
  const legs = legLengthMap[body.legLength];
  const stance = stanceMap[body.stance];
  const torsoHeight = height - legs;
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-white/15 bg-black/25 p-3">
      <div className="relative" style={{ width: 128, height: 148 }}>
        <div
          className="absolute left-1/2 top-1 h-5 -translate-x-1/2 rounded-sm bg-white/25"
          style={{ width: shoulders }}
        />
        <div
          className="absolute left-1/2 top-6 -translate-x-1/2 rounded-sm border-2 border-black/35"
          style={{ width: width + bodyType.torsoExtra, height: torsoHeight, background: torsoColor }}
        />
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-sm bg-black/30"
          style={{ top: 28 + torsoHeight - 13, width: width + bodyType.waistExtra, height: 12 }}
        />
        <div
          className="absolute top-8 rounded-sm bg-white/30"
          style={{ left: 8 + stance.armOffset, width: 14, height: arm }}
        />
        <div
          className="absolute top-8 rounded-sm bg-white/30"
          style={{ right: 8 + stance.armOffset, width: 14, height: arm }}
        />
        <div
          className="absolute rounded-sm bg-black/35"
          style={{ left: 42 - stance.legSpread, top: height - 4, width: 16, height: legs }}
        />
        <div
          className="absolute rounded-sm bg-black/35"
          style={{ right: 42 - stance.legSpread, top: height - 4, width: 16, height: legs }}
        />
        {bodyType.marker === "chest" && (
          <div className="absolute left-1/2 top-10 h-3 w-16 -translate-x-1/2 bg-white/40" />
        )}
        {bodyType.marker === "waist" && (
          <div className="absolute left-1/2 top-[74px] h-4 w-20 -translate-x-1/2 bg-white/25" />
        )}
        {stance.badge === "sash" && <div className="absolute left-1/2 top-2 h-3 w-20 -translate-x-1/2 bg-yellow-400/70" />}
        {stance.badge === "line" && <div className="absolute left-1/2 top-7 h-16 w-1 -translate-x-1/2 bg-black/45" />}
        {stance.badge === "collar" && <div className="absolute left-1/2 top-6 h-2 w-14 -translate-x-1/2 bg-white/50" />}
      </div>
      <div className="text-xs text-white/75">
        {humanizeFaceOption(body.bodyType)} · {humanizeFaceOption(body.bodyHeight)}
      </div>
    </div>
  );
};

const CharacterWakeupContent: React.FunctionComponent<{
  onComplete: () => void;
}> = ({ onComplete }) => {
  const { userId, events } = useClientContext();
  const [previewAppearance, setPreviewAppearance] = usePreviewAppearance();
  const [previewHair, setPreviewHair, wearableOverrides] = usePreviewHair();
  const [harthmereFace, setHarthmereFace] = useState(() =>
    loadHarthmerePlayerFaceConfig(userId),
  );
  const [harthmereBody, setHarthmereBody] = useState(() =>
    loadHarthmerePlayerBodyConfig(userId),
  );

  useEffect(() => {
    migrateHarthmereAnonymousCustomizationToUser(userId);
    setHarthmereFace(loadHarthmerePlayerFaceConfig(userId));
    setHarthmereBody(loadHarthmerePlayerBodyConfig(userId));
  }, [userId]);

  useEffect(() => {
    saveHarthmerePlayerFaceConfig(userId, harthmereFace);
  }, [userId, harthmereFace]);

  useEffect(() => {
    saveHarthmerePlayerBodyConfig(userId, harthmereBody);
  }, [userId, harthmereBody]);

  const updateHarthmereFace = (patch: Partial<HarthmereVoxelFaceConfig>) => {
    setHarthmereFace((current) => {
      const next = { ...current, ...patch };
      if (patch.genderIdentity && !patch.pronouns) {
        next.pronouns = defaultPronounsForGender(patch.genderIdentity);
      }
      // Save synchronously so the 3D player preview can rebuild from the new
      // face config immediately, instead of waiting for an unrelated body
      // appearance change to invalidate the cached mesh.
      saveHarthmerePlayerFaceConfig(userId, next);
      return next;
    });
  };

  const updateHarthmereBody = (patch: Partial<HarthmereVoxelBodyConfig>) => {
    setHarthmereBody((current) => {
      const next = { ...current, ...patch };
      saveHarthmerePlayerBodyConfig(userId, next);
      return next;
    });
  };

  const harthmereFacePreviewKey = JSON.stringify({
    face: harthmereFace,
    body: harthmereBody,
  });

  useEffect(() => {
    fireAndForget(events.publish(new PlayerInitEvent({ id: userId })));
    fireAndForget(
      events.publish(
        new AppearanceChangeEvent({
          id: userId,
          appearance: previewAppearance,
        })
      )
    );
    fireAndForget(
      events.publish(
        new HairTransplantEvent({
          id: userId,
          newHairId: previewHair?.id,
        })
      )
    );
  }, [
    previewAppearance.eye_color_id,
    previewAppearance.hair_color_id,
    previewAppearance.head_id,
    previewAppearance.skin_color_id,
    previewHair?.id,
  ]);

  return (
    <>
      <WakeUpText
        heading="You try to picture someone..."
        className="w-[min(92rem,98vw)] py-3"
      >
        <div className="grid h-[min(44rem,calc(100vh-9rem))] w-full grid-cols-1 gap-3 text-left lg:grid-cols-[22rem_minmax(0,1fr)_20rem]">
          <aside className="flex min-h-0 flex-col gap-3 rounded-2xl border border-white/15 bg-black/35 p-3 shadow-xl">
            <div className="text-center text-xs font-semibold uppercase tracking-wide text-white/70">
              Live preview
            </div>
            <div className="preview-container min-h-0 flex-1 w-full">
              <CharacterPreview
                key={harthmereFacePreviewKey}
                previewSlot={makePreviewSlot("appearencePreview")}
                meshVersionKey={harthmereFacePreviewKey}
                disableLoadingBlur={true}
                appearanceOverride={previewAppearance}
                wearableOverrides={wearableOverrides}
                controlTarget={new Vector3(0, 1, 0)}
                cameraPos={new Vector3().setFromSpherical(
                  new Spherical(
                    3.3,
                    MathUtils.degToRad(65),
                    MathUtils.degToRad(190)
                  )
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <HarthmereVoxelFacePreview face={harthmereFace} />
              <HarthmereVoxelBodyPreview body={harthmereBody} />
            </div>
            <p className="text-xs leading-snug text-white/60">
              The preview stays visible while you change body and face controls.
              Body type and outfit color swap the installed GLTF variant; the
              remaining controls layer on top as live transforms/voxel pieces.
            </p>
          </aside>

          <section className="min-h-0 overflow-y-auto rounded-2xl border border-white/15 bg-black/35 p-3 shadow-xl">
            <div className="sticky top-0 z-10 mb-3 border-b border-white/10 bg-black/80 pb-2 text-sm font-semibold uppercase tracking-wide text-white">
              Identity & face
            </div>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              <HarthmereFaceOptionRow
                label="Gender"
                options={HARTHMERE_GENDER_OPTIONS.map((option) => option.id)}
                value={harthmereFace.genderIdentity}
                onChange={(genderIdentity) => updateHarthmereFace({ genderIdentity })}
                labelFor={(value) =>
                  HARTHMERE_GENDER_OPTIONS.find((option) => option.id === value)
                    ?.label ?? humanizeFaceOption(value)
                }
              />
              <HarthmereFaceOptionRow
                label="Pronouns"
                options={HARTHMERE_PRONOUN_OPTIONS}
                value={harthmereFace.pronouns}
                onChange={(pronouns) => updateHarthmereFace({ pronouns })}
              />
              {harthmereFace.pronouns === "custom" && (
                <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-white/70 xl:col-span-2">
                  Custom pronouns
                  <input
                    className="rounded-md border border-white/20 bg-black/35 px-2 py-1 text-sm normal-case text-white outline-none"
                    placeholder="for example: fae/faer"
                    value={harthmereFace.customPronouns ?? ""}
                    onChange={(event) =>
                      updateHarthmereFace({ customPronouns: event.target.value })
                    }
                  />
                </label>
              )}
              <HarthmereFaceOptionRow
                label="Skin"
                options={HARTHMERE_SKIN_TONES}
                value={harthmereFace.skinTone}
                onChange={(skinTone) => updateHarthmereFace({ skinTone })}
              />
              <HarthmereFaceOptionRow
                label="Face shape"
                options={HARTHMERE_FACE_SHAPES}
                value={harthmereFace.faceShape}
                onChange={(faceShape) => updateHarthmereFace({ faceShape })}
              />
              <HarthmereFaceOptionRow
                label="Eyes"
                options={HARTHMERE_EYE_SHAPES}
                value={harthmereFace.eyeShape}
                onChange={(eyeShape) => updateHarthmereFace({ eyeShape })}
              />
              <HarthmereFaceOptionRow
                label="Eye color"
                options={HARTHMERE_EYE_COLORS}
                value={harthmereFace.eyeColor}
                onChange={(eyeColor) => updateHarthmereFace({ eyeColor })}
              />
              <HarthmereFaceOptionRow
                label="Brows"
                options={HARTHMERE_BROW_STYLES}
                value={harthmereFace.browStyle}
                onChange={(browStyle) => updateHarthmereFace({ browStyle })}
              />
              <HarthmereFaceOptionRow
                label="Nose"
                options={HARTHMERE_NOSE_STYLES}
                value={harthmereFace.noseStyle}
                onChange={(noseStyle) => updateHarthmereFace({ noseStyle })}
              />
              <HarthmereFaceOptionRow
                label="Mouth"
                options={HARTHMERE_MOUTH_STYLES}
                value={harthmereFace.mouthStyle}
                onChange={(mouthStyle) => updateHarthmereFace({ mouthStyle })}
              />
              <HarthmereFaceOptionRow
                label="Hair style"
                options={HARTHMERE_HAIR_STYLES}
                value={harthmereFace.hairStyle}
                onChange={(hairStyle) => updateHarthmereFace({ hairStyle })}
              />
              <HarthmereFaceOptionRow
                label="Hair color"
                options={HARTHMERE_HAIR_COLORS}
                value={harthmereFace.hairColor}
                onChange={(hairColor) => updateHarthmereFace({ hairColor })}
              />
              <HarthmereFaceOptionRow
                label="Facial hair"
                options={HARTHMERE_FACIAL_HAIR_STYLES}
                value={harthmereFace.facialHair}
                onChange={(facialHair) => updateHarthmereFace({ facialHair })}
              />
              <HarthmereFaceOptionRow
                label="Cheeks"
                options={HARTHMERE_CHEEK_STYLES}
                value={harthmereFace.cheekStyle}
                onChange={(cheekStyle) => updateHarthmereFace({ cheekStyle })}
              />
              <HarthmereFaceOptionRow
                label="Accessory"
                options={HARTHMERE_FACE_ACCESSORIES}
                value={harthmereFace.accessory}
                onChange={(accessory) => updateHarthmereFace({ accessory })}
              />
            </div>
            <details className="mt-4 rounded-xl border border-white/10 bg-black/25 p-3">
              <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-white/75">
                Classic base colors
              </summary>
              <div className="edit-character mt-3 w-full">
                <EditCharacterColorSelector
                  previewAppearance={previewAppearance}
                  setPreviewAppearance={setPreviewAppearance}
                  setPreviewHair={setPreviewHair}
                  previewHair={previewHair}
                  showHeadShape={true}
                  showShuffleOption={false}
                />
              </div>
            </details>
          </section>

          <section className="min-h-0 overflow-y-auto rounded-2xl border border-white/15 bg-black/35 p-3 shadow-xl">
            <div className="sticky top-0 z-10 mb-3 border-b border-white/10 bg-black/80 pb-2 text-sm font-semibold uppercase tracking-wide text-white">
              Body
            </div>
            <div className="flex flex-col gap-3">
              <HarthmereFaceOptionRow
                label="Body type"
                options={HARTHMERE_BODY_TYPES}
                value={harthmereBody.bodyType}
                onChange={(bodyType) => updateHarthmereBody({ bodyType })}
              />
              <HarthmereFaceOptionRow
                label="Height"
                options={HARTHMERE_BODY_HEIGHTS}
                value={harthmereBody.bodyHeight}
                onChange={(bodyHeight) => updateHarthmereBody({ bodyHeight })}
              />
              <HarthmereFaceOptionRow
                label="Shoulders"
                options={HARTHMERE_SHOULDER_WIDTHS}
                value={harthmereBody.shoulderWidth}
                onChange={(shoulderWidth) => updateHarthmereBody({ shoulderWidth })}
              />
              <HarthmereFaceOptionRow
                label="Arms"
                options={HARTHMERE_ARM_LENGTHS}
                value={harthmereBody.armLength}
                onChange={(armLength) => updateHarthmereBody({ armLength })}
              />
              <HarthmereFaceOptionRow
                label="Legs"
                options={HARTHMERE_LEG_LENGTHS}
                value={harthmereBody.legLength}
                onChange={(legLength) => updateHarthmereBody({ legLength })}
              />
              <HarthmereFaceOptionRow
                label="Stance"
                options={HARTHMERE_BODY_STANCES}
                value={harthmereBody.stance}
                onChange={(stance) => updateHarthmereBody({ stance })}
              />
              <HarthmereFaceOptionRow
                label="Outfit color"
                options={HARTHMERE_OUTFIT_COLORS}
                value={harthmereBody.outfitColor}
                onChange={(outfitColor) => updateHarthmereBody({ outfitColor })}
              />
            </div>
          </section>
        </div>
        <DialogButton
          type="primary"
          size="xl"
          glow
          extraClassNames="w-full max-w-md"
          onClick={() => {
            saveHarthmerePlayerFaceConfig(userId, harthmereFace);
            saveHarthmerePlayerBodyConfig(userId, harthmereBody);
            onComplete();
          }}
        >
          That&apos;s right
        </DialogButton>
      </WakeUpText>
    </>
  );
};

const WakeUpContent: React.FunctionComponent<{ onWakeup: () => void }> = ({
  onWakeup,
}) => {
  const { userId, reactResources, socialManager } = useClientContext();
  const [state, setState] = useState<WakeUpState>("initial");
  const [nameEntry, setNameEntry] = useState(() => {
    const name = reactResources.get("/ecs/c/label", userId)?.text ?? "";
    if (isInitialUsername(name)) {
      return "";
    }
    return name;
  });
  const [error, setError] = useError();
  const [savingName, setSavingName] = useState(false);

  const doUsernameSave = async () => {
    if (nameEntry === reactResources.get("/ecs/c/label", userId)?.text) {
      setState("character");
      return;
    }

    setSavingName(true);
    try {
      await saveUsername(nameEntry);

      fireAndForget(socialManager.userInfoBundle(userId, true)); // Bust cache
      setState("character");
    } catch (error: any) {
      setError(error);
    } finally {
      setSavingName(false);
    }
  };

  useEffect(() => reportFunnelStage(`wakeUp:${state}`), [state]);

  const [showContinue, setShowContinue] = useState(false);
  const [showWakeupContinue, setShowWakeupContinue] = useState(false);
  switch (state) {
    case "initial":
      return (
        <div
          className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-2"
          onClick={() => setState("name-entry")}
        >
          <WakeUpText
            heading="You are in a dark place with a mucky feeling..."
            onTypingComplete={() => setShowContinue(true)}
          />

          <span
            style={{ opacity: showContinue ? 1 : 0 }}
            onClick={() => {
              setState("name-entry");
            }}
          >
            <ClickToContinue customText="Click anywhere to continue" />
          </span>
        </div>
      );
    case "name-entry":
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <WakeUpText heading="You vaguely recall a name..." key={state}>
            {error && (
              <span className="font-semibold">
                <MaybeError error={error} />
              </span>
            )}
            <motion.div
              className="flex w-1/2 flex-col gap-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
            >
              <TalkToInput
                placeholder="Enter your username"
                value={nameEntry}
                spellcheck={false}
                onChange={(e) => {
                  setNameEntry(e.target.value);
                }}
                onEnter={doUsernameSave}
                extraClassName="text-center font-semibold"
              />
              <DialogButton
                type="primary"
                size="xl"
                glow
                disabled={nameEntry.length < 2 || savingName}
                onClick={doUsernameSave}
              >
                {savingName ? "Setting..." : "Set Name"}
              </DialogButton>
            </motion.div>
          </WakeUpText>
        </div>
      );
    case "character":
      return (
        <div className="absolute inset-0 overflow-y-auto px-4 py-6">
          <div className="flex min-h-full items-start justify-center">
            <CharacterWakeupContent
              onComplete={() => {
                setState("waking");
              }}
            />
          </div>
        </div>
      );
    case "waking":
      return (
        <div
          className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-2"
          onClick={() => {
            onWakeup();
          }}
        >
          <WakeUpText
            heading={`${nameEntry}... wake up... wake up...`}
            key={"2"}
            onTypingComplete={() => setShowWakeupContinue(true)}
          />
          <span
            style={{ opacity: showWakeupContinue ? 1 : 0 }}
            onClick={() => {
              setState("name-entry");
            }}
          >
            <ClickToContinue customText="Click anywhere to continue" />
          </span>
        </div>
      );
  }

  return <></>;
};

export const WakeUpScreen: React.FunctionComponent<{}> = ({}) => {
  const context = useClientContext();
  const { resources, gardenHose } = context;
  const pointerLockManager = usePointerLockManager();
  const [showScreen, setShowScreen] = useState(
    shouldPromptWakeupScreen(context)
  );

  if (!showScreen) {
    return <></>;
  }

  return (
    <div className="wake-up-container absolute z-[10001] flex h-full w-full flex-col bg-loading-bg">
      <WakeupMuckParticles />
      <WakeUpContent
        onWakeup={() => {
          pointerLockManager.focusAndLock();
          setCanvasEffect(resources, {
            kind: "wakeUp",
            onComplete: () => {
              gardenHose.publish({
                kind: "wake_up_complete",
              });

              fireAndForget(
                makeWakeUpScreenshot(context, {}),
                "Failed to do wakeup screenshot"
              );
            },
          });
          setTimeout(() => {
            setShowScreen(false);
          }, 1);
        }}
      />
    </div>
  );
};
