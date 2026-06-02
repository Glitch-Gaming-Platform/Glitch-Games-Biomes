import { DecoratedNpcText } from "@/client/components/challenges/QuestViews";
import SimpleTextScreen from "@/client/components/challenges/SimpleTextScreen";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { ClickToContinue } from "@/client/components/challenges/TalkDialogModalStep";
import { useExistingMiniPhoneContext } from "@/client/components/system/mini_phone/MiniPhoneContext";
import { cleanListener } from "@/client/util/helpers";
import type { BiomesId } from "@/shared/ids";
import { relevantBiscuitForEntityId } from "@/shared/npc/bikkie";
import { useEffect } from "react";

const SignScreen: React.FunctionComponent<{ placeableId: BiomesId }> = ({
  placeableId,
}) => {
  const context = useClientContext();
  const miniPhone = useExistingMiniPhoneContext();
  const placeable = relevantBiscuitForEntityId(context.resources, placeableId);

  useEffect(() => {
    return cleanListener(window, {
      keyup: (event: KeyboardEvent) => {
        if (event.code === "Escape" || event.code === "Space") {
          miniPhone.close();
        }
      },
    });
  }, [miniPhone]);

  return (
    <div onClick={miniPhone.close}>
      <SimpleTextScreen>
        <DecoratedNpcText
          text={placeable?.npcDefaultDialog ?? ""}
          highlightClass="font-semibold"
        />
      </SimpleTextScreen>
      <ClickToContinue customText="Click to close" className="fixed bottom-2" />
    </div>
  );
};

export default SignScreen;
