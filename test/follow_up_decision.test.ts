import assert from "node:assert/strict";
import test from "node:test";
import { decideTechnicianFollowUp } from "../src/follow_up_decision.js";

test("completed work without a serial photo requests the technician follow-up", () => {
  const decision = decideTechnicianFollowUp({
    workOrderId: "WO-1042",
    dispatchStatus: "completed",
    photoCount: 2,
    photoLabels: ["meter", "panel"],
    technicianId: "tech-17",
  });

  assert.deepEqual(decision, {
    action: "request_photo",
    requestedLabel: "serial",
    reason: "completed work needs a serial photo",
  });
});
