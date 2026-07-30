// All 2Factor (https://2factor.in) contact lives here.
//
// Two properties of their API drive this module's shape:
//
//   1. Errors come back as HTTP 200 with {"Status":"Error"}. Success MUST be
//      determined from the Status field -- response.ok would report a failed,
//      unbilled send as delivered.
//   2. The API key sits in the URL path, so no error message or log line may
//      ever echo a raw URL.

const BASE_URL = "https://2factor.in/API/V1";
const TIMEOUT_MS = 10_000;

export class TwoFactorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TwoFactorError";
  }
}

export interface TwoFactorClient {
  /** Sends an OTP via AUTOGEN. Resolves to the provider's session id. */
  sendOtp(phone: string): Promise<string>;
  /** True if the code matches. False on mismatch; throws on provider failure. */
  verifyOtp(sessionId: string, otp: string): Promise<boolean>;
}

function apiKey(): string {
  // Read at call time, not module load: a missing key must fail the request
  // that needs it, not break unrelated imports of this module.
  const key = Deno.env.get("TWOFACTOR_API_KEY");
  if (!key) throw new TwoFactorError("TWOFACTOR_API_KEY is not configured.");
  return key;
}

interface TwoFactorResponse {
  Status: string;
  Details: string;
}

async function call(
  fetchImpl: typeof fetch,
  path: string,
): Promise<TwoFactorResponse> {
  let res: Response;
  try {
    res = await fetchImpl(`${BASE_URL}/${apiKey()}/${path}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    // Never interpolate the URL -- it contains the API key.
    const detail = e instanceof Error ? e.message : "network failure";
    throw new TwoFactorError(`2Factor request failed: ${detail}`);
  }

  const body = (await res.json().catch(() => null)) as TwoFactorResponse | null;
  if (!body || typeof body.Status !== "string") {
    throw new TwoFactorError("2Factor returned an unreadable response.");
  }
  return body;
}

export function createTwoFactorClient(
  fetchImpl: typeof fetch = fetch,
): TwoFactorClient {
  return {
    async sendOtp(phone) {
      const body = await call(fetchImpl, `SMS/${phone}/AUTOGEN`);
      // DLT swap point: when a registered template exists, this becomes
      // `SMS/${phone}/AUTOGEN3/${templateName}`. Nothing else changes.
      if (body.Status !== "Success") {
        throw new TwoFactorError(`2Factor send failed: ${body.Details}`);
      }
      return body.Details;
    },

    async verifyOtp(sessionId, otp) {
      const body = await call(fetchImpl, `SMS/VERIFY/${sessionId}/${otp}`);
      if (body.Status === "Success") return true;

      // Distinguish "wrong code" (a normal negative result the caller counts
      // as a failed attempt) from an operational fault that must surface.
      const detail = body.Details?.toLowerCase() ?? "";
      if (detail.includes("mismatch") || detail.includes("expired")) return false;

      throw new TwoFactorError(`2Factor verify failed: ${body.Details}`);
    },
  };
}
