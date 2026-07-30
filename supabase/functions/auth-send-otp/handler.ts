import { TwoFactorError, type TwoFactorClient } from "../_shared/twofactor.ts";

/** Fixed code for allowlisted test numbers. Only ever reachable server-side. */
const TEST_OTP = "123456";
const OTP_TTL_MS = 5 * 60 * 1000;

export interface ThrottleDecision {
  allowed: boolean;
  reason: string;
  retryAfterSeconds: number;
}

export interface SendOtpDeps {
  checkAllowed(phone: string, ipHash: string | null): Promise<ThrottleDecision>;
  logSend(phone: string, ipHash: string | null): Promise<void>;
  storeSession(phone: string, sessionId: string, expiresAt: string): Promise<void>;
  storeTestCode(phone: string, otp: string, expiresAt: string): Promise<void>;
  twoFactor: TwoFactorClient;
  testPhones: string[];
}

function throttleMessage(reason: string, retryAfterSeconds: number): string {
  switch (reason) {
    case "phone_cooldown":
      // Specific: this is the only limit a legitimate user routinely meets.
      return `Please wait ${retryAfterSeconds} seconds before requesting another code.`;
    case "phone_daily":
      return "Too many codes requested for this number. Try again later.";
    default:
      // ip_hourly / global_daily -- deliberately vague. Naming the limit an
      // attacker tripped tells them how to tune around it.
      return "Too many requests. Please try again later.";
  }
}

export async function handleSendOtp(
  deps: SendOtpDeps,
  phone: string,
  ipHash: string | null,
): Promise<{ success: boolean; message: string }> {
  if (!phone || typeof phone !== "string") {
    return { success: false, message: "A valid phone number is required." };
  }

  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  // Test-mode bypass: no provider call, no cost, no SMS. Server-side and
  // secret-driven, so a client cannot select this path. Checked before the
  // throttle so E2E runs are never blocked by a shared limit.
  if (deps.testPhones.includes(phone)) {
    await deps.storeTestCode(phone, TEST_OTP, expiresAt);
    return { success: true, message: `OTP sent to ${phone}.` };
  }

  // Throttle BEFORE contacting the provider -- checking afterwards would bill
  // the very request the limit exists to prevent.
  const decision = await deps.checkAllowed(phone, ipHash);
  if (!decision.allowed) {
    return {
      success: false,
      message: throttleMessage(decision.reason, decision.retryAfterSeconds),
    };
  }

  let sessionId: string;
  try {
    sessionId = await deps.twoFactor.sendOtp(phone);
  } catch (error) {
    // Provider details ("Insufficient balance", "Invalid API Key") are
    // operational -- log them, never show them. No send is logged, so an
    // outage cannot consume the user's allowance.
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[auth-send-otp] provider error:", detail);
    if (error instanceof TwoFactorError) {
      return { success: false, message: "Could not send OTP. Please try again." };
    }
    throw error;
  }

  await deps.storeSession(phone, sessionId, expiresAt);
  await deps.logSend(phone, ipHash);

  return { success: true, message: `OTP sent to ${phone}.` };
}
