import type {
  TalkDialogInfo,
  TalkDialogStepAction,
} from "@/client/components/challenges/TalkDialogModalStep";

export interface RobotLiveEntityHelperDialogV1 {
  dialogText: string;
  actions: TalkDialogStepAction[];
}

export function robotTalkDialogSectionsWithLiveEntityHelperV1(input: {
  transmissionText: string;
  transmissionActions: TalkDialogStepAction[];
  liveEntityHelperDialog?: RobotLiveEntityHelperDialogV1;
}) {
  const sections: TalkDialogInfo[] = [];
  if (input.liveEntityHelperDialog) {
    sections.push({
      text: input.liveEntityHelperDialog.dialogText,
      actions: input.liveEntityHelperDialog.actions,
    });
  }
  sections.push({
    text: input.transmissionText,
    actions: input.transmissionActions,
  });
  return sections;
}
