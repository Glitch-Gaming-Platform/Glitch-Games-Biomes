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
  HARTHMERE_APPEARANCE_BUILDER_BODY_FIELDS,
  HARTHMERE_APPEARANCE_BUILDER_FACE_FIELDS,
  HARTHMERE_ARM_LENGTHS,
  HARTHMERE_CLOTHING_SLOTS,
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
  HARTHMERE_PLAYER_STARTER_CLOTHING_PRESETS,
  HARTHMERE_PRONOUN_OPTIONS,
  HARTHMERE_SHOULDER_WIDTHS,
  HARTHMERE_SKIN_TONES,
  applyHarthmereAppearanceBuilderSelection,
  clearHarthmereOtherCustomizationSessionsForUser,
  harthmereClothingCatalogForSlot,
  harthmereThreeJsClothingItem,
  defaultPronounsForGender,
  loadHarthmerePlayerBodyConfig,
  loadHarthmerePlayerClothingConfig,
  loadHarthmerePlayerFaceConfig,
  migrateHarthmereAnonymousCustomizationToUser,
  saveHarthmerePlayerBodyConfig,
  saveHarthmerePlayerClothingConfig,
  saveHarthmerePlayerFaceConfig,
  type HarthmereAppearanceBuilderField,
  type HarthmereCharacterClothing,
  type HarthmereClothingItem,
  type HarthmereClothingSlot,
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
  field,
  label,
  options,
  value,
  onChange,
  labelFor,
}: {
  field: HarthmereAppearanceBuilderField;
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  labelFor?: (value: T) => string;
}) => {
  return (
    <div
      className="rounded-2xl border border-white/12 bg-white/[0.055] p-3 shadow-[0_12px_28px_rgba(0,0,0,0.16)]"
      data-harthmere-builder-option-card={field}
      data-harthmere-builder-field={field}
      data-harthmere-builder-label={label}
    >
      <div className="mb-2 text-[0.68rem] font-black uppercase tracking-[0.18em] text-amber-100/75">
        {label}
      </div>
      <div
        className="harthmere-builder-pill-group"
        data-harthmere-builder-option-row={field}
      >
        {options.map((option) => {
          const selected = option === value;
          return (
            <button
              key={option}
              type="button"
              data-harthmere-builder-field={field}
              data-harthmere-builder-value={option}
              data-harthmere-builder-selected={selected ? "true" : "false"}
              aria-pressed={selected}
              className={selected ? "harthmere-builder-chip harthmere-builder-chip-selected" : "harthmere-builder-chip"}
              onClick={() => onChange(option)}
            >
              {labelFor?.(option) ?? humanizeFaceOption(option)}
            </button>
          );
        })}
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
  clothing?: HarthmereCharacterClothing;
}> = ({ body, clothing }) => {
  const torsoColor = BODY_COLOR_SWATCHES[body.outfitColor];
  const torsoItem = clothing?.torso?.id ?? `${body.outfitColor}_tunic`;
  const legItem = clothing?.legs?.id ?? `${body.outfitColor}_trousers`;
  const footItem = clothing?.feet?.id ?? "travel_boots";
  const hasRobe = /robe|skirt/i.test(`${torsoItem} ${legItem}`);
  const hasArmor = /guard|scale|armor/i.test(torsoItem);
  const hasApron = /apron|work/i.test(torsoItem);
  const backClothingId = clothing?.back?.id ?? "";
  const hasCape = /cape|cloak|shroud/i.test(backClothingId);
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
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-white/15 bg-black/25 p-3" data-harthmere-builder-mini-clothing-preview="true">
      <div className="relative" style={{ width: 128, height: 148 }}>
        <div
          className="absolute left-1/2 top-1 h-5 -translate-x-1/2 rounded-sm bg-white/25"
          style={{ width: shoulders }}
        />
        {hasCape && (
          <div
            className="absolute left-1/2 top-7 -translate-x-1/2 rounded-sm bg-black/45"
            style={{ width: shoulders + 8, height: torsoHeight + legs * 0.72 }}
          />
        )}
        <div
          className="absolute left-1/2 top-6 -translate-x-1/2 rounded-sm border-2 border-black/35"
          style={{ width: width + bodyType.torsoExtra, height: hasRobe ? torsoHeight + 18 : torsoHeight, background: torsoColor }}
        />
        {hasArmor && <div className="absolute left-1/2 top-9 h-8 w-20 -translate-x-1/2 rounded-sm bg-white/22" />}
        {hasApron && <div className="absolute left-1/2 top-12 h-16 w-16 -translate-x-1/2 rounded-sm bg-black/28" />}
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
          style={{ left: 42 - stance.legSpread, top: height - 4, width: 16, height: hasRobe ? Math.max(12, legs - 12) : legs }}
        />
        <div
          className="absolute rounded-sm bg-black/35"
          style={{ right: 42 - stance.legSpread, top: height - 4, width: 16, height: hasRobe ? Math.max(12, legs - 12) : legs }}
        />
        <div className="absolute rounded-sm bg-black/70" style={{ left: 40 - stance.legSpread, top: height + legs - 1, width: 20, height: /boot/i.test(footItem) ? 7 : 4 }} />
        <div className="absolute rounded-sm bg-black/70" style={{ right: 40 - stance.legSpread, top: height + legs - 1, width: 20, height: /boot/i.test(footItem) ? 7 : 4 }} />
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
        {humanizeFaceOption(body.bodyType)} · {humanizeFaceOption(torsoItem)}
      </div>
    </div>
  );
};


const HarthmereCompactFullBodyPreview: React.FunctionComponent<{
  face: HarthmereVoxelFaceConfig;
  body: HarthmereVoxelBodyConfig;
  clothing: HarthmereCharacterClothing;
}> = ({ face, body, clothing }) => {
  const skin = FACE_COLOR_SWATCHES.skin[face.skinTone] ?? "#d8b7a0";
  const hair = FACE_COLOR_SWATCHES.hair[face.hairColor] ?? "#2b1f1b";
  const eyes = FACE_COLOR_SWATCHES.eyes[face.eyeColor] ?? "#101010";
  const outfit = BODY_COLOR_SWATCHES[body.outfitColor] ?? "#94a3b8";
  const trim = body.outfitColor === "ash" ? "#9ca3af" : "#2d2346";
  const heightClass =
    body.bodyHeight === "very_tall"
      ? "scale-[1.08]"
      : body.bodyHeight === "tall"
      ? "scale-[1.02]"
      : body.bodyHeight === "short"
      ? "scale-[0.92]"
      : "scale-100";
  const shoulderClass = body.shoulderWidth === "wide" ? "w-40" : body.shoulderWidth === "narrow" ? "w-28" : "w-32";
  const torsoClass = body.bodyType === "broad" || body.bodyType === "stocky" ? "w-24" : body.bodyType === "slim" ? "w-16" : "w-20";
  const armClass = body.armLength === "long" ? "h-24" : body.armLength === "short" ? "h-16" : "h-20";
  const legClass = body.legLength === "long" ? "h-28" : body.legLength === "short" ? "h-20" : "h-24";
  const faceShapeClass =
    face.faceShape === "wide"
      ? "rounded-[1rem] w-24"
      : face.faceShape === "narrow"
      ? "rounded-[1rem] w-16"
      : face.faceShape === "soft"
      ? "rounded-[1.5rem] w-20"
      : "rounded-[1rem] w-20";

  return (
    <div
      className="flex h-full min-h-[20rem] items-center justify-center"
      data-harthmere-builder-live-preview="compact-full-body"
    >
      <div className={`relative flex flex-col items-center ${heightClass}`}>
        <div className="mb-3 rounded-full border border-white/15 bg-black/25 px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.18em] text-white/75">
          Full body preview
        </div>
        <div className="relative flex flex-col items-center">
          <div className="relative mb-2 flex items-end justify-center">
            <div
              className={`relative h-24 ${faceShapeClass} border-4 border-[#20143f] shadow-[0_10px_28px_rgba(0,0,0,0.32)]`}
              style={{ backgroundColor: skin }}
            >
              <div className="absolute left-1/2 top-0 h-8 w-[90%] -translate-x-1/2 rounded-t-[1rem]" style={{ backgroundColor: hair }} />
              <div className="absolute left-1/2 top-6 flex w-11 -translate-x-1/2 justify-between">
                <span className="h-2.5 w-2.5 rounded-full border border-black/20" style={{ backgroundColor: eyes }} />
                <span className="h-2.5 w-2.5 rounded-full border border-black/20" style={{ backgroundColor: eyes }} />
              </div>
              <div className="absolute left-1/2 top-[3.55rem] h-3 w-1.5 -translate-x-1/2 rounded-full bg-black/25" />
              <div className="absolute left-1/2 top-[4.5rem] h-1 w-8 -translate-x-1/2 rounded-full bg-[#6b3940]/80" />
            </div>
          </div>
          <div className={`relative ${shoulderClass} flex justify-center`}>
            <div
              className={`absolute left-0 top-3 ${armClass} w-6 rounded-full border-4 border-[#20143f]`}
              style={{ backgroundColor: clothing.hands ? trim : skin }}
            />
            <div
              className={`absolute right-0 top-3 ${armClass} w-6 rounded-full border-4 border-[#20143f]`}
              style={{ backgroundColor: clothing.hands ? trim : skin }}
            />
            <div
              className={`relative ${torsoClass} h-28 rounded-[1.25rem] border-4 border-[#20143f] shadow-[0_12px_32px_rgba(0,0,0,0.28)]`}
              style={{ backgroundColor: outfit }}
            >
              <div className="absolute left-1/2 top-0 h-3 w-[86%] -translate-x-1/2 rounded-b-full bg-white/20" />
              {clothing.belt && (
                <div className="absolute left-1/2 top-[4.4rem] h-3 w-[105%] -translate-x-1/2 rounded-full bg-[#3b2418]">
                  <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-[#caa55b]" />
                </div>
              )}
              {clothing.back && <div className="absolute -right-2 top-4 h-12 w-4 rounded-full bg-[#5f4c87]" />}
            </div>
          </div>
          <div className="mt-[-0.25rem] flex gap-4">
            <div
              className={`${legClass} w-8 rounded-b-[1rem] border-4 border-[#20143f]`}
              style={{ backgroundColor: clothing.legs ? trim : outfit }}
            />
            <div
              className={`${legClass} w-8 rounded-b-[1rem] border-4 border-[#20143f]`}
              style={{ backgroundColor: clothing.legs ? trim : outfit }}
            />
          </div>
          <div className="mt-1 flex gap-4">
            <div className="h-4 w-10 rounded-full border-4 border-[#20143f] bg-[#111827]" />
            <div className="h-4 w-10 rounded-full border-4 border-[#20143f] bg-[#111827]" />
          </div>
          <div className="mt-4 max-w-[15rem] text-center text-[0.72rem] leading-snug text-white/68">
            Preview stays intentionally compact so the full hero fits inside the panel while you customize face, body, and outfit.
          </div>
        </div>
      </div>
    </div>
  );
};


const HarthmereBuilderTinyAvatarPreview: React.FunctionComponent<{
  face: HarthmereVoxelFaceConfig;
  body: HarthmereVoxelBodyConfig;
  clothing: HarthmereCharacterClothing;
}> = ({ face, body, clothing }) => {
  const skin = FACE_COLOR_SWATCHES.skin[face.skinTone] ?? "#d8b7a0";
  const hair = FACE_COLOR_SWATCHES.hair[face.hairColor] ?? "#2b1f1b";
  const eye = FACE_COLOR_SWATCHES.eyes[face.eyeColor] ?? "#111827";
  const outfit = BODY_COLOR_SWATCHES[body.outfitColor] ?? "#64748b";
  const clothTrim = clothing.belt ? "#3b2418" : "#26314f";
  const pants = clothing.legs ? "#2f3658" : outfit;
  const boots = clothing.feet ? "#111827" : "#2d243f";
  const bodyWidth = body.bodyType === "broad" || body.bodyType === "stocky" ? 54 : body.bodyType === "slim" ? 38 : 46;
  const shoulderWidth = body.shoulderWidth === "wide" ? 84 : body.shoulderWidth === "narrow" ? 62 : 72;
  const torsoHeight = body.bodyHeight === "short" ? 58 : body.bodyHeight === "very_tall" ? 74 : body.bodyHeight === "tall" ? 68 : 64;
  const legHeight = body.legLength === "long" ? 58 : body.legLength === "short" ? 42 : 50;
  const armHeight = body.armLength === "long" ? 70 : body.armLength === "short" ? 50 : 60;
  const headWidth = face.faceShape === "wide" ? 48 : face.faceShape === "narrow" ? 36 : 42;
  const headHeight = face.faceShape === "tall" ? 50 : 44;
  const headX = 80 - headWidth / 2;
  const torsoX = 80 - bodyWidth / 2;
  const shoulderX = 80 - shoulderWidth / 2;
  const torsoY = 76;
  const legY = torsoY + torsoHeight - 2;
  const footY = legY + legHeight - 2;
  const hasCape = Boolean(clothing.back);
  const hasWeapon = Boolean(clothing.weapon);
  const hasShield = Boolean(clothing.shield);

  return (
    <div className="harthmere-builder-preview-avatar" data-harthmere-builder-preview-avatar="tiny-svg">
      <svg aria-label="Harthmere character preview" role="img" viewBox="0 0 160 220" className="harthmere-builder-preview-avatar-svg">
        <ellipse cx="80" cy="205" rx="46" ry="9" fill="rgba(0,0,0,0.35)" />
        <g>
          {hasCape && <rect x={shoulderX - 4} y={torsoY + 3} width={shoulderWidth + 8} height={torsoHeight + legHeight * 0.55} rx="8" fill="#5f4b8b" />}
          <rect x={headX} y="24" width={headWidth} height={headHeight} rx="7" fill={skin} stroke="#20143f" strokeWidth="4" />
          <rect x={headX + 3} y="22" width={headWidth - 6} height="15" rx="4" fill={hair} />
          <rect x={headX + 7} y="42" width="7" height="7" rx="2" fill={eye} />
          <rect x={headX + headWidth - 14} y="42" width="7" height="7" rx="2" fill={eye} />
          <rect x="75" y="54" width="10" height="4" rx="2" fill="rgba(0,0,0,0.25)" />
          <rect x="68" y="62" width="24" height="4" rx="2" fill="#783d44" />
          <rect x={shoulderX} y={torsoY + 8} width={shoulderWidth} height="16" rx="7" fill={outfit} stroke="#20143f" strokeWidth="4" />
          <rect x={torsoX} y={torsoY} width={bodyWidth} height={torsoHeight} rx="8" fill={outfit} stroke="#20143f" strokeWidth="4" />
          <rect x={torsoX + 5} y={torsoY + 7} width={bodyWidth - 10} height="6" rx="3" fill="rgba(255,255,255,0.22)" />
          {clothing.belt && <rect x={torsoX - 4} y={torsoY + torsoHeight - 18} width={bodyWidth + 8} height="8" rx="4" fill={clothTrim} />}
          <rect x={shoulderX - 13} y={torsoY + 16} width="16" height={armHeight} rx="7" fill={clothing.hands ? outfit : skin} stroke="#20143f" strokeWidth="4" />
          <rect x={shoulderX + shoulderWidth - 3} y={torsoY + 16} width="16" height={armHeight} rx="7" fill={clothing.hands ? outfit : skin} stroke="#20143f" strokeWidth="4" />
          <rect x="56" y={legY} width="18" height={legHeight} rx="6" fill={pants} stroke="#20143f" strokeWidth="4" />
          <rect x="86" y={legY} width="18" height={legHeight} rx="6" fill={pants} stroke="#20143f" strokeWidth="4" />
          <rect x="50" y={footY} width="29" height="13" rx="6" fill={boots} stroke="#20143f" strokeWidth="4" />
          <rect x="81" y={footY} width="29" height="13" rx="6" fill={boots} stroke="#20143f" strokeWidth="4" />
          {hasShield && <rect x="24" y="106" width="22" height="38" rx="8" fill="#76809f" stroke="#20143f" strokeWidth="4" />}
          {hasWeapon && <rect x="123" y="92" width="7" height="68" rx="3" fill="#cbd5e1" transform="rotate(17 126 126)" />}
        </g>
      </svg>
      <div className="harthmere-builder-preview-caption">Full character preview</div>
    </div>
  );
};

const HARTHMERE_BUILDER_CLOTHING_SLOTS = HARTHMERE_CLOTHING_SLOTS.filter(
  (slot): slot is HarthmereClothingSlot => slot !== "hair",
);

const HARTHMERE_BUILDER_OPTIONAL_CLOTHING_SLOTS = new Set<HarthmereClothingSlot>([
  "head",
  "face",
  "hands",
  "back",
  "weapon",
  "shield",
]);

function humanizeClothingLabel(value: string) {
  return humanizeFaceOption(value.replace(/^harthmere[-_]/, ""));
}

function clothingSlotLabel(slot: HarthmereClothingSlot) {
  return humanizeFaceOption(slot);
}

function clothingCardSummary(clothing: HarthmereCharacterClothing) {
  return Object.entries(clothing)
    .filter(([, item]) => Boolean(item))
    .map(([slot, item]) => `${clothingSlotLabel(slot as HarthmereClothingSlot)}: ${humanizeClothingLabel(item?.id ?? "")}`)
    .slice(0, 4)
    .join(" · ");
}

const HarthmereClothingPresetCard: React.FunctionComponent<{
  preset: (typeof HARTHMERE_PLAYER_STARTER_CLOTHING_PRESETS)[number];
  selected: boolean;
  onSelect: () => void;
}> = ({ preset, selected, onSelect }) => {
  return (
    <button
      type="button"
      data-harthmere-builder-clothing-preset={preset.id}
      data-harthmere-builder-clothing-selected={selected ? "true" : "false"}
      aria-pressed={selected}
      className={`rounded-2xl border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-amber-200/60 ${
        selected
          ? "border-amber-200 bg-amber-200/18 shadow-[0_0_26px_rgba(251,191,36,0.18)]"
          : "border-white/10 bg-white/[0.045] hover:border-amber-100/30 hover:bg-white/[0.075]"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-black text-white">{preset.label}</div>
          <div className="mt-1 text-xs leading-snug text-white/62">{preset.description}</div>
        </div>
        <div className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[0.66rem] font-black uppercase tracking-[0.12em] text-amber-100/85">
          {selected ? "On" : "Pick"}
        </div>
      </div>
      <div className="mt-2 text-[0.68rem] leading-snug text-white/46">
        {clothingCardSummary(preset.clothing)}
      </div>
    </button>
  );
};

const HarthmereClothingOptionRow: React.FunctionComponent<{
  slot: HarthmereClothingSlot;
  clothing: HarthmereCharacterClothing;
  onChange: (slot: HarthmereClothingSlot, item: HarthmereClothingItem | undefined) => void;
}> = ({ slot, clothing, onChange }) => {
  const current = clothing[slot];
  const slotOptions = harthmereClothingCatalogForSlot(slot).filter(
    (item) => item.renderMode === "threejs" || !item.modelUrl,
  );
  const options = HARTHMERE_BUILDER_OPTIONAL_CLOTHING_SLOTS.has(slot)
    ? [undefined, ...slotOptions]
    : slotOptions;
  return (
    <div
      className="rounded-2xl border border-white/10 bg-black/24 p-3"
      data-harthmere-builder-clothing-slot={slot}
      data-harthmere-builder-clothing-current={current?.id ?? "none"}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-[0.7rem] font-black uppercase tracking-[0.18em] text-amber-100/72">
          {clothingSlotLabel(slot)}
        </div>
        <div className="max-w-[12rem] truncate rounded-full border border-white/10 bg-white/[0.055] px-2 py-0.5 text-[0.68rem] font-black text-white/80">
          {current ? humanizeClothingLabel(current.id) : "None"}
        </div>
      </div>
      <div className="harthmere-builder-pill-group">
        {options.map((item) => {
          const value = item?.id ?? "none";
          const selected = (current?.id ?? "none") === value;
          return (
            <button
              key={`${slot}-${value}`}
              type="button"
              data-harthmere-builder-clothing-slot={slot}
              data-harthmere-builder-clothing-value={value}
              data-harthmere-builder-clothing-selected={selected ? "true" : "false"}
              aria-pressed={selected}
              className={selected ? "harthmere-builder-chip harthmere-builder-chip-selected" : "harthmere-builder-chip"}
              onClick={() => onChange(slot, item)}
            >
              {item ? humanizeClothingLabel(item.id) : "None"}
            </button>
          );
        })}
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
  const [harthmereClothing, setHarthmereClothing] = useState(() =>
    loadHarthmerePlayerClothingConfig(
      userId,
      loadHarthmerePlayerBodyConfig(userId),
    ),
  );

  useEffect(() => {
    migrateHarthmereAnonymousCustomizationToUser(userId);
    const cleanup = clearHarthmereOtherCustomizationSessionsForUser(userId);
    if (cleanup.removedKeys.length > 0) {
      console.info("[HarthmereBuilder] Removed old local character sessions", cleanup);
    }
    const nextBody = loadHarthmerePlayerBodyConfig(userId);
    setHarthmereFace(loadHarthmerePlayerFaceConfig(userId));
    setHarthmereBody(nextBody);
    setHarthmereClothing(loadHarthmerePlayerClothingConfig(userId, nextBody));
  }, [userId]);

  useEffect(() => {
    saveHarthmerePlayerFaceConfig(userId, harthmereFace);
  }, [userId, harthmereFace]);

  useEffect(() => {
    saveHarthmerePlayerBodyConfig(userId, harthmereBody);
  }, [userId, harthmereBody]);

  useEffect(() => {
    saveHarthmerePlayerClothingConfig(userId, harthmereClothing, harthmereBody);
  }, [userId, harthmereClothing, harthmereBody]);

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


  const updateHarthmereBuilderField = (
    field: HarthmereAppearanceBuilderField,
    value: string,
  ) => {
    const result = applyHarthmereAppearanceBuilderSelection({
      face: harthmereFace,
      body: harthmereBody,
      field,
      value,
    });

    if (!result.applied || !result.canonicalField || !result.target) {
      console.warn("[HarthmereBuilder] Ignored unmapped selection", { field, value });
      return;
    }

    if (result.target === "face") {
      setHarthmereFace(result.face);
      saveHarthmerePlayerFaceConfig(userId, result.face);
    } else {
      setHarthmereBody(result.body);
      saveHarthmerePlayerBodyConfig(userId, result.body);
    }

    // Lightweight field-level event for audits. This avoids the old audit
    // script's storage-quota problem because listeners can compare exactly one
    // selected field/value instead of snapshotting all localStorage repeatedly.
    const selectedRecord =
      result.target === "face"
        ? (result.face as unknown as Record<string, unknown>)
        : (result.body as unknown as Record<string, unknown>);
    const currentValue = selectedRecord[result.canonicalField];
    const expectedFields = [
      ...HARTHMERE_APPEARANCE_BUILDER_FACE_FIELDS,
      ...HARTHMERE_APPEARANCE_BUILDER_BODY_FIELDS,
    ].filter(
      (expectedField) =>
        expectedField !== "customPronouns" || result.face.pronouns === "custom",
    );

    window.dispatchEvent(
      new CustomEvent("biomes:harthmere-builder-selection-applied", {
        detail: {
          field: result.canonicalField,
          value,
          target: result.target,
          currentValue,
          matched: String(currentValue ?? "") === String(value ?? ""),
          expectedFields,
          face: result.face,
          body: result.body,
        },
      }),
    );
  };

  const updateHarthmereClothingSlot = (
    slot: HarthmereClothingSlot,
    item: HarthmereClothingItem | undefined,
  ) => {
    setHarthmereClothing((current) => {
      const next: HarthmereCharacterClothing = { ...current };
      if (item) {
        next[slot] = harthmereThreeJsClothingItem(item.id, { slot });
      } else {
        delete next[slot];
      }
      saveHarthmerePlayerClothingConfig(userId, next, harthmereBody);
      window.dispatchEvent(
        new CustomEvent("biomes:harthmere-builder-clothing-applied", {
          detail: {
            slot,
            value: item?.id ?? "none",
            currentValue: next[slot]?.id ?? "none",
            matched: (next[slot]?.id ?? "none") === (item?.id ?? "none"),
            clothing: next,
            expectedClothingSlots: HARTHMERE_BUILDER_CLOTHING_SLOTS,
          },
        }),
      );
      return next;
    });
  };

  const applyHarthmereClothingPreset = (
    preset: (typeof HARTHMERE_PLAYER_STARTER_CLOTHING_PRESETS)[number],
  ) => {
    const next: HarthmereCharacterClothing = { ...preset.clothing };
    setHarthmereClothing(next);
    saveHarthmerePlayerClothingConfig(userId, next, harthmereBody);
    window.dispatchEvent(
      new CustomEvent("biomes:harthmere-builder-clothing-preset-applied", {
        detail: {
          presetId: preset.id,
          clothing: next,
          expectedClothingSlots: HARTHMERE_BUILDER_CLOTHING_SLOTS,
        },
      }),
    );
  };

  const isHarthmereClothingPresetSelected = (
    preset: (typeof HARTHMERE_PLAYER_STARTER_CLOTHING_PRESETS)[number],
  ) => {
    return Object.entries(preset.clothing).every(
      ([slot, item]) => harthmereClothing[slot as HarthmereClothingSlot]?.id === item?.id,
    );
  };

  const harthmereFacePreviewKey = JSON.stringify({
    face: harthmereFace,
    body: harthmereBody,
    clothing: Object.fromEntries(
      Object.entries(harthmereClothing).map(([slot, item]) => [slot, item?.id ?? "none"]),
    ),
  });

  useEffect(() => {
    const expectedFaceFields = HARTHMERE_APPEARANCE_BUILDER_FACE_FIELDS.filter(
      (field) => field !== "customPronouns" || harthmereFace.pronouns === "custom",
    );
    const expectedBodyFields = [...HARTHMERE_APPEARANCE_BUILDER_BODY_FIELDS];
    const expectedFields = [...expectedFaceFields, ...expectedBodyFields];
    const expectedClothingSlots = [...HARTHMERE_BUILDER_CLOTHING_SLOTS];
    const faceRecord = harthmereFace as unknown as Record<string, unknown>;
    const bodyRecord = harthmereBody as unknown as Record<string, unknown>;

    // Expose a tiny no-storage audit surface for local-dev testing. The earlier
    // console audit filled sessionStorage and threw QuotaExceededError during a
    // full click-through. This report computes from current React state + DOM
    // attributes only, so it is safe to run repeatedly while testing the first
    // character builder screens.
    const auditWindow = window as typeof window & {
      __harthmereBuilderCurrentState?: unknown;
      __harthmereBuilderCoverageReport?: () => unknown;
    };

    const buildCoverageReport = () => {
      const domFields = new Set(
        Array.from(
          document.querySelectorAll<HTMLElement>(
            "[data-harthmere-builder-field]",
          ),
        )
          .map((element) => element.dataset.harthmereBuilderField)
          .filter((field): field is string => Boolean(field)),
      );
      const missingDomFields = expectedFields.filter(
        (field) => !domFields.has(field),
      );
      const missingFaceValues = expectedFaceFields.filter((field) => {
        const value = faceRecord[field];
        return value === undefined || value === null || value === "";
      });
      const missingBodyValues = expectedBodyFields.filter((field) => {
        const value = bodyRecord[field];
        return value === undefined || value === null || value === "";
      });
      const domClothingSlots = new Set(
        Array.from(
          document.querySelectorAll<HTMLElement>(
            "[data-harthmere-builder-clothing-slot]",
          ),
        )
          .map((element) => element.dataset.harthmereBuilderClothingSlot)
          .filter((slot): slot is string => Boolean(slot)),
      );
      const missingClothingSlots = expectedClothingSlots.filter(
        (slot) => !domClothingSlots.has(slot),
      );
      const clothingRows = expectedClothingSlots.map((slot) => ({
        slot,
        value: harthmereClothing[slot]?.id ?? "none",
        hasDomControl: domClothingSlots.has(slot),
      }));
      const rows = expectedFields.map((field) => {
        const target = expectedFaceFields.includes(field as never)
          ? "face"
          : "body";
        const value = target === "face" ? faceRecord[field] : bodyRecord[field];
        return {
          field,
          target,
          value,
          hasDomControl: domFields.has(field),
          hasValue: value !== undefined && value !== null && value !== "",
        };
      });
      const report = {
        userId,
        expectedFields,
        missingDomFields,
        missingFaceValues,
        missingBodyValues,
        rows,
        clothingRows,
        missingClothingSlots,
        face: harthmereFace,
        body: harthmereBody,
        clothing: harthmereClothing,
      };
      console.table(rows);
      if (
        missingDomFields.length ||
        missingFaceValues.length ||
        missingBodyValues.length ||
        missingClothingSlots.length
      ) {
        console.warn("[HarthmereBuilder] Coverage gaps", {
          missingDomFields,
          missingFaceValues,
          missingBodyValues,
          missingClothingSlots,
        });
      } else {
        console.log("[HarthmereBuilder] Coverage OK", report);
      }
      return report;
    };

    auditWindow.__harthmereBuilderCurrentState = {
      userId,
      expectedFields,
      face: harthmereFace,
      body: harthmereBody,
      clothing: harthmereClothing,
      expectedClothingSlots,
    };
    auditWindow.__harthmereBuilderCoverageReport = buildCoverageReport;

    window.dispatchEvent(
      new CustomEvent("biomes:harthmere-builder-state-ready", {
        detail: auditWindow.__harthmereBuilderCurrentState,
      }),
    );
  }, [userId, harthmereFace, harthmereBody, harthmereClothing]);

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
        heading="Build your Harthmere character"
        className="harthmere-wakeup-character-builder w-[min(92rem,97vw)] py-2"
      >
        <div data-harthmere-builder-layout="v21-release-polish-clothing" className="grid max-h-[calc(100vh-6.25rem)] min-h-[min(40rem,calc(100vh-6.25rem))] w-full grid-cols-1 gap-5 overflow-hidden text-left lg:grid-cols-[minmax(22rem,30rem)_minmax(0,1fr)]">
          <aside className="relative flex min-h-0 flex-col gap-4 overflow-hidden rounded-[2rem] border border-amber-200/20 bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,0.18),rgba(15,23,42,0.94)_34%,rgba(2,6,23,0.96)_100%)] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.42)] lg:row-span-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-amber-200/70">
                  Live hero preview
                </div>
                <div className="mt-1 text-xl font-black text-white drop-shadow">
                  Build a hero that looks ready to enter Harthmere.
                </div>
              </div>
              <div className="rounded-full border border-emerald-200/25 bg-emerald-300/10 px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.16em] text-emerald-100">
                Auto-saved
              </div>
            </div>
            <div className="preview-container relative min-h-[20rem] flex-1 overflow-hidden rounded-[1.75rem] border border-white/12 bg-[radial-gradient(circle_at_50%_18%,rgba(251,191,36,0.18),rgba(59,35,109,0.88)_38%,rgba(24,16,51,0.96)_100%)] p-4 shadow-inner lg:min-h-[24rem]">
              <div className="harthmere-builder-real-avatar-frame" data-harthmere-builder-real-avatar-preview="true">
                <CharacterPreview
                  key={harthmereFacePreviewKey}
                  previewSlot={makePreviewSlot("appearencePreview")}
                  meshVersionKey={harthmereFacePreviewKey}
                  disableLoadingBlur={true}
                  appearanceOverride={previewAppearance}
                  wearableOverrides={wearableOverrides}
                  controlTarget={new Vector3(0, 0.62, 0)}
                  cameraPos={new Vector3().setFromSpherical(
                    new Spherical(
                      7.75,
                      MathUtils.degToRad(68),
                      MathUtils.degToRad(198)
                    )
                  )}
                  cameraFOV={30}
                  extraClassName="harthmere-wakeup-hero-avatar harthmere-wakeup-hero-avatar-small"
                />
              </div></div>
            <div className="grid grid-cols-2 gap-3">
              <HarthmereVoxelFacePreview face={harthmereFace} />
              <HarthmereVoxelBodyPreview body={harthmereBody} clothing={harthmereClothing} />
            </div>
            <p className="rounded-xl border border-white/10 bg-white/[0.035] p-2 text-[0.72rem] leading-snug text-white/62">
              Drag to rotate. Face, body, and clothing choices are saved before the game starts.
            </p>
          </aside>

          <div className="harthmere-builder-options-scroll" data-harthmere-builder-options-scroll="true">
          <section className="min-h-0 overflow-y-auto rounded-[2rem] border border-white/14 bg-gradient-to-b from-black/48 to-slate-950/78 p-4 shadow-xl">
            <div className="sticky top-0 z-10 mb-3 rounded-xl border border-white/10 bg-black/88 px-3 py-2 backdrop-blur">
              <div className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-amber-200/70">Identity & face</div>
              <div className="text-sm text-white/65">Every option updates the preview, emits an audit event, and persists for runtime.</div>
            </div>
            <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
              <HarthmereFaceOptionRow
                field="genderIdentity"
                label="Gender"
                options={HARTHMERE_GENDER_OPTIONS.map((option) => option.id)}
                value={harthmereFace.genderIdentity}
                onChange={(genderIdentity) => updateHarthmereBuilderField("genderIdentity", genderIdentity)}
                labelFor={(value) =>
                  HARTHMERE_GENDER_OPTIONS.find((option) => option.id === value)
                    ?.label ?? humanizeFaceOption(value)
                }
              />
              <HarthmereFaceOptionRow
                field="pronouns"
                label="Pronouns"
                options={HARTHMERE_PRONOUN_OPTIONS}
                value={harthmereFace.pronouns}
                onChange={(pronouns) => updateHarthmereBuilderField("pronouns", pronouns)}
              />
              {harthmereFace.pronouns === "custom" && (
                <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-white/70 xl:col-span-2">
                  Custom pronouns
                  <input
                    className="rounded-md border border-white/20 bg-black/35 px-2 py-1 text-sm normal-case text-white outline-none"
                    data-harthmere-builder-field="customPronouns"
                    data-harthmere-builder-value={harthmereFace.customPronouns ?? ""}
                    placeholder="for example: fae/faer"
                    value={harthmereFace.customPronouns ?? ""}
                    onChange={(event) =>
                      updateHarthmereBuilderField("customPronouns", event.target.value)
                    }
                  />
                </label>
              )}
              <HarthmereFaceOptionRow
                field="skinTone"
                label="Skin"
                options={HARTHMERE_SKIN_TONES}
                value={harthmereFace.skinTone}
                onChange={(skinTone) => updateHarthmereBuilderField("skinTone", skinTone)}
              />
              <HarthmereFaceOptionRow
                field="faceShape"
                label="Face shape"
                options={HARTHMERE_FACE_SHAPES}
                value={harthmereFace.faceShape}
                onChange={(faceShape) => updateHarthmereBuilderField("faceShape", faceShape)}
              />
              <HarthmereFaceOptionRow
                field="eyeShape"
                label="Eyes"
                options={HARTHMERE_EYE_SHAPES}
                value={harthmereFace.eyeShape}
                onChange={(eyeShape) => updateHarthmereBuilderField("eyeShape", eyeShape)}
              />
              <HarthmereFaceOptionRow
                field="eyeColor"
                label="Eye color"
                options={HARTHMERE_EYE_COLORS}
                value={harthmereFace.eyeColor}
                onChange={(eyeColor) => updateHarthmereBuilderField("eyeColor", eyeColor)}
              />
              <HarthmereFaceOptionRow
                field="browStyle"
                label="Brows"
                options={HARTHMERE_BROW_STYLES}
                value={harthmereFace.browStyle}
                onChange={(browStyle) => updateHarthmereBuilderField("browStyle", browStyle)}
              />
              <HarthmereFaceOptionRow
                field="noseStyle"
                label="Nose"
                options={HARTHMERE_NOSE_STYLES}
                value={harthmereFace.noseStyle}
                onChange={(noseStyle) => updateHarthmereBuilderField("noseStyle", noseStyle)}
              />
              <HarthmereFaceOptionRow
                field="mouthStyle"
                label="Mouth"
                options={HARTHMERE_MOUTH_STYLES}
                value={harthmereFace.mouthStyle}
                onChange={(mouthStyle) => updateHarthmereBuilderField("mouthStyle", mouthStyle)}
              />
              <HarthmereFaceOptionRow
                field="hairStyle"
                label="Hair style"
                options={HARTHMERE_HAIR_STYLES}
                value={harthmereFace.hairStyle}
                onChange={(hairStyle) => updateHarthmereBuilderField("hairStyle", hairStyle)}
              />
              <HarthmereFaceOptionRow
                field="hairColor"
                label="Hair color"
                options={HARTHMERE_HAIR_COLORS}
                value={harthmereFace.hairColor}
                onChange={(hairColor) => updateHarthmereBuilderField("hairColor", hairColor)}
              />
              <HarthmereFaceOptionRow
                field="facialHair"
                label="Facial hair"
                options={HARTHMERE_FACIAL_HAIR_STYLES}
                value={harthmereFace.facialHair}
                onChange={(facialHair) => updateHarthmereBuilderField("facialHair", facialHair)}
              />
              <HarthmereFaceOptionRow
                field="cheekStyle"
                label="Cheeks"
                options={HARTHMERE_CHEEK_STYLES}
                value={harthmereFace.cheekStyle}
                onChange={(cheekStyle) => updateHarthmereBuilderField("cheekStyle", cheekStyle)}
              />
              <HarthmereFaceOptionRow
                field="accessory"
                label="Accessory"
                options={HARTHMERE_FACE_ACCESSORIES}
                value={harthmereFace.accessory}
                onChange={(accessory) => updateHarthmereBuilderField("accessory", accessory)}
              />
            </div>
            <details className="mt-4 rounded-2xl border border-amber-200/15 bg-amber-200/[0.04] p-3">
              <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-white/75">
                Classic base colors
              </summary>
              <p className="mb-3 text-xs leading-snug text-amber-200/80">
                Classic base colors affect the legacy Biomes appearance path.
                For Harthmere face/body, use the dedicated Skin, Eye color, Hair
                color, and Outfit color controls above.
              </p>
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

          <section className="min-h-0 overflow-y-auto rounded-[2rem] border border-white/15 bg-gradient-to-b from-black/55 to-slate-950/72 p-4 shadow-xl" data-harthmere-builder-clothing-panel="release-clothing-picker">
            <div className="sticky top-0 z-10 mb-4 rounded-2xl border border-white/10 bg-black/85 px-3 py-2 backdrop-blur">
              <div className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-amber-200/70">Body & outfit</div>
              <div className="text-sm text-white/65">Tune proportions, palette, and real clothing pieces that carry into gameplay.</div>
            </div>
            <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
              <HarthmereFaceOptionRow
                field="bodyType"
                label="Body type"
                options={HARTHMERE_BODY_TYPES}
                value={harthmereBody.bodyType}
                onChange={(bodyType) => updateHarthmereBuilderField("bodyType", bodyType)}
              />
              <HarthmereFaceOptionRow
                field="bodyHeight"
                label="Height"
                options={HARTHMERE_BODY_HEIGHTS}
                value={harthmereBody.bodyHeight}
                onChange={(bodyHeight) => updateHarthmereBuilderField("bodyHeight", bodyHeight)}
              />
              <HarthmereFaceOptionRow
                field="shoulderWidth"
                label="Shoulders"
                options={HARTHMERE_SHOULDER_WIDTHS}
                value={harthmereBody.shoulderWidth}
                onChange={(shoulderWidth) => updateHarthmereBuilderField("shoulderWidth", shoulderWidth)}
              />
              <HarthmereFaceOptionRow
                field="armLength"
                label="Arms"
                options={HARTHMERE_ARM_LENGTHS}
                value={harthmereBody.armLength}
                onChange={(armLength) => updateHarthmereBuilderField("armLength", armLength)}
              />
              <HarthmereFaceOptionRow
                field="legLength"
                label="Legs"
                options={HARTHMERE_LEG_LENGTHS}
                value={harthmereBody.legLength}
                onChange={(legLength) => updateHarthmereBuilderField("legLength", legLength)}
              />
              <HarthmereFaceOptionRow
                field="stance"
                label="Stance"
                options={HARTHMERE_BODY_STANCES}
                value={harthmereBody.stance}
                onChange={(stance) => updateHarthmereBuilderField("stance", stance)}
              />
              <HarthmereFaceOptionRow
                field="outfitColor"
                label="Outfit color"
                options={HARTHMERE_OUTFIT_COLORS}
                value={harthmereBody.outfitColor}
                onChange={(outfitColor) => updateHarthmereBuilderField("outfitColor", outfitColor)}
              />
            </div>

            <div className="mt-5 rounded-2xl border border-amber-200/15 bg-amber-200/[0.045] p-3" data-harthmere-builder-clothing-presets="true">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-amber-200/72">Starter clothing</div>
                  <div className="text-sm text-white/62">Pick a polished base outfit, then customize each slot.</div>
                </div>
                <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.14em] text-white/70">
                  {Object.keys(harthmereClothing).length} slots
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 xl:grid-cols-2 2xl:grid-cols-3">
                {HARTHMERE_PLAYER_STARTER_CLOTHING_PRESETS.map((preset) => (
                  <HarthmereClothingPresetCard
                    key={preset.id}
                    preset={preset}
                    selected={isHarthmereClothingPresetSelected(preset)}
                    onSelect={() => applyHarthmereClothingPreset(preset)}
                  />
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 2xl:grid-cols-2" data-harthmere-builder-clothing-slots="true">
              {HARTHMERE_BUILDER_CLOTHING_SLOTS.map((slot) => (
                <HarthmereClothingOptionRow
                  key={slot}
                  slot={slot}
                  clothing={harthmereClothing}
                  onChange={updateHarthmereClothingSlot}
                />
              ))}
            </div>
          </section>
          </div>
        </div>
        <DialogButton
          type="primary"
          size="xl"
          glow
          extraClassNames="w-full max-w-xl border border-amber-100/30 shadow-[0_0_40px_rgba(251,191,36,0.22)]"
          onClick={() => {
            saveHarthmerePlayerFaceConfig(userId, harthmereFace);
            saveHarthmerePlayerBodyConfig(userId, harthmereBody);
            saveHarthmerePlayerClothingConfig(userId, harthmereClothing, harthmereBody);
            onComplete();
          }}
        >
          Create Hero
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
