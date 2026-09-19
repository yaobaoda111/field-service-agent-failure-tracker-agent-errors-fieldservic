import { createServer } from "node:http";
import { z } from "zod";
import { decideTechnicianFollowUp, type FollowUpDecision, type WorkOrderSnapshot } from "./follow_up_decision.js";
import { InfraiRequestError, infrai } from "./infrai_errors.js";

const bodySchema = z.object({
  workOrderId: z.string().min(1),
  dispatchStatus: z.enum(["assigned", "on_site", "completed"]),
  photoCount: z.number().int().nonnegative(),
  photoLabels: z.array(z.string()),
  technicianId: z.string().min(1),
  simulateModelFailure: z.boolean().optional(),
});

function runPhotoAgent(snapshot: WorkOrderSnapshot, simulateModelFailure: boolean): FollowUpDecision {
  if (simulateModelFailure) throw new Error("photo classifier did not return a decision");
  return decideTechnicianFollowUp(snapshot);
}

export async function processWorkOrder(input: z.infer<typeof bodySchema>): Promise<FollowUpDecision> {
  const snapshot: WorkOrderSnapshot = {
    workOrderId: input.workOrderId,
    dispatchStatus: input.dispatchStatus,
    photoCount: input.photoCount,
    photoLabels: input.photoLabels,
    technicianId: input.technicianId,
  };
  try {
    return runPhotoAgent(snapshot, input.simulateModelFailure ?? false);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "photo agent failed";
    await infrai.errors.capture({
      title: "field-service photo agent failed",
      message,
      exception: cause instanceof Error ? cause.stack ?? message : message,
      level: "error",
      fingerprint: ["field-service-photo-agent", snapshot.dispatchStatus],
      idempotency_key: `work-order:${snapshot.workOrderId}:photo-agent`,
      context: {
        workOrderId: snapshot.workOrderId,
        dispatchStatus: snapshot.dispatchStatus,
        photoCount: snapshot.photoCount,
        photoLabels: snapshot.photoLabels,
        technicianId: snapshot.technicianId,
      },
    });
    throw cause;
  }
}

function sendJson(response: import("node:http").ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

export function startServer(port = 3000): void {
  createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/work-orders/photo-review") {
      sendJson(response, 404, { message: "route not found" });
      return;
    }
    let raw = "";
    for await (const chunk of request) raw += chunk;
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      sendJson(response, 400, { message: "invalid JSON body" });
      return;
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      sendJson(response, 400, { message: "invalid work-order body", issues: parsed.error.issues });
      return;
    }
    try {
      sendJson(response, 200, { workOrderId: parsed.data.workOrderId, decision: await processWorkOrder(parsed.data) });
    } catch (error) {
      if (error instanceof InfraiRequestError) {
        sendJson(response, error.status >= 400 && error.status < 500 ? 422 : 502, { message: error.message });
        return;
      }
      sendJson(response, 422, { message: "photo review needs another pass" });
    }
  }).listen(port);
  console.log(`field-service review server listening on http://localhost:${port}`);
}

if (import.meta.url === `file://${process.argv[1]}`) startServer();
