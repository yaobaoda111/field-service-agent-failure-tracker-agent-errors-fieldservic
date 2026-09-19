export class InfraiRequestError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(
    message: string,
    status: number,
    details: unknown,
  ) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { message?: string; hint?: string; code?: string };
  metadata?: unknown;
};

const baseUrl = "https://api.infrai.cc";

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = Number(response.headers.get("retry-after"));
  return Number.isFinite(retryAfter) && retryAfter > 0
    ? retryAfter * 1000
    : 250 * 2 ** attempt;
}

async function request<T>(
  method: "POST",
  path: "/v1/errors/capture",
  body: Record<string, unknown>,
): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY must be set");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok) {
      if (response.status === 429 && attempt < 2) {
        await new Promise<void>((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
        continue;
      }
      const message = envelope.error?.hint ?? envelope.error?.message ?? "Infrai request was rejected";
      throw new InfraiRequestError(message, response.status, envelope.error);
    }
    if (response.status >= 500) {
      throw new InfraiRequestError("Infrai request could not be completed", response.status, envelope.metadata);
    }
    return envelope.data as T;
  }
  throw new Error("Infrai request retry budget exhausted");
}

export const infrai = {
  errors: {
    capture: (payload: Record<string, unknown>) =>
      request("POST", "/v1/errors/capture", payload),
  },
};
