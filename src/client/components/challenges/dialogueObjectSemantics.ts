import { isHarthmereNonLivingObjectLabelV1 } from "@/shared/harthmere/object_interaction_semantics_v1";

export function isHarthmereNonLivingDialogueObjectLabelV1(input: {
  label?: string | null;
  entityDescription?: string | null;
}) {
  return isHarthmereNonLivingObjectLabelV1(input);
}
