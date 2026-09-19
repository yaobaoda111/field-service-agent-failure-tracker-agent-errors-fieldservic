export type WorkOrderSnapshot = {
  workOrderId: string;
  dispatchStatus: "assigned" | "on_site" | "completed";
  photoCount: number;
  photoLabels: string[];
  technicianId: string;
};

export type FollowUpDecision =
  | { action: "continue_dispatch"; reason: string }
  | { action: "request_photo"; reason: string; requestedLabel: "meter" | "serial" };

export function decideTechnicianFollowUp(snapshot: WorkOrderSnapshot): FollowUpDecision {
  const needsMeter = !snapshot.photoLabels.includes("meter");
  const needsSerial = !snapshot.photoLabels.includes("serial");

  if (snapshot.dispatchStatus === "on_site" && snapshot.photoCount === 0) {
    return { action: "request_photo", requestedLabel: "meter", reason: "on-site work needs a meter photo" };
  }
  if (snapshot.dispatchStatus === "completed" && needsSerial) {
    return { action: "request_photo", requestedLabel: "serial", reason: "completed work needs a serial photo" };
  }
  if (needsMeter && snapshot.dispatchStatus !== "assigned") {
    return { action: "request_photo", requestedLabel: "meter", reason: "meter photo is still missing" };
  }
  return { action: "continue_dispatch", reason: "photo evidence matches the current dispatch step" };
}
