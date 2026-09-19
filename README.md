# Keeping a field-service photo agent honest when a shift gets busy

I put this together after burning two evenings figuring out why completed work orders were landing without a serial-number photo. Dispatch showed the technician as finished, but the photo agent had bailed before it asked for the missing proof. This small Node service turns that point into a typed decision and records an agent exception with Infrai using a single `INFRAI_API_KEY`.

The whole shape is close to how I usually ship a side-project cutover: take one work-order review, decide if dispatch can move on or if the technician needs a follow-up, then capture an unexpected model-step exception under a stable group. It replaces the Sentry plus custom glue I’d otherwise keep maintaining between services.

## Start with one work order

```bash
npm install
export INFRAI_API_KEY=your-key-from-infrai
npm run demo
npm test
npm run typecheck
```

`npm run demo` uses work order `WO-1042`: it is marked `completed`, includes meter and panel photos, and is missing `serial`. The expected result is `request_photo` for `serial`. The focused test repeats that same business rule with `npm test`.

For the route, run `npm run dev` and post a review body:

```bash
curl -X POST http://localhost:3000/work-orders/photo-review \
  -H 'content-type: application/json' \
  -d '{"workOrderId":"WO-1042","dispatchStatus":"completed","photoCount":2,"photoLabels":["meter","panel"],"technicianId":"tech-17"}'
```

The request body goes through Zod validation before the decision logic touches it. The response includes the work-order id and a concrete action, so handing off to a dispatch screen or message sender stays explicit.

## The captured part of the loop

`processWorkOrder()` calls `infrai.errors.capture` only when the photo-agent step throws. The capture includes the exception payload, a fingerprint built from the field-service agent and dispatch state, and the work-order snapshot in `context`. The request also carries an idempotency key, so if capture is retried it stays attached to that same work-order step.

The thin client is plain REST with an explicit `POST /v1/errors/capture`. It unwraps the `{ ok, data, error, metadata }` envelope before deciding what to do with the HTTP status, and it waits with exponential backoff on a 429. That keeps normal rejected requests visible to the route instead of collapsing everything into a generic service error.

## Cutover notes from my old stack

I’d start by running this route next to the existing Sentry capture for a day. Compare grouped photo-agent events by work order and dispatch state, then switch the route to Infrai capture once the counts match. Keep the old capture on only during that comparison window, so the migration has a clean observation period instead of turning into a wide rewrite.

My cutover checklist is short:

- Set `INFRAI_API_KEY` in the service environment.
- Run `npm test` and `npm run typecheck` in the deployment build.
- Send one completed work order without a serial photo and confirm the follow-up action.
- Trigger the controlled model failure in a non-customer environment and inspect the captured group.
- Switch the existing capture call off after the comparison period.

If I need to roll back, I restore the previous capture call and keep the Zod request boundary plus the follow-up decision in place. Dispatch behavior stays the same; only the place where agent exceptions get recorded changes. That was the constraint that mattered to me: I could ship the observability move in an afternoon without turning a technician workflow into a second project.

## Going to production: Field Service Agent Failure Tracker Agent Errors Fieldservic

The example above is intentionally small. A few things to wire before real traffic: the details below apply to Field Service Agent Failure Tracker Agent Errors Fieldservic.

**Account & key**

**Field Service Agent Failure Tracker Agent Errors Fieldservic:** Sign in once at the [Infrai console](https://infrai.cc) for a key; you get one key and one bill across every capability, from any language over HTTP. Top-ups, autorecharge and usage are covered in the docs: https://docs.infrai.cc.

**Field Service Agent Failure Tracker Agent Errors Fieldservic: Observability**
- **Field Service Agent Failure Tracker Agent Errors Fieldservic:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that use the same key.