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
import { EditCharacterColorSelector } from "@/client/components/character/EditCharacterColorSelector";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { useOwnedItems } from "@/client/components/inventory/helpers";
import { captureProfilePicScreenshot } from "@/client/components/inventory/SelfInventoryScreen";
import type { ThreeObjectPreview } from "@/client/components/ThreeObjectPreview";
import type { LoadedPlayerMesh } from "@/client/game/resources/player_mesh";
import type { UpdateProfilePictureRequest } from "@/pages/api/upload/profile_picture";
import { BikkieIds } from "@/shared/bikkie/ids";
import type { Appearance, Item } from "@/shared/ecs/gen/types";
import { fireAndForget } from "@/shared/util/async";
import { jsonPost } from "@/shared/util/fetch_helpers";
import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { MathUtils, Spherical, Vector3 } from "three";
import {
  avatarSelectionChangedV1,
  buildAvatarMutationEventsV1,
} from "./avatarEditorMutations";

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

  const profilePicPrep = useRef<[string, string] | undefined>();

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
  const wearableOverrides = new Map(ownedItems.wearing?.items ?? new Map());
  if (previewHair) {
    wearableOverrides.set(BikkieIds.hair, previewHair);
  } else {
    wearableOverrides.delete(BikkieIds.hair);
  }

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
    avatarSelectionChangedV1(
      { appearance: appearanceComponent.appearance, hairId: wearingHair?.id },
      { appearance: previewAppearance, hairId: previewHair?.id }
    );

  const onSave = useCallback(async () => {
    if (!previewAppearance || saving) {
      return;
    }
    setSaving(true);
    try {
      const { appearanceEvent, hairEvent } = buildAvatarMutationEventsV1(
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(220px, 320px) 1fr",
            gap: 24,
            alignItems: "start",
          }}
        >
          <div
            className="preview-container"
            style={{
              position: "relative",
              height: 360,
              borderRadius: 6,
              overflow: "hidden",
              background:
                "radial-gradient(ellipse at center, rgba(20,32,58,0.6) 0%, rgba(7,12,26,0.9) 85%)",
              border: "1px solid var(--biomes-edge-cyan-soft)",
            }}
          >
            <CharacterPreview
              previewSlot={makePreviewSlot("appearencePreview", "biomesui-options")}
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
            />
          </div>

          <div className="form" style={{ minWidth: 0 }}>
            <EditCharacterColorSelector
              previewAppearance={previewAppearance}
              setPreviewAppearance={(updater) =>
                setPreviewAppearance((old) =>
                  old ? updater(old) : old
                )
              }
              previewHair={previewHair}
              setPreviewHair={setPreviewHair}
              showHeadShape={true}
            />

            <div
              className="dialog-button-group"
              style={{ display: "flex", gap: 8, marginTop: 12 }}
            >
              <button
                type="button"
                className="biomes-ui-tab"
                disabled={!hasChanges || saving}
                onClick={() => void onSave()}
              >
                {saving ? "Saving…" : justSaved ? "Saved ✓" : "Save Appearance"}
              </button>
              <button
                type="button"
                className="biomes-ui-tab"
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
