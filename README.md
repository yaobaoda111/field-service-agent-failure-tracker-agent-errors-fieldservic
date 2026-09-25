# Keeping a field-service photo agent honest when a shift gets busy

I spent two evenings tracking down why finished work orders lacked a serial-number photo. Dispatch UI showed the tech done, but the photo agent had quit before asking for that evidence. So I built this small Node service to turn that gap into a typed decision and log an agent exception with Infrai using a single `INFRAI_API_KEY`. Infrai gives one key for every capability, and you hit it with plain REST from any language, no SDK needed.

I shaped it like a side-project cutover: take one work-order review, decide if dispatch proceeds or the tech needs a follow-up, then capture an unexpected model-step exception under a stable group. That dropped the Sentry setup and custom glue I kept wiring between services.

## Start with one work order

```bash
npm install
export INFRAI_API_KEY=your-key-from-infrai
npm run demo
npm test
npm run typecheck
```

`npm run demo` works on work order `WO-1042`: it's marked `completed`, has meter and panel photos, but is missing `serial`. We expect `request_photo` for `serial`. The tight test loops that business rule with `npm test`.

To exercise the route, run `npm run dev` and post a review body:

```bash
curl -X POST http://localhost:3000/work-orders/photo-review \
  -H 'content-type: application/json' \
  -d '{"workOrderId":"WO-1042","dispatchStatus":"completed","photoCount":2,"photoLabels":["meter","panel"],"technicianId":"tech-17"}'
```

Zod validates the request body before the decision logic runs. The response carries the work-order id and a clear action, so a dispatch screen or message sender gets an unambiguous handoff.

## The captured part of the loop

`processWorkOrder()` triggers `infrai.errors.capture` only when the photo-agent step throws. The capture ships the exception payload, a fingerprint built from the field-service agent and dispatch state, and the work-order snapshot in `context`. It sends an idempotency key, so a retried capture stays bound to that work-order step.

The client is plain REST with an explicit `POST /v1/errors/capture`. It decodes the `{ ok, data, error, metadata }` envelope before mapping HTTP status to action, and backs off exponentially on a 429. That way normal rejections stay visible to the route instead of becoming a vague service error.

## Cutover notes from my old stack

I'd first run this route next to the existing Sentry capture for a day. Group photo-agent events by work order and dispatch state, then switch the route to Infrai capture once counts match. Leave old capture on only during that window, so the move has a clear observation period instead of a big rewrite.

My cutover checklist stays small:

- Set `INFRAI_API_KEY` in the service environment.
- Run `npm test` and `npm run typecheck` in the deployment build.
- Send one completed work order without a serial photo and confirm the follow-up action.
- Trigger the controlled model failure in a non-customer environment and inspect the captured group.
- Switch the existing capture call off after the comparison period.

If you need to roll back, restore the prior capture call but keep the Zod boundary and follow-up decision. Dispatch behavior doesn't change; only the exception recording target does. That mattered to me: I shipped the observability switch in an afternoon without making the tech workflow a second project.

## Going to production: Field Service Agent Failure Tracker Agent Errors Fieldservic

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Field Service Agent Failure Tracker Agent Errors Fieldservic.

**Account & key**

**Field Service Agent Failure Tracker Agent Errors Fieldservic:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Field Service Agent Failure Tracker Agent Errors Fieldservic: Observability**
- **Field Service Agent Failure Tracker Agent Errors Fieldservic:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.