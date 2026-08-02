// BiomesUIAvatarEditor — avatar customization embedded in the BiomesUI options
// tab. It mirrors the wake-up screen / EditCharacterScreen flow (skin, eyes,
// hair style, hair color, head shape) with a live 3D preview, and persists via
// the exact same ECS events the wake-up screen uses, so the backend handlers
// (appearanceChangeEventHandler / hairTransplantEventHandler) update the
// player's AppearanceComponent and hair wearable.

import {
  CharacterPreview,
  makePreviewSlot,
} from "@/client/components/character/CharacterPreview";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { useOwnedItems } from "@/client/components/inventory/helpers";
import { iconUrl } from "@/client/components/inventory/icons";
import { captureProfilePicScreenshot } from "@/client/components/inventory/SelfInventoryScreen";
import type { ThreeObjectPreview } from "@/client/components/ThreeObjectPreview";
import type { LoadedPlayerMesh } from "@/client/game/resources/player_mesh";
import type { UpdateProfilePictureRequest } from "@/pages/api/upload/profile_picture";
import { colorEntries } from "@/shared/asset_defs/color_palettes";
import type {
  ColorEntry,
  PaletteKey,
} from "@/shared/asset_defs/color_palettes";
import { BikkieIds } from "@/shared/bikkie/ids";
import type {
  Appearance,
  Item,
  ReadonlyAppearance,
} from "@/shared/ecs/gen/types";
import type { BiomesId } from "@/shared/ids";
import { INVALID_BIOMES_ID } from "@/shared/ids";
import { fireAndForget } from "@/shared/util/async";
import { jsonPost } from "@/shared/util/fetch_helpers";
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MathUtils, Spherical, Vector3 } from "three";
import {
  avatarSelectionChanged,
  buildAvatarMutationEvents,
} from "./avatarEditorMutations";
import {
  avatarEditorHairStyleIds,
  avatarEditorHeadIds,
  buildAvatarPreviewWearableOverrides,
  itemForAvatarHairId,
} from "./avatarEditorOptions";

const titleStyle: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: 11,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--biomes-fg-muted)",
};

export const BiomesUIAvatarEditor: React.FunctionComponent<{}> = () => {
  const { reactResources, userId, events, socialManager } = useClientContext();

  const appearanceComponent = reactResources.use(
    "/ecs/c/appearance_component",
    userId
  );
  const ownedItems = useOwnedItems(reactResources, userId);
  const wearingHair = ownedItems.wearing?.items.get(BikkieIds.hair);

  const [previewAppearance, setPreviewAppearance] = useState<
    Appearance | undefined
  >(appearanceComponent?.appearance);
  const [previewHair, setPreviewHair] = useState<Item | undefined>(wearingHair);
  const [initialized, setInitialized] = useState(
    Boolean(appearanceComponent?.appearance)
  );
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const profilePicPrep = useRef<[string, string] | undefined>(undefined);

  // Seed the editor from the player's live appearance once it resolves. Only
  // happens once so the user's in-progress edits are never clobbered.
  useEffect(() => {
    if (!initialized && appearanceComponent?.appearance) {
      setPreviewAppearance(appearanceComponent.appearance);
      setPreviewHair(wearingHair);
      setInitialized(true);
    }
  }, [initialized, appearanceComponent, wearingHair]);

  // Feed the live preview: start from currently-worn items, then override hair
  // with the in-editor selection so the 3D model reflects unsaved changes.
  const wearableOverrides = useMemo(
    () =>
      buildAvatarPreviewWearableOverrides(
        ownedItems.wearing?.items,
        previewHair
      ),
    [ownedItems.wearing?.items, previewHair]
  );

  const onMeshChange = useCallback(
    (mesh: LoadedPlayerMesh, renderer: ThreeObjectPreview) => {
      // Slight delay so we don't screenshot the initial T-pose.
      setTimeout(() => {
        const screenshot = captureProfilePicScreenshot(renderer);
        if (screenshot) {
          profilePicPrep.current = [screenshot, mesh.hash];
        }
      }, 100);
    },
    []
  );

  const hasChanges =
    initialized &&
    !!previewAppearance &&
    !!appearanceComponent?.appearance &&
    avatarSelectionChanged(
      { appearance: appearanceComponent.appearance, hairId: wearingHair?.id },
      { appearance: previewAppearance, hairId: previewHair?.id }
    );

  const onSave = useCallback(async () => {
    if (!previewAppearance || saving) {
      return;
    }
    setSaving(true);
    try {
      const { appearanceEvent, hairEvent } = buildAvatarMutationEvents(
        userId,
        { appearance: previewAppearance, hairId: previewHair?.id }
      );
      await events.publish(appearanceEvent);
      await events.publish(hairEvent);

      // Refresh the player's profile picture to match the new look (best
      // effort — never blocks the appearance save).
      if (profilePicPrep.current) {
        fireAndForget(
          jsonPost<void, UpdateProfilePictureRequest>(
            "/api/upload/profile_picture",
            {
              photoDataURI: profilePicPrep.current[0],
              hash: profilePicPrep.current[1],
            }
          ).then(() => {
            void socialManager.userInfoBundle(userId, true);
          })
        );
      }

      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }, [previewAppearance, previewHair, saving, userId, events, socialManager]);

  const onReset = useCallback(() => {
    if (appearanceComponent?.appearance) {
      setPreviewAppearance(appearanceComponent.appearance);
      setPreviewHair(wearingHair);
    }
  }, [appearanceComponent, wearingHair]);

  return (
    <section aria-label="Avatar" style={{ marginBottom: 24 }}>
      <h3 style={titleStyle}>Avatar</h3>
      {!previewAppearance ? (
        <p style={{ fontSize: 12, color: "var(--biomes-fg-muted)" }}>
          Loading your character…
        </p>
      ) : (
        <div style={avatarEditorLayoutStyle}>
          <div
            className="preview-container biomes-ui-avatar-editor__preview"
            data-biomes-ui-avatar-preview="true"
            style={{
              position: "relative",
              minHeight: 420,
              borderRadius: 6,
              overflow: "hidden",
              background:
                "radial-gradient(circle at 50% 14%, rgba(74,222,255,0.16), transparent 30%), radial-gradient(ellipse at center, rgba(20,32,58,0.72) 0%, rgba(7,12,26,0.95) 85%)",
              border: "1px solid var(--biomes-edge-cyan-soft)",
              boxShadow:
                "inset 0 0 32px rgba(74,222,255,0.08), 0 14px 34px rgba(0,0,0,0.26)",
            }}
          >
            <CharacterPreview
              previewSlot={makePreviewSlot(
                "appearencePreview",
                "biomesui-options"
              )}
              appearanceOverride={previewAppearance}
              wearableOverrides={wearableOverrides}
              controlTarget={new Vector3(0, 1, 0)}
              onMeshChange={onMeshChange}
              cameraPos={new Vector3().setFromSpherical(
                new Spherical(
                  3.3,
                  MathUtils.degToRad(65),
                  MathUtils.degToRad(190)
                )
              )}
              extraClassName="biomes-ui-avatar-editor__full-preview"
            />
            <div style={previewBadgeStyle}>Live preview</div>
          </div>

          <div
            style={designPanelStyle}
            data-biomes-ui-avatar-design-controls="true"
          >
            <div style={designHeaderStyle}>
              <h4 style={designTitleStyle}>Character Design</h4>
              <span style={designCountStyle}>5 option groups</span>
            </div>

            <AvatarHeadShapeRow
              selectedId={previewAppearance.head_id}
              previewAppearance={previewAppearance}
              onSelect={(headId) =>
                setPreviewAppearance((current) =>
                  current ? { ...current, head_id: headId } : current
                )
              }
            />

            <AvatarColorOptionRow
              kind="skin"
              label="Skin"
              palette="color_palettes/skin_colors"
              selectedId={previewAppearance.skin_color_id}
              onSelect={(id) =>
                setPreviewAppearance((current) =>
                  current ? { ...current, skin_color_id: id } : current
                )
              }
            />

            <AvatarColorOptionRow
              kind="eyes"
              label="Eye color"
              palette="color_palettes/eye_colors"
              selectedId={previewAppearance.eye_color_id}
              onSelect={(id) =>
                setPreviewAppearance((current) =>
                  current ? { ...current, eye_color_id: id } : current
                )
              }
            />

            <AvatarColorOptionRow
              kind="hairColor"
              label="Hair color"
              palette="color_palettes/hair_colors"
              selectedId={previewAppearance.hair_color_id}
              onSelect={(id) =>
                setPreviewAppearance((current) =>
                  current ? { ...current, hair_color_id: id } : current
                )
              }
            />

            <AvatarHairStyleRow
              selectedId={previewHair?.id ?? INVALID_BIOMES_ID}
              onSelect={(id) => {
                setPreviewHair(itemForAvatarHairId(id));
              }}
            />

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                justifyContent: "flex-end",
                paddingTop: 4,
              }}
            >
              <button
                type="button"
                className="biomes-ui-tab"
                data-biomes-ui-avatar-action="save"
                disabled={!hasChanges || saving}
                onClick={() => void onSave()}
              >
                {saving ? "Saving..." : justSaved ? "Saved" : "Save Appearance"}
              </button>
              <button
                type="button"
                className="biomes-ui-tab"
                data-biomes-ui-avatar-action="reset"
                disabled={!hasChanges || saving}
                onClick={onReset}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

const AvatarOptionRow: React.FunctionComponent<{
  kind: string;
  label: string;
  selectedLabel: string;
  children: React.ReactNode;
}> = ({ kind, label, selectedLabel, children }) => {
  return (
    <section
      aria-label={label}
      data-biomes-ui-avatar-option-group={kind}
      style={optionRowStyle}
    >
      <div style={optionRowHeaderStyle}>
        <h5 style={optionRowTitleStyle}>{label}</h5>
        <span style={selectedBadgeStyle}>{selectedLabel}</span>
      </div>
      {children}
    </section>
  );
};

const AvatarColorOptionRow: React.FunctionComponent<{
  kind: "skin" | "eyes" | "hairColor";
  label: string;
  palette: PaletteKey;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}> = ({ kind, label, palette, selectedId, onSelect }) => {
  const entries = useMemo(() => colorEntries(palette), [palette]);
  return (
    <AvatarOptionRow
      kind={kind}
      label={label}
      selectedLabel={humanizeAvatarOptionId(selectedId)}
    >
      <div style={colorGridStyle}>
        {entries.map((entry) => {
          const selected = entry.id === selectedId;
          return (
            <button
              key={entry.id}
              type="button"
              aria-label={`${label}: ${humanizeAvatarOptionId(entry.id)}`}
              aria-pressed={selected}
              data-biomes-ui-avatar-option-kind={kind}
              data-biomes-ui-avatar-option-id={entry.id}
              data-biomes-ui-avatar-selected={selected ? "true" : "false"}
              style={colorSwatchStyle(entry, selected)}
              onClick={() => onSelect(entry.id)}
            />
          );
        })}
      </div>
    </AvatarOptionRow>
  );
};

const AvatarHairStyleRow: React.FunctionComponent<{
  selectedId: BiomesId;
  onSelect: (id: BiomesId) => void;
}> = ({ selectedId, onSelect }) => {
  const hairIds = useMemo(() => avatarEditorHairStyleIds(), []);
  return (
    <AvatarOptionRow
      kind="hairStyle"
      label="Hair style"
      selectedLabel={hairStyleLabel(selectedId)}
    >
      <div style={hairGridStyle}>
        <button
          type="button"
          aria-label="Hair style: bald"
          aria-pressed={selectedId === INVALID_BIOMES_ID}
          data-biomes-ui-avatar-option-kind="hairStyle"
          data-biomes-ui-avatar-option-id="none"
          data-biomes-ui-avatar-selected={
            selectedId === INVALID_BIOMES_ID ? "true" : "false"
          }
          style={hairButtonStyle(selectedId === INVALID_BIOMES_ID)}
          onClick={() => onSelect(INVALID_BIOMES_ID)}
        >
          Bald
        </button>
        {hairIds.map((id) => {
          const selected = selectedId === id;
          const item = itemForAvatarHairId(id);
          const label = hairStyleLabel(id);
          return (
            <button
              key={id}
              type="button"
              aria-label={`Hair style: ${label}`}
              aria-pressed={selected}
              title={label}
              data-biomes-ui-avatar-option-kind="hairStyle"
              data-biomes-ui-avatar-option-id={id}
              data-biomes-ui-avatar-selected={selected ? "true" : "false"}
              style={hairButtonStyle(selected)}
              onClick={() => onSelect(id)}
            >
              {item && (
                <img
                  src={iconUrl(item)}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </AvatarOptionRow>
  );
};

const AvatarHeadShapeRow: React.FunctionComponent<{
  selectedId: BiomesId;
  previewAppearance: ReadonlyAppearance;
  onSelect: (id: BiomesId) => void;
}> = ({ selectedId, previewAppearance, onSelect }) => {
  const headIds = useMemo(() => avatarEditorHeadIds(), []);
  return (
    <AvatarOptionRow
      kind="head"
      label="Head shape"
      selectedLabel={headStyleLabel(selectedId, headIds)}
    >
      <div style={headGridStyle}>
        {headIds.map((id) => {
          const selected = selectedId === id;
          return (
            <button
              key={id}
              type="button"
              aria-label={`Head shape: ${headStyleLabel(id, headIds)}`}
              aria-pressed={selected}
              data-biomes-ui-avatar-option-kind="head"
              data-biomes-ui-avatar-option-id={id}
              data-biomes-ui-avatar-selected={selected ? "true" : "false"}
              style={headButtonStyle(selected)}
              onClick={() => onSelect(id)}
            >
              <CharacterPreview
                previewSlot={makePreviewSlot("bikkie", id)}
                appearanceOverride={{
                  ...previewAppearance,
                  head_id: id,
                }}
                wearableOverrides={new Map()}
                controls={false}
                animate={false}
                cameraPos={new Vector3(6, 4.33, -13.33)}
                controlTarget={new Vector3(0, 1.4, 0)}
                cameraFOV={3}
                disableLoadingBlur={true}
                extraClassName="biomes-ui-avatar-editor__head-preview"
              />
            </button>
          );
        })}
      </div>
    </AvatarOptionRow>
  );
};

function humanizeAvatarOptionId(value: string | BiomesId | undefined): string {
  if (!value) {
    return "None";
  }
  return String(value)
    .replace(/_color_/g, " ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function hairStyleLabel(id: BiomesId | undefined): string {
  if (!id || id === INVALID_BIOMES_ID) {
    return "Bald";
  }
  const item = itemForAvatarHairId(id);
  return item?.displayName ?? humanizeAvatarOptionId(item?.name ?? id);
}

function headStyleLabel(id: BiomesId, headIds: BiomesId[]): string {
  const index = headIds.indexOf(id);
  return index >= 0 ? `Head ${index + 1}` : `Head ${id}`;
}

const avatarEditorLayoutStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 18,
  alignItems: "stretch",
};

const previewBadgeStyle: React.CSSProperties = {
  position: "absolute",
  left: 12,
  top: 12,
  padding: "5px 8px",
  border: "1px solid var(--biomes-edge-cyan-soft)",
  borderRadius: 4,
  background: "rgba(7, 12, 26, 0.72)",
  color: "var(--biomes-fg-muted)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  pointerEvents: "none",
};

const designPanelStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  alignContent: "start",
  minWidth: 0,
  maxHeight: 560,
  overflowY: "auto",
  padding: 12,
  borderRadius: 6,
  border: "1px solid var(--biomes-edge-cyan-soft)",
  background:
    "linear-gradient(180deg, rgba(13,22,44,0.82) 0%, rgba(7,12,26,0.88) 100%)",
};

const designHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  paddingBottom: 2,
};

const designTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "var(--biomes-fg)",
  fontSize: 15,
  lineHeight: 1,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const designCountStyle: React.CSSProperties = {
  flex: "0 0 auto",
  color: "var(--biomes-fg-dim)",
  fontSize: 10,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const optionRowStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 10,
  borderRadius: 6,
  border: "1px solid rgba(74, 222, 255, 0.22)",
  background: "rgba(232, 244, 255, 0.045)",
};

const optionRowHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  minWidth: 0,
};

const optionRowTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "var(--biomes-fg-muted)",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
};

const selectedBadgeStyle: React.CSSProperties = {
  minWidth: 0,
  maxWidth: 150,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  padding: "3px 7px",
  borderRadius: 4,
  border: "1px solid rgba(232, 244, 255, 0.12)",
  background: "rgba(7, 12, 26, 0.62)",
  color: "var(--biomes-fg)",
  fontSize: 10,
  fontWeight: 700,
};

const colorGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(28px, 1fr))",
  gap: 7,
};

const hairGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(46px, 1fr))",
  gap: 8,
};

const headGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))",
  gap: 8,
};

function colorSwatchStyle(
  entry: ColorEntry,
  selected: boolean
): React.CSSProperties {
  return {
    aspectRatio: "1 / 1",
    minHeight: 28,
    borderRadius: 6,
    border: selected
      ? "2px solid var(--biomes-edge-magenta)"
      : "1px solid rgba(232, 244, 255, 0.22)",
    backgroundColor: `rgb(${entry.iconColor[0]}, ${entry.iconColor[1]}, ${entry.iconColor[2]})`,
    boxShadow: selected
      ? "0 0 14px rgba(255,84,196,0.42), inset 0 0 0 1px rgba(255,255,255,0.42)"
      : "inset 0 0 0 1px rgba(0,0,0,0.16)",
    cursor: "pointer",
  };
}

function hairButtonStyle(selected: boolean): React.CSSProperties {
  return {
    aspectRatio: "1 / 1",
    minHeight: 46,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
    borderRadius: 6,
    border: selected
      ? "2px solid var(--biomes-edge-magenta)"
      : "1px solid rgba(232, 244, 255, 0.18)",
    background: selected ? "rgba(255,84,196,0.14)" : "rgba(7,12,26,0.55)",
    color: selected ? "var(--biomes-fg)" : "var(--biomes-fg-muted)",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    boxShadow: selected ? "0 0 14px rgba(255,84,196,0.36)" : undefined,
    cursor: "pointer",
  };
}

function headButtonStyle(selected: boolean): React.CSSProperties {
  return {
    position: "relative",
    aspectRatio: "1 / 1",
    minHeight: 64,
    overflow: "hidden",
    padding: 0,
    borderRadius: 6,
    border: selected
      ? "2px solid var(--biomes-edge-magenta)"
      : "1px solid rgba(232, 244, 255, 0.18)",
    background:
      "radial-gradient(circle at 50% 16%, rgba(74,222,255,0.12), rgba(7,12,26,0.68))",
    boxShadow: selected ? "0 0 14px rgba(255,84,196,0.36)" : undefined,
    cursor: "pointer",
  };
}
