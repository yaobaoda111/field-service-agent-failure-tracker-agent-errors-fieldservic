import { decideTechnicianFollowUp } from "./follow_up_decision.js";

const decision = decideTechnicianFollowUp({
  workOrderId: "WO-1042",
  dispatchStatus: "completed",
  photoCount: 2,
  photoLabels: ["meter", "panel"],
  technicianId: "tech-17",
});

console.log(JSON.stringify({ workOrderId: "WO-1042", decision }, null, 2));
